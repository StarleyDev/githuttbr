import { labelColor, PR_META_FIELDS, prMetaSupport, sortLabels, uniqueById, withoutSelf } from '../shared/prMeta'
import type { CreatePrOpts, PrMetaField, PrPickerLabel, PrPickerOptions, PrPickerPerson } from '../shared/types'

/**
 * Reviewers, assignees and labels for a new pull request — reading the choices
 * and setting the picks, per host. Every function takes a `Json` caller that
 * already carries the repository's credential (built in hosting.ts), so nothing
 * here knows how auth works, and nothing here imports hosting.
 *
 * Endpoints:
 *   GitHub   GET  /repos/{o}/{r}/assignees, /repos/{o}/{r}/labels, /user
 *            POST /repos/{o}/{r}/pulls/{n}/requested_reviewers
 *            POST /repos/{o}/{r}/issues/{n}/assignees, /issues/{n}/labels
 *   GitLab   GET  /projects/:id/members/all, /projects/:id/labels
 *            reviewer_ids / assignee_ids / labels on POST /merge_requests
 *   Azure    GET  /_apis/projects/{p}/teams, /teams/{t}/members
 *            reviewers on create; POST …/pullRequests/{id}/labels per label
 *   bitbucket.org  GET /2.0/workspaces/{ws}/members (else the repository's
 *            default reviewers), /2.0/user; reviewers on create
 * Bitbucket Data Center lives in bitbucketServer.ts beside the rest of its API.
 */

export type Json = <T>(url: string, init?: RequestInit) => Promise<T>

/** At most this many pages of 100 are read per list — a thousand people or labels. */
export const PICKER_MAX_PAGES = 10

/**
 * Page-numbered lists (GitHub, GitLab): stop at a short page, or at the cap —
 * where a full last page means there may be more, said through `partial`.
 */
async function numberedPages<T>(url: (page: number) => string, json: Json, partial?: () => void): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; page <= PICKER_MAX_PAGES; page++) {
    const items = (await json<T[]>(url(page))) ?? []
    out.push(...items)
    if (items.length < 100) return out
  }
  partial?.()
  return out
}

/** A list read. `partial` says the host has more than was read, so the dialog can say the list may be incomplete. */
type Loader<T> = ((partial: () => void) => Promise<T[]>) | undefined

/**
 * Run each supported list on its own: one the token may not read (labels, say)
 * fails alone and is reported in `failed`, and the others still fill in.
 * `free` names what a typed entry can stand for: labels the host creates by
 * name, and people whose id is their login (so one can be typed when the list
 * could not be read).
 */
export async function collectPickerOptions(
  supports: Record<PrMetaField, boolean>,
  loaders: { reviewers?: Loader<PrPickerPerson>; assignees?: Loader<PrPickerPerson>; labels?: Loader<PrPickerLabel> },
  free: { labels?: boolean; people?: boolean } = {}
): Promise<PrPickerOptions> {
  const partial = new Set<PrMetaField>()
  const run = async <T>(field: PrMetaField, load: Loader<T>): Promise<T[] | null> => {
    if (!supports[field] || !load) return []
    return load(() => partial.add(field)).catch(() => null)
  }
  const [reviewers, assignees, labels] = await Promise.all([
    run('reviewers', loaders.reviewers),
    run('assignees', loaders.assignees),
    run('labels', loaders.labels)
  ])
  const failed: PrMetaField[] = []
  if (reviewers === null) failed.push('reviewers')
  if (assignees === null) failed.push('assignees')
  if (labels === null) failed.push('labels')
  const incomplete = PR_META_FIELDS.filter((f) => partial.has(f) && !failed.includes(f))
  return {
    supports,
    ...(free.labels ? { freeLabels: true } : {}),
    ...(free.people ? { freePeople: true } : {}),
    ...(incomplete.length ? { partial: incomplete } : {}),
    reviewers: reviewers ?? [],
    assignees: assignees ?? [],
    labels: labels ?? [],
    failed
  }
}

/** Memoise one async read, so reviewers and assignees share a single walk of the same list. */
function once<T>(load: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null
  return () => (p ??= load())
}

// ─── GitHub ────────────────────────────────────────────────────────────────

interface GhUser {
  login: string
  avatar_url?: string
}

/**
 * `repoApi` is the repository's REST root (`…/repos/{o}/{r}`, on github.com or
 * a GHES), `apiBase` the server's. Reviewers and assignees both come from the
 * assignable users — the people with push access, which is who GitHub lets
 * review — and the signed-in account is left out of reviewers: GitHub refuses
 * a review request to the PR's own author.
 */
export async function githubPickerOptions(repoApi: string, apiBase: string, json: Json): Promise<PrPickerOptions> {
  let peoplePartial = false
  const people = once(async () =>
    (
      await numberedPages<GhUser>((p) => `${repoApi}/assignees?per_page=100&page=${p}`, json, () => (peoplePartial = true))
    ).map((u): PrPickerPerson => ({ id: u.login, login: u.login, ...(u.avatar_url ? { avatarUrl: u.avatar_url } : {}) }))
  )
  const shared = async (partial: () => void): Promise<PrPickerPerson[]> => {
    const all = await people()
    if (peoplePartial) partial()
    return all
  }
  return collectPickerOptions(
    prMetaSupport('github'),
    {
      reviewers: async (partial) => {
        const [all, me] = await Promise.all([shared(partial), json<GhUser>(`${apiBase}/user`).catch(() => null)])
        return withoutSelf(all, me?.login)
      },
      assignees: shared,
      labels: async (partial) =>
        sortLabels(
          (
            await numberedPages<{ name: string; color?: string }>((p) => `${repoApi}/labels?per_page=100&page=${p}`, json, partial)
          ).map((l) => ({ id: l.name, name: l.name, ...(labelColor(l.color) ? { color: labelColor(l.color) } : {}) }))
        )
    },
    // GitHub creates a label added by a name it does not know, and takes a login as a person's id.
    { labels: true, people: true }
  )
}

/** A GitHub login as typed: `@ana` is how people write one, and GitHub wants `ana`. */
export const ghLogin = (v: string): string => v.trim().replace(/^@+/, '')

/**
 * Set the picks on a PR GitHub has just opened. The pulls API takes none of
 * them on create, so each is its own call; one failing does not stop the
 * others, and each failure is named so the user hears about it.
 *
 * GitHub answers the assignees call with 201 even when it silently skipped a
 * login (no access, no such user), so the issue it returns is read back: a
 * pick missing from its `assignees` is a field that did not stick. An answer
 * without the list is not read as a refusal.
 *
 * `json` must be a plain call: setting a pick never evicts a saved credential.
 */
export async function applyGithubPrMeta(
  repoApi: string,
  number: number,
  opts: CreatePrOpts,
  json: Json
): Promise<PrMetaField[]> {
  const logins = (list?: string[]): string[] => [...new Set((list ?? []).map(ghLogin).filter(Boolean))]
  const reviewers = logins(opts.reviewers)
  const assignees = logins(opts.assignees)
  const assigned = (d: unknown): boolean => {
    const got = (d as { assignees?: unknown } | null)?.assignees
    if (!Array.isArray(got)) return true
    const have = new Set(got.flatMap((u) => strings((u as { login?: unknown } | null)?.login)).map((l) => l.toLowerCase()))
    return assignees.every((a) => have.has(a.toLowerCase()))
  }
  const calls: Array<[PrMetaField, string, Record<string, string[]>, (d: unknown) => boolean]> = []
  const stuck = (): boolean => true
  if (reviewers.length) calls.push(['reviewers', `${repoApi}/pulls/${number}/requested_reviewers`, { reviewers }, stuck])
  if (assignees.length) calls.push(['assignees', `${repoApi}/issues/${number}/assignees`, { assignees }, assigned])
  if (opts.labels?.length) calls.push(['labels', `${repoApi}/issues/${number}/labels`, { labels: opts.labels }, stuck])
  const results = await Promise.all(
    calls.map(([field, url, body, ok]) =>
      json<unknown>(url, { method: 'POST', body: JSON.stringify(body) }).then(
        (d) => (ok(d) ? null : field),
        () => field
      )
    )
  )
  return results.filter((f): f is PrMetaField => f !== null)
}

// ─── GitLab ────────────────────────────────────────────────────────────────

interface GlMember {
  id: number
  username: string
  name?: string
  avatar_url?: string | null
  state?: string
}

/** `projectApi` is `…/api/v4/projects/{id}` on gitlab.com or a self-managed server. */
export async function gitlabPickerOptions(projectApi: string, json: Json): Promise<PrPickerOptions> {
  let peoplePartial = false
  // members/all: direct and inherited (group) members — who can actually review.
  const people = once(async () =>
    (
      await numberedPages<GlMember>((p) => `${projectApi}/members/all?per_page=100&page=${p}`, json, () => (peoplePartial = true))
    )
      .filter((m) => !m.state || m.state === 'active')
      .map(
        (m): PrPickerPerson => ({
          id: String(m.id),
          login: m.username,
          ...(m.name ? { name: m.name } : {}),
          ...(m.avatar_url ? { avatarUrl: m.avatar_url } : {})
        })
      )
  )
  const shared = async (partial: () => void): Promise<PrPickerPerson[]> => {
    const all = uniqueById(await people())
    if (peoplePartial) partial()
    return all
  }
  return collectPickerOptions(
    prMetaSupport('gitlab'),
    {
      reviewers: shared,
      assignees: shared,
      labels: async (partial) =>
        sortLabels(
          (
            await numberedPages<{ name: string; color?: string }>((p) => `${projectApi}/labels?per_page=100&page=${p}`, json, partial)
          ).map((l) => ({ id: l.name, name: l.name, ...(labelColor(l.color) ? { color: labelColor(l.color) } : {}) }))
        )
    },
    // GitLab creates a project label given on a merge request by a new name. People
    // stay list-only: the create takes numeric ids, which nobody can type.
    { labels: true }
  )
}

/** The extra fields of a merge-request create. Empty when nothing was picked. */
export function gitlabMetaBody(opts: CreatePrOpts): Record<string, unknown> {
  const ids = (list?: string[]): number[] => (list ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0)
  return {
    ...(ids(opts.reviewers).length ? { reviewer_ids: ids(opts.reviewers) } : {}),
    ...(ids(opts.assignees).length ? { assignee_ids: ids(opts.assignees) } : {}),
    // A comma-separated string is what every GitLab version takes; names cannot contain a comma.
    ...(opts.labels?.length ? { labels: opts.labels.join(',') } : {})
  }
}

/**
 * GitLab sets the picks on create and drops the ones it will not take without
 * an error (a reviewer without access, for one), so the created merge request
 * is read back: a pick missing from it is a field that did not stick.
 */
export function gitlabMetaMissing(
  opts: CreatePrOpts,
  created: { reviewers?: Array<{ id: number }>; assignees?: Array<{ id: number }>; labels?: string[] }
): PrMetaField[] {
  const failed: PrMetaField[] = []
  const has = (want: string[] | undefined, got: string[] | undefined): boolean =>
    !want?.length || (!!got && want.every((w) => got.includes(w)))
  if (!has(opts.reviewers, created.reviewers?.map((u) => String(u.id)))) failed.push('reviewers')
  if (!has(opts.assignees, created.assignees?.map((u) => String(u.id)))) failed.push('assignees')
  if (!has(opts.labels, created.labels)) failed.push('labels')
  return failed
}

// ─── Azure DevOps ──────────────────────────────────────────────────────────

/** Teams read for their members — a project with more is still offered every team itself. */
export const AZURE_MAX_TEAMS = 10
/** Members read per team: a team this big is flagged as possibly listed short. */
export const AZURE_MAX_MEMBERS = 500

interface AzIdentity {
  id: string
  displayName?: string
  uniqueName?: string
}

/**
 * Reviewers are the project's teams (a team can be asked to review as one)
 * and the members of its first teams. Labels are free text: Azure creates a
 * label on first use and has no project list of them. No assignees — Azure
 * pull requests have none. Pictures are left out: Azure's need a signed-in browser.
 *
 * Teams are paged with `$skip` up to the shared cap. Members are not: a project
 * with more teams than are read, a team with a full page of members, or a team
 * whose members could not be read marks the list partial instead.
 *
 * `ado` must be a plain read: a picker read never retries with, or evicts, a
 * borrowed credential (see prPickerOptions in hosting.ts).
 */
export async function azurePickerOptions(org: string, project: string, ado: Json): Promise<PrPickerOptions> {
  const projectApi = `https://dev.azure.com/${encodeURIComponent(org)}/_apis/projects/${encodeURIComponent(project)}`
  return collectPickerOptions(
    prMetaSupport('azure'),
    {
      reviewers: async (partial) => {
        const teams: Array<{ id: string; name: string }> = []
        for (let page = 0; ; page++) {
          const got =
            (
              await ado<{ value?: Array<{ id: string; name: string }> }>(
                `${projectApi}/teams?$top=100&$skip=${page * 100}&api-version=7.1`
              )
            )?.value ?? []
          teams.push(...got)
          if (got.length < 100) break
          if (page + 1 >= PICKER_MAX_PAGES) {
            partial()
            break
          }
        }
        if (teams.length > AZURE_MAX_TEAMS) partial()
        const members = await Promise.all(
          teams.slice(0, AZURE_MAX_TEAMS).map((t) =>
            ado<{ value?: Array<{ identity?: AzIdentity }> }>(
              `${projectApi}/teams/${encodeURIComponent(t.id)}/members?$top=${AZURE_MAX_MEMBERS}&api-version=7.1`
            ).then(
              (d) => {
                if ((d?.value?.length ?? 0) >= AZURE_MAX_MEMBERS) partial()
                return (d?.value ?? []).flatMap((m) => (m.identity ? [m.identity] : []))
              },
              () => {
                partial()
                return [] as AzIdentity[]
              }
            )
          )
        )
        const people = members
          .flat()
          .map((i): PrPickerPerson => ({
            id: i.id,
            login: i.uniqueName || i.displayName || i.id,
            ...(i.displayName ? { name: i.displayName } : {})
          }))
        const teamRows = teams.map((t): PrPickerPerson => ({ id: t.id, login: t.name }))
        return uniqueById([...teamRows, ...people])
      },
      labels: async () => []
    },
    // Labels by name; reviewers are identity ids, which nobody can type.
    { labels: true }
  )
}

/** The reviewers of an Azure create body — empty when none were picked. */
export function azureMetaBody(opts: CreatePrOpts): Record<string, unknown> {
  return opts.reviewers?.length ? { reviewers: opts.reviewers.map((id) => ({ id })) } : {}
}

/**
 * Labels go on after the PR exists, one call each; any refusal names the field.
 * The Pull Request Labels resource is a preview API, so it is asked for as one.
 * `ado` must be a plain call with the token the create used: a label refused
 * for want of "Create tag definition" must not evict the user's git login.
 */
export async function applyAzureLabels(
  repoApi: string,
  id: number,
  labels: string[] | undefined,
  ado: Json
): Promise<PrMetaField[]> {
  if (!labels?.length) return []
  const results = await Promise.all(
    labels.map((name) =>
      ado(`${repoApi}/pullRequests/${id}/labels?api-version=7.1-preview.1`, { method: 'POST', body: JSON.stringify({ name }) }).then(
        () => true,
        () => false
      )
    )
  )
  return results.every(Boolean) ? [] : ['labels']
}

// ─── bitbucket.org ─────────────────────────────────────────────────────────

const BB_API = 'https://api.bitbucket.org/2.0'

interface BbUser {
  uuid?: string
  display_name?: string
  nickname?: string
  links?: { avatar?: { href?: string } }
}

/** A JSON caller for bitbucket.org with the given `Authorization` value. */
export function bitbucketCloudJson(authorization: string): Json {
  return async <T>(url: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(url, {
      ...init,
      redirect: 'error',
      headers: {
        Authorization: authorization,
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {})
      }
    })
    if (!res.ok) {
      const d = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      throw new Error(`Bitbucket: ${d?.error?.message || `API error (${res.status})`}`)
    }
    const text = await res.text()
    return (text ? JSON.parse(text) : undefined) as T
  }
}

/** Follow `next` links, but only while they stay on the API the token was sent to. */
async function bitbucketPages<T>(first: string, json: Json, partial?: () => void): Promise<T[]> {
  const out: T[] = []
  let url: string | undefined = first
  for (let page = 0; url && page < PICKER_MAX_PAGES; page++) {
    const d: { values?: T[]; next?: string } = await json(url)
    out.push(...(d?.values ?? []))
    url = typeof d?.next === 'string' && d.next.startsWith(`${BB_API}/`) ? d.next : undefined
  }
  if (url) partial?.()
  return out
}

const bbPerson = (u: BbUser): PrPickerPerson | null =>
  u.uuid
    ? {
        id: u.uuid,
        login: u.nickname || u.display_name || u.uuid,
        ...(u.display_name ? { name: u.display_name } : {}),
        ...(u.links?.avatar?.href ? { avatarUrl: u.links.avatar.href } : {})
      }
    : null

/**
 * Reviewers from the workspace's members; a token that may not list members
 * (a repository access token, say) still gets the repository's default
 * reviewers — flagged partial, since they are only some of who could review,
 * and failed when there are none, so the field says so instead of looking
 * empty. The signed-in account is left out: Bitbucket refuses the author.
 */
export async function bitbucketPickerOptions(workspace: string, repo: string, json: Json): Promise<PrPickerOptions> {
  const ws = encodeURIComponent(workspace)
  return collectPickerOptions(
    prMetaSupport('bitbucket'),
    {
      reviewers: async (partial) => {
        const users = await bitbucketPages<{ user?: BbUser }>(`${BB_API}/workspaces/${ws}/members?pagelen=100`, json, partial)
          .then((m) => m.flatMap((x) => (x.user ? [x.user] : [])))
          .catch(async () => {
            const defaults = await bitbucketPages<BbUser>(
              `${BB_API}/repositories/${ws}/${encodeURIComponent(repo)}/default-reviewers?pagelen=100`,
              json
            )
            if (!defaults.length) throw new Error('no members and no default reviewers')
            partial()
            return defaults
          })
        const me = await json<BbUser>(`${BB_API}/user`).catch(() => null)
        return withoutSelf(uniqueById(users.flatMap((u) => bbPerson(u) ?? [])), me?.uuid)
      }
    }
  )
}

/** The reviewers of a bitbucket.org create body — empty when none were picked. */
export function bitbucketMetaBody(opts: CreatePrOpts): Record<string, unknown> {
  return opts.reviewers?.length ? { reviewers: opts.reviewers.map((uuid) => ({ uuid })) } : {}
}

/**
 * A reviewer asked for but absent from what the host created. Compared by
 * identity, not by count: a host that adds its own default reviewers answers
 * with more people than were picked, and a count would call a dropped pick a
 * success. `created` is every identity the host's reviewers carry; case is ignored.
 */
export function reviewersMissing(opts: CreatePrOpts, created: string[]): PrMetaField[] {
  if (!opts.reviewers?.length) return []
  const got = new Set(created.map((c) => c.toLowerCase()))
  return opts.reviewers.every((r) => got.has(r.toLowerCase())) ? [] : ['reviewers']
}

const strings = (...v: unknown[]): string[] => v.filter((x): x is string => typeof x === 'string' && !!x)

/** bitbucket.org reviewers on a created PR, by uuid — what the picks are. */
export function bitbucketReviewerIds(reviewers: unknown): string[] {
  return Array.isArray(reviewers) ? reviewers.flatMap((r) => strings((r as BbUser | null)?.uuid)) : []
}

/** Data Center reviewers on a created PR: user name and slug, since a pick is a user name. */
export function bbsReviewerIds(reviewers: unknown): string[] {
  if (!Array.isArray(reviewers)) return []
  return reviewers.flatMap((r) => {
    const u = (r as { user?: { name?: unknown; slug?: unknown } } | null)?.user
    return strings(u?.name, u?.slug)
  })
}

/** Azure DevOps reviewers on a created PR, by identity id. */
export function azureReviewerIds(reviewers: unknown): string[] {
  return Array.isArray(reviewers) ? reviewers.flatMap((r) => strings((r as { id?: unknown } | null)?.id)) : []
}

// ─── A create the host refused because of a reviewer ───────────────────────

/**
 * A create failure carrying what the host said, so a refusal of the reviewers
 * can be told from any other. `fields` is bitbucket.org's per-field error map.
 */
export class PrCreateError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: string[] = []
  ) {
    super(message)
  }
}

/** An exception name about a reviewer — Data Center answers a reviewer it has no user for with NoSuchUserException. */
const REVIEWER_EXCEPTION = /reviewer|NoSuchUser/i

/**
 * Whether a failed create may have failed over its reviewers: a 400 or 409 —
 * a validation answer, which means nothing was created. Never an auth failure,
 * a server error or a network one, where the PR may exist or a retry would
 * only fail again. When the host names the fields (bitbucket.org) or the
 * exceptions (Data Center) at fault and none is about reviewers, it is not this.
 *
 * A 404 counts only when Data Center names a reviewer-shaped exception: it
 * answers a typed user name it does not know with NoSuchUserException, and
 * nothing was created. A bare 404 (no such repository) is never retried.
 */
export function rejectsReviewers(err: unknown): boolean {
  const e = err as { status?: unknown; fields?: unknown; exceptions?: unknown } | null
  if (!e) return false
  const names = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  if (e.status === 404) {
    const named = names(e.exceptions)
    return named.length > 0 && named.every((x) => REVIEWER_EXCEPTION.test(x))
  }
  if (e.status !== 400 && e.status !== 409) return false
  for (const named of [e.fields, e.exceptions]) {
    const list = names(named)
    if (list.length && !list.some((x) => REVIEWER_EXCEPTION.test(x))) return false
  }
  return true
}

/**
 * Create with the picks; if the host refused the request and reviewers were
 * in it, create once more without them. A picked reviewer the host will not
 * take (no access, the author, a stale id) would otherwise fail the whole
 * create; this way it costs only the reviewers, which `dropped` reports. One
 * retry, and only after a 400/409 — an answer that means the first request
 * created nothing, so a PR is never opened twice. If the second create fails
 * too, its error is the one thrown: it is why the PR cannot be opened at all.
 */
export async function createWithoutRejectedReviewers<R>(
  opts: CreatePrOpts,
  create: (o: CreatePrOpts) => Promise<R>
): Promise<{ result: R; dropped: boolean }> {
  try {
    return { result: await create(opts), dropped: false }
  } catch (err) {
    if (!opts.reviewers?.length || !rejectsReviewers(err)) throw err
    const rest: CreatePrOpts = { ...opts }
    delete rest.reviewers
    return { result: await create(rest), dropped: true }
  }
}
