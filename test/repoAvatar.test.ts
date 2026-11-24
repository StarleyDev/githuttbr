import { describe, expect, it } from 'vitest'
import { scanRepoAvatars } from '../src/renderer/src/lib/repoAvatar'
import { hasStoredImage, validProfileAvatar } from '../src/shared/profileAvatar'

// Settings → Profile → Avatar → From a repository.

const mobile = [
  'Resources/icon.png',
  'ios/MyApp/Images.xcassets/AppIcon.appiconset/Icon-20.png',
  'ios/MyApp/Images.xcassets/AppIcon.appiconset/Icon-60@3x.png',
  'ios/MyApp/Images.xcassets/AppIcon.appiconset/Icon-1024.png',
  'ios/MyApp/Images.xcassets/AppIcon.appiconset/Contents.json',
  'android/app/src/main/res/mipmap-mdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml',
  'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png',
  'assets/images/logo.png',
  'assets/images/screenshot-home.png',
  'ios/Pods/SomeKit/Assets/icon.png',
  'node_modules/lib/logo.svg',
  'src/App.tsx'
]

describe('scanRepoAvatars', () => {
  it('puts the app icon first, then each icon set at its largest size', () => {
    const { candidates } = scanRepoAvatars(mobile)
    expect(candidates.map((c) => [c.kind, c.path])).toEqual([
      ['appIcon', 'Resources/icon.png'],
      ['ios', 'ios/MyApp/Images.xcassets/AppIcon.appiconset/Icon-1024.png'],
      ['android', 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'],
      ['android', 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png'],
      ['logo', 'assets/images/logo.png']
    ])
  })

  it('says what it left out and why', () => {
    expect(scanRepoAvatars(mobile).ignored).toEqual({ dependencies: 2, smallerSizes: 4, vectors: 1 })
  })

  it('never offers an image that only happens to be in the repository', () => {
    expect(scanRepoAvatars(['docs/diagram.png', 'screens/home.jpg']).candidates).toEqual([])
  })

  it('reads @3x as three times the advertised size', () => {
    const { candidates } = scanRepoAvatars([
      'App/AppIcon.appiconset/icon-60@3x.png',
      'App/AppIcon.appiconset/icon-152.png'
    ])
    expect(candidates[0].path).toBe('App/AppIcon.appiconset/icon-60@3x.png')
  })
})

describe('repository avatar setting', () => {
  it('keeps where the picture came from, and counts as a stored image', () => {
    const avatar = validProfileAvatar({ source: 'repo', repo: 'my-app', file: 'Resources/icon.png' })
    expect(avatar).toEqual({ source: 'repo', repo: 'my-app', file: 'Resources/icon.png' })
    expect(hasStoredImage(avatar)).toBe(true)
    expect(hasStoredImage({ source: 'icon', icon: 'user', color: '#000000' })).toBe(false)
  })

  it('falls back to the stored image when the origin is malformed', () => {
    expect(validProfileAvatar({ source: 'repo', repo: '', file: 'x.png' })).toEqual({ source: 'image' })
    expect(validProfileAvatar({ source: 'repo', repo: 'a\nb', file: 'x.png' })).toEqual({ source: 'image' })
  })
})
