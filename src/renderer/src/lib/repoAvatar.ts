import { isImagePath } from './repoImage'

// Which of a repository's images could be the profile's picture — the
// company's or the app's icon. Pure: the caller hands in `git ls-files`.
//
// Mobile projects are the hard case: an iOS AppIcon.appiconset holds a file per
// size, an Android project one launcher icon per screen density, and the
// dependency folders bring other people's icons. Each set collapses to its
// largest member, dependencies never count, and what was left out is counted
// so the picker can say why an expected file is not listed.

export type RepoAvatarKind = 'appIcon' | 'ios' | 'android' | 'logo' | 'image'

export interface RepoAvatarCandidate {
  path: string
  kind: RepoAvatarKind
}

export interface RepoAvatarScan {
  candidates: RepoAvatarCandidate[]
  ignored: {
    /** Images inside dependency or build folders. */
    dependencies: number
    /** Smaller copies of an icon already listed at its largest size. */
    smallerSizes: number
    /** Launcher icons that are vector XML, not images. */
    vectors: number
  }
}

const DEPENDENCY_DIR =
  /(^|\/)(node_modules|Pods|Carthage|build|dist|out|vendor|DerivedData|\.gradle|\.dart_tool|bower_components)\//
// The icon of the app itself: icon.png, app-icon.png, AppIcon.png, icon@2x.png.
const APP_ICON_NAME = /^(app[-_]?)?icon(@\dx)?\.[a-z]+$/i
const LOGO_NAME = /(logo|brand|emblem|mark)/i
const OTHER_ICONISH = /(icon|favicon|avatar|badge)/i
// The density folder may carry an API-level qualifier: mipmap-anydpi-v26.
const ANDROID_RES = /\/res\/(mipmap|drawable)-([a-z]+dpi)(?:-v\d+)?\/([^/]+)$/
const ANDROID_DENSITIES = ['xxxhdpi', 'xxhdpi', 'xhdpi', 'hdpi', 'mdpi', 'ldpi']
const LAUNCHER = /^ic_launcher/

const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)
const depth = (path: string): number => path.split('/').length

/** The size a file name advertises: `Icon-1024.png` → 1024, `icon-60@3x.png` → 180. */
function advertisedSize(name: string): number {
  const numbers = (name.match(/\d+/g) ?? []).map(Number)
  const scale = /@3x/i.test(name) ? 3 : /@2x/i.test(name) ? 2 : 1
  return numbers.length ? Math.max(...numbers.filter((n) => n < 4096 || numbers.length === 1)) * scale : 0
}

export function scanRepoAvatars(files: string[], limit = 12): RepoAvatarScan {
  const ignored = { dependencies: 0, smallerSizes: 0, vectors: 0 }
  const scored: { candidate: RepoAvatarCandidate; score: number }[] = []
  // Largest member so far of each icon set, keyed by the set.
  const iosSets = new Map<string, string>()
  const androidSets = new Map<string, { path: string; rank: number }>()

  for (const path of files) {
    const name = baseName(path)
    const android = ANDROID_RES.exec(path)
    if (android && name.endsWith('.xml') && LAUNCHER.test(name)) {
      if (!DEPENDENCY_DIR.test(path)) ignored.vectors++
      continue
    }
    if (!isImagePath(path)) continue
    if (DEPENDENCY_DIR.test(path)) {
      ignored.dependencies++
      continue
    }

    const iconSet = path.match(/^(.*\.appiconset)\//)?.[1]
    if (iconSet) {
      const kept = iosSets.get(iconSet)
      if (kept) ignored.smallerSizes++
      if (!kept || advertisedSize(name) > advertisedSize(baseName(kept))) iosSets.set(iconSet, path)
      continue
    }

    if (android && LAUNCHER.test(name)) {
      // One set per module and file name: ic_launcher and ic_launcher_round are two.
      const key = `${path.slice(0, path.indexOf('/res/'))}|${name}`
      const rank = ANDROID_DENSITIES.indexOf(android[2])
      const kept = androidSets.get(key)
      if (kept) ignored.smallerSizes++
      if (!kept || (rank !== -1 && (kept.rank === -1 || rank < kept.rank))) androidSets.set(key, { path, rank })
      continue
    }

    if (APP_ICON_NAME.test(name)) scored.push({ candidate: { path, kind: 'appIcon' }, score: depth(path) })
    else if (LOGO_NAME.test(name)) scored.push({ candidate: { path, kind: 'logo' }, score: 300 + depth(path) })
    else if (OTHER_ICONISH.test(name))
      scored.push({ candidate: { path, kind: 'image' }, score: (/\.ico$/i.test(name) ? 450 : 400) + depth(path) })
  }

  for (const path of iosSets.values()) scored.push({ candidate: { path, kind: 'ios' }, score: 100 + depth(path) })
  for (const { path } of androidSets.values()) {
    const name = baseName(path)
    // The plain launcher icon first; the round and adaptive layers after it.
    const variant = /_round/.test(name) ? 5 : /_(foreground|background|monochrome)/.test(name) ? 10 : 0
    scored.push({ candidate: { path, kind: 'android' }, score: 200 + variant + depth(path) })
  }

  scored.sort((a, b) => a.score - b.score || a.candidate.path.localeCompare(b.candidate.path))
  return { candidates: scored.slice(0, limit).map((s) => s.candidate), ignored }
}
