import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { gitApi } from '../infrastructure/api'
import { useT, interp, type TranslationKey } from '../i18n'
import { useSettingsStore } from '../stores/settings'
import { useProfileAvatarsStore } from '../stores/profileAvatars'
import { useUIStore } from '../stores/ui'
import { repoDisplayName } from '../lib/repoAlias'
import { scanRepoAvatars, type RepoAvatarKind, type RepoAvatarScan } from '../lib/repoAvatar'
import { AVATAR_MAX_SIDE, avatarFitSize } from '../../../shared/profileAvatar'
import type { Profile, ProfileAvatar as ProfileAvatarSetting } from '../../../shared/types'

/** A repository the avatar can come from: one bound to the profile, else the one open now. */
export interface ProfileRepo {
  path: string
  name: string
  bound: boolean
}

const KIND_KEY: Record<RepoAvatarKind, TranslationKey> = {
  appIcon: 'profileAvatar.kindAppIcon',
  ios: 'profileAvatar.kindIos',
  android: 'profileAvatar.kindAndroid',
  logo: 'profileAvatar.kindLogo',
  image: 'profileAvatar.kindImage'
}

/** The profile's repositories: those bound to it, or — with none bound — the one open now. */
export function useProfileRepos(profileId: string): ProfileRepo[] {
  const repoProfiles = useSettingsStore((s) => s.settings.repoProfiles)
  const aliases = useSettingsStore((s) => s.settings.repoAliases)
  const open = useSettingsStore((s) => s.activeRepo())
  return useMemo(() => {
    const bound = Object.entries(repoProfiles ?? {})
      .filter(([, pid]) => pid === profileId)
      .map(([path]) => ({ path, name: repoDisplayName(path, aliases), bound: true }))
    if (bound.length) return bound.sort((a, b) => a.name.localeCompare(b.name))
    return open ? [{ path: open.path, name: repoDisplayName(open.path, aliases, open.name), bound: false }] : []
  }, [repoProfiles, aliases, open, profileId])
}

// A repository's file list is not free, and the Profile page mounts often: each
// repository is scanned once per session. A failed listing is not cached.
const scans = new Map<string, Promise<RepoAvatarScan>>()

function scanRepo(repoPath: string): Promise<RepoAvatarScan> {
  let scan = scans.get(repoPath)
  if (!scan) {
    scan = gitApi.listFiles(repoPath).then((files) => scanRepoAvatars(files))
    scan.catch(() => scans.delete(repoPath))
    scans.set(repoPath, scan)
  }
  return scan
}

function useRepoScan(repoPath: string | undefined): RepoAvatarScan | null | 'failed' {
  const [scan, setScan] = useState<RepoAvatarScan | null | 'failed'>(null)
  useEffect(() => {
    if (!repoPath) return
    let alive = true
    setScan(null)
    scanRepo(repoPath).then(
      (s) => alive && setScan(s),
      () => alive && setScan('failed')
    )
    return () => {
      alive = false
    }
  }, [repoPath])
  return scan
}

/** Draw any image the browser can show (SVG and WebP included) into a PNG the avatar store accepts. */
function toAvatarPng(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth || AVATAR_MAX_SIDE
      const h = img.naturalHeight || AVATAR_MAX_SIDE
      const fit = avatarFitSize(w, h)
      const canvas = document.createElement('canvas')
      canvas.width = fit.width
      canvas.height = fit.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('no canvas'))
      ctx.drawImage(img, 0, 0, fit.width, fit.height)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('not an image'))
    img.src = dataUrl
  })
}

/** Copy a repository image into the profile. The caller sets the avatar on success. */
function useCopyRepoImage(profile: Profile, onPicked: (avatar: ProfileAvatarSetting) => void) {
  const t = useT()
  const setProfileImage = useProfileAvatarsStore((s) => s.setProfileImage)
  const toast = useUIStore((s) => s.toast)
  const [busy, setBusy] = useState<string | null>(null)
  const copy = async (repo: ProfileRepo, file: string): Promise<void> => {
    setBusy(file)
    try {
      const source = await gitApi.repoImage(repo.path, file).catch(() => null)
      const png = source ? await toAvatarPng(source).catch(() => null) : null
      const result = png ? await setProfileImage(profile.id, png) : 'unreadable'
      if (result === 'picked') {
        onPicked({ source: 'repo', repo: repo.name, file })
        toast('success', t('profileAvatar.repoCopied'))
      } else toast('error', t(result === 'tooLarge' ? 'profileAvatar.imageTooLarge' : 'profileAvatar.imageFailed'))
    } finally {
      setBusy(null)
    }
  }
  return { busy, copy }
}

/** A repository image as a thumbnail, with the size it really has once loaded. */
function RepoThumb({ repoPath, file, size }: { repoPath: string; file: string; size: number }): React.JSX.Element {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void gitApi
      .repoImage(repoPath, file)
      .then((url) => alive && setSrc(url))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [repoPath, file])
  return (
    <span className="repo-avatar-thumb" style={{ width: size, height: size }}>
      {src && <img src={src} alt="" draggable={false} />}
    </span>
  )
}

/** Settings → Profile → Avatar → From a repository. */
export function RepoAvatarPicker({
  profile,
  current,
  onPicked
}: {
  profile: Profile
  current: ProfileAvatarSetting
  onPicked: (avatar: ProfileAvatarSetting) => void
}): React.JSX.Element {
  const t = useT()
  const repos = useProfileRepos(profile.id)
  const [repoPath, setRepoPath] = useState<string | undefined>(repos[0]?.path)
  const repo = repos.find((r) => r.path === repoPath) ?? repos[0]
  const scan = useRepoScan(repo?.path)
  const { busy, copy } = useCopyRepoImage(profile, onPicked)

  if (!repo) return <span className="settings-hint">{t('profileAvatar.repoNone')}</span>

  const ignored = scan && scan !== 'failed' ? scan.ignored : null
  return (
    <div className="repo-avatar-picker">
      <label className="repo-avatar-repo">
        {t('profileAvatar.repoLabel')}
        <select value={repo.path} onChange={(e) => setRepoPath(e.target.value)}>
          {repos.map((r) => (
            <option key={r.path} value={r.path}>
              {interp(t(r.bound ? 'profileAvatar.repoBound' : 'profileAvatar.repoOpen'), { name: r.name })}
            </option>
          ))}
        </select>
      </label>

      {scan === null ? (
        <span className="settings-hint">
          <Loader2 size={12} className="spin" /> {t('profileAvatar.repoLoading')}
        </span>
      ) : scan === 'failed' || scan.candidates.length === 0 ? (
        <span className="settings-hint">{t('profileAvatar.repoNoCandidates')}</span>
      ) : (
        <div className="repo-avatar-candidates">
          {scan.candidates.map((c, i) => {
            const chosen = current.source === 'repo' && current.repo === repo.name && current.file === c.path
            return (
              <button
                key={c.path}
                type="button"
                className={`repo-avatar-candidate${chosen ? ' selected' : ''}`}
                aria-pressed={chosen}
                disabled={busy !== null}
                title={c.path}
                onClick={() => void copy(repo, c.path)}
              >
                <RepoThumb repoPath={repo.path} file={c.path} size={40} />
                <span className="repo-avatar-candidate-text">
                  <strong>
                    {t(KIND_KEY[c.kind])}
                    {busy === c.path && <Loader2 size={12} className="spin" />}
                    {chosen && <Check size={12} />}
                  </strong>
                  <span className="repo-avatar-path">
                    {i === 0 && <em>{t('profileAvatar.mostLikely')} · </em>}
                    {c.path}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {ignored && (ignored.dependencies > 0 || ignored.smallerSizes > 0 || ignored.vectors > 0) && (
        <div className="repo-avatar-ignored">
          {ignored.dependencies > 0 && (
            <span>{interp(t('profileAvatar.ignoredDependencies'), { n: String(ignored.dependencies) })}</span>
          )}
          {ignored.smallerSizes > 0 && (
            <span>{interp(t('profileAvatar.ignoredSmaller'), { n: String(ignored.smallerSizes) })}</span>
          )}
          {ignored.vectors > 0 && <span>{interp(t('profileAvatar.ignoredVectors'), { n: String(ignored.vectors) })}</span>}
        </div>
      )}
    </div>
  )
}

/**
 * On "Automatic": the likeliest icon of the profile's first repository, offered
 * — never applied — with a way to look at the others and a way to stop asking.
 */
export function RepoAvatarSuggestion({
  profile,
  onPicked,
  onChooseAnother,
  onDismiss
}: {
  profile: Profile
  onPicked: (avatar: ProfileAvatarSetting) => void
  onChooseAnother: () => void
  onDismiss: () => void
}): React.JSX.Element | null {
  const t = useT()
  const repos = useProfileRepos(profile.id)
  const repo = repos[0]
  const scan = useRepoScan(repo?.path)
  const { busy, copy } = useCopyRepoImage(profile, onPicked)
  const best = scan && scan !== 'failed' ? scan.candidates[0] : undefined
  if (!repo || !best) return null

  return (
    <div className="repo-avatar-suggest" role="status">
      <RepoThumb repoPath={repo.path} file={best.path} size={36} />
      <span className="repo-avatar-suggest-text">
        <strong>{interp(t('profileAvatar.suggestTitle'), { repo: repo.name })}</strong>
        <span className="repo-avatar-path">{best.path}</span>
      </span>
      <button type="button" className="btn primary small" disabled={busy !== null} onClick={() => void copy(repo, best.path)}>
        {busy ? <Loader2 size={12} className="spin" /> : null} {t('profileAvatar.suggestUse')}
      </button>
      <button type="button" className="btn ghost small" onClick={onChooseAnother}>
        {t('profileAvatar.suggestOther')}
      </button>
      <button type="button" className="btn ghost small" onClick={onDismiss}>
        {t('profileAvatar.suggestDismiss')}
      </button>
    </div>
  )
}
