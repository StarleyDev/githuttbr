import { useEffect, useMemo, useState } from 'react'
import { Blobatar } from 'blobatar/react'
import { happy, idle, mad, sad, scared, sick, sleepy, thinking, unsure } from 'blobatar/expression'
import { useSettingsStore } from '../stores/settings'
import { useRepoStore } from '../stores/repo'
import { githubAuthorAvatar, githubProfileAvatar, secretsUnlockGeneration, useSecretsUnlocks } from '../stores/githubAvatars'
import { avatarSources, generatedAvatar, githubAccountFingerprint, gravatarUrl, type AvatarSource } from '../lib/avatar'
import { githubNoreplyAvatarUrl } from '../../../shared/githubAvatar'
import { githubEnterpriseBases, githubInstanceOf } from '../../../shared/githubEnterprise'
import type { Mood } from '../lib/repoMood'

interface AvatarProps {
  email?: string
  name?: string
  size?: number
  className?: string
  title?: string
  /**
   * Which pose the generated fallback holds. Omitted everywhere but the
   * title-bar profile avatar: a pose costs inline SVG instead of a cached
   * `<img>`, and a commit author from three years ago has no opinion about
   * today's working tree.
   */
  mood?: Mood
  /** Idle motion. Only honoured alongside `mood`, for the same reason. */
  animate?: boolean
  /**
   * The repository the author committed to, and the commit: with them, a
   * GitHub-hosted repository's API can name the account behind the email.
   * Without them only a noreply address reaches GitHub.
   */
  repo?: string
  sha?: string
  /** Set only for the active profile's own avatar: its connected GitHub account's picture. */
  profileId?: string
}

// Poses are values rather than names so the ones nobody imports stay out of the
// bundle — blobatar's core carries no pose code at all.
const POSES = { idle, happy, sad, mad, thinking, scared, unsure, sick, sleepy }

/**
 * A person avatar: the first photo that loads — Gravatar, then GitHub (see
 * `avatarSources`) — otherwise a deterministic generated avatar derived from
 * the email/name. Each source that answers "none", or whose image fails to
 * load, hands over to the next.
 */
export function Avatar({
  email,
  name,
  size = 24,
  className,
  title,
  mood,
  animate,
  repo,
  sha,
  profileId
}: AvatarProps): React.JSX.Element {
  const lookups = useSettingsStore((s) => s.settings.commitAvatars ?? true)
  const github = useSettingsStore((s) => s.settings.githubAvatars ?? true)
  // A string, so the graph's rows do not re-render when anything else in the repository changes.
  const remoteUrl = useRepoStore((s) => {
    const remotes = repo ? s.repos[repo]?.remotes : undefined
    return (remotes?.find((r) => r.name === 'origin') ?? remotes?.[0])?.url
  })
  // Only a GitHub the app knows can be asked: a GitLab or Bitbucket repository
  // never makes the round trip to main just to hear "not GitHub".
  const onGithub = useSettingsStore((s) =>
    remoteUrl ? !!githubInstanceOf(remoteUrl, githubEnterpriseBases(s.settings.profiles)) : false
  )
  // Which GitHub accounts the profile holds: a switch, or its tokens arriving
  // on unlock, asks for its picture again. A string, so nothing else re-renders.
  const account = useSettingsStore((s) =>
    profileId ? githubAccountFingerprint(s.settings.profiles.find((p) => p.id === profileId)) : ''
  )
  const seed = (email || name || '?').toLowerCase()
  const gen = useMemo(() => generatedAvatar(seed), [seed])
  const px = Math.round(size * 2)
  const noreply = useMemo(() => githubNoreplyAvatarUrl(email, px), [email, px])
  const sources = avatarSources({
    email,
    lookups,
    github,
    githubLookup: !!profileId || !!(repo && onGithub),
    noreply: !!noreply
  })
  // Which source is being tried, tied to everything that decides the list: a
  // new email or a changed setting starts again from the first.
  const key = `${email}\n${px}\n${sources.join(',')}\n${remoteUrl}\n${onGithub}\n${profileId}\n${account}`
  const [attempt, setAttempt] = useState({ key, step: 0 })
  const step = attempt.key === key ? attempt.step : 0
  const source: AvatarSource | undefined = sources[step]
  const advance = (): void => setAttempt({ key, step: step + 1 })
  const [photo, setPhoto] = useState<string | null>(null)
  const unlocks = useSecretsUnlocks()
  // Bumped to ask the same source again (see the unlock check below).
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let alive = true
    setPhoto(null)
    if (!source || !email) return
    const askedAt = secretsUnlockGeneration()
    const load: Promise<string | null> =
      source === 'gravatar'
        ? gravatarUrl(email, px)
        : noreply
          ? Promise.resolve(noreply)
          : profileId
            ? githubProfileAvatar(profileId, account, px)
            : repo && remoteUrl && onGithub
              ? githubAuthorAvatar({ remoteUrl, repoPath: repo, size: px }, email, sha)
              : Promise.resolve(null)
    void load.then((u) => {
      if (!alive) return
      if (u) setPhoto(u)
      // The tokens unlocked while GitHub was being asked: its "none" may only
      // have meant "locked", and the unlock effect below has already run with
      // this step still in flight — so ask again here instead of moving on.
      else if (source === 'github' && secretsUnlockGeneration() !== askedAt) setRetry((r) => r + 1)
      else setAttempt({ key, step: step + 1 })
    })
    return () => {
      alive = false
    }
    // `key` covers email, size, the source list, the remote, the profile and its account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, step, retry])

  // The tokens were still encrypted when GitHub was asked, so its "none" may
  // only have meant "locked": once they unlock, go back to it. An avatar
  // already showing a photo, or that never got as far as GitHub, stays put.
  useEffect(() => {
    if (!unlocks || photo) return
    const gh = sources.indexOf('github')
    if (gh >= 0 && step > gh) setAttempt({ key, step: gh })
    // Only the unlock itself is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocks])

  // An expressive blob is inline SVG, which a photo cannot be — so a Gravatar
  // still wins, and the pose is what you get when there is none.
  const expressive = mood && !photo

  return (
    <span
      className={`ava${className ? ` ${className}` : ''}`}
      title={title ?? email ?? name}
      // The background is the static blob; with a pose the SVG paints itself.
      style={{ width: size, height: size, backgroundImage: expressive ? undefined : `url("${gen}")` }}
    >
      {expressive && (
        <Blobatar
          name={seed}
          background="circle"
          expression={POSES[mood]}
          // `animate` has to be absent, not false: the prop union switches
          // rendering mode on its presence.
          {...(animate ? ({ animate: 'always' } as const) : {})}
        />
      )}
      {photo && (
        <img
          src={photo}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => {
            setPhoto(null)
            advance()
          }}
        />
      )}
    </span>
  )
}
