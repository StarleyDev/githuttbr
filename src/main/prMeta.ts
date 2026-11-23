import { labelColor, prMetaSupport, sortLabels, uniqueById, withoutSelf } from '../shared/prMeta'
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

/** Page-numbered lists (GitHub, GitLab): stop at a short page, or at the cap. */
async function numberedPages<T>(url: (page: number) => string, json: Json): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; page <= PICKER_MAX_PAGES; page++) {
    const items = (await json<T[]>(url(page))) ?? []
    out.push(...items)
    if (items.length < 100) break
  }
  return out
}

type Loader<T> = (() => Promise<T[]>) | undefined

/**
 * Run each supported list on its own: one the token may not read (labels, say)
 * fails alone and is reported in `failed`, and the others still fill in.
 */
export async function collectPickerOptions(
  supports: Record<PrMetaField, boolean>,
  loaders: { reviewers?: Loader<PrPickerPerson>; assignees?: Loader<PrPickerPerson>; labels?: Loader<PrPickerLabel> },
  freeLabels = false
): Promise<PrPickerOptions> {
  const run = async <T>(field: PrMetaField, load: Loader<T>): Promise<T[] | null> => {
    if (!supports[field] || !load) return []
    return load().catch(() => null)
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
  return {
    supports,
    ...(freeLabels ? { freeLabels } : {}),
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
  const people = once(async () =>
    (await numberedPages<GhUser>((p) => `${repoApi}/assignees?per_page=100&page=${p}`, json)).map(
      (u): PrPickerPerson => ({ id: u.login, login: u.login, ...(u.avatar_url ? { avatarUrl: u.avatar_url } : {}) })
    )
  )
  return collectPickerOptions(
    prMetaSupport('github'),
    {
      reviewers: async () => {
        const [all, me] = await Promise.all([people(), json<GhUser>(`${apiBase}/user`).catch(() => null)])
        return withoutSelf(all, me?.login)
      },
      assignees: people,
      labels: async () =>
        sortLabels(
          (await numberedPages<{ name: string; color?: string }>((p) => `${repoApi}/labels?per_page=100&page=${p}`, json)).map(
            (l) => ({ id: l.name, name: l.name, ...(labelColor(l.color) ? { color: labelColor(l.color) } : {}) })
          )
        )
    }
  )
}

/**
 * Set the picks on a PR GitHub has just opened. The pulls API takes none of
 * them on create, so each is its own call; one failing does not stop the
 * others, and each failure is named so the user hears about it.
 */
export async function applyGithubPrMeta(
  repoApi: string,
  number: number,
  opts: CreatePrOpts,
  json: Json
): Promise<PrMetaField[]> {
  const calls: Array<[PrMetaField, string, Record<string, string[]>]> = []
  if (opts.reviewers?.length) calls.push(['reviewers', `${repoApi}/pulls/${number}/requested_reviewers`, { reviewers: opts.reviewers }])
  if (opts.assignees?.length) calls.push(['assignees', `${repoApi}/issues/${number}/assignees`, { assignees: opts.assignees }])
  if (opts.labels?.length) calls.push(['labels', `${repoApi}/issues/${number}/labels`, { labels: opts.labels }])
  const results = await Promise.all(
    calls.map(([field, url, body]) =>
      json(url, { method: 'POST', body: JSON.stringify(body) }).then(
        () => null,
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
  // members/all: direct and inherited (group) members — who can actually review.
  const people = once(async () =>
    (await numberedPages<GlMember>((p) => `${projectApi}/members/all?per_page=100&page=${p}`, json))
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
  return collectPickerOptions(
    prMetaSupport('gitlab'),
    {
      reviewers: async () => uniqueById(await people()),
      assignees: async () => uniqueById(await people()),
      labels: async () =>
        sortLabels(
          (await numberedPages<{ name: string; color?: string }>((p) => `${projectApi}/labels?per_page=100&page=${p}`, json)).map(
            (l) => ({ id: l.name, name: l.name, ...(labelColor(l.color) ? { color: labelColor(l.color) } : {}) })
          )
        )
    }
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
 */
export async function azurePickerOptions(org: string, project: string, ado: Json): Promise<PrPickerOptions> {
  const projectApi = `https://dev.azure.com/${encodeURIComponent(org)}/_apis/projects/${encodeURIComponent(project)}`
  return collectPickerOptions(
    prMetaSupport('azure'),
    {
      reviewers: async () => {
        const teams =
          (await ado<{ value?: Array<{ id: string; name: string }> }>(`${projectApi}/teams?$top=100&api-version=7.1`))?.value ?? []
        const members = await Promise.all(
          teams.slice(0, AZURE_MAX_TEAMS).map((t) =>
            ado<{ value?: Array<{ identity?: AzIdentity }> }>(
              `${projectApi}/teams/${encodeURIComponent(t.id)}/members?$top=500&api-version=7.1`
            ).then(
              (d) => (d?.value ?? []).flatMap((m) => (m.identity ? [m.identity] : [])),
              () => [] as AzIdentity[]
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
    true
  )
}

/** The reviewers of an Azure create body — empty when none were picked. */
export function azureMetaBody(opts: CreatePrOpts): Record<string, unknown> {
  return opts.reviewers?.length ? { reviewers: opts.reviewers.map((id) => ({ id })) } : {}
}

/** Labels go on after the PR exists, one call each; any refusal names the field. */
export async function applyAzureLabels(
  repoApi: string,
  id: number,
  labels: string[] | undefined,
  ado: Json
): Promise<PrMetaField[]> {
  if (!labels?.length) return []
  const results = await Promise.all(
    labels.map((name) =>
      ado(`${repoApi}/pullRequests/${id}/labels?api-version=7.1`, { method: 'POST', body: JSON.stringify({ name }) }).then(
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
async function bitbucketPages<T>(first: string, json: Json): Promise<T[]> {
  const out: T[] = []
  let url: string | undefined = first
  for (let page = 0; url && page < PICKER_MAX_PAGES; page++) {
    const d: { values?: T[]; next?: string } = await json(url)
    out.push(...(d?.values ?? []))
    url = typeof d?.next === 'string' && d.next.startsWith(`${BB_API}/`) ? d.next : undefined
  }
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
 * reviewers. The signed-in account is left out: Bitbucket refuses the author.
 */
export async function bitbucketPickerOptions(workspace: string, repo: string, json: Json): Promise<PrPickerOptions> {
  const ws = encodeURIComponent(workspace)
  return collectPickerOptions(
    prMetaSupport('bitbucket'),
    {
      reviewers: async () => {
        const users = await bitbucketPages<{ user?: BbUser }>(`${BB_API}/workspaces/${ws}/members?pagelen=100`, json)
          .then((m) => m.flatMap((x) => (x.user ? [x.user] : [])))
          .catch(() =>
            bitbucketPages<BbUser>(`${BB_API}/repositories/${ws}/${encodeURIComponent(repo)}/default-reviewers?pagelen=100`, json)
          )
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

/** A reviewer asked for but absent from what the host created — both Bitbucket flavours answer with the list. */
export function reviewersMissing(opts: CreatePrOpts, created: unknown[] | undefined): PrMetaField[] {
  return opts.reviewers?.length && (created?.length ?? 0) < opts.reviewers.length ? ['reviewers'] : []
}
