import { describe, expect, it } from 'vitest'
import { groupByScanRoot, hasScanRoot, scanSummaryMessage } from '../src/renderer/src/lib/scanRoots'
import type { RegistryRepo } from '../src/shared/types'

// Settings → Data → Scanned folders, and "Add scan folder…" on Repositories.

describe('hasScanRoot', () => {
  const roots = [
    { path: '/home/dev/Workspace', depth: 3 },
    { path: 'C:\\Code', depth: 3 }
  ]

  it('spots the same folder however it is spelled', () => {
    expect(hasScanRoot(roots, '/home/dev/Workspace')).toBe(true)
    expect(hasScanRoot(roots, '/home/dev/Workspace/')).toBe(true)
    expect(hasScanRoot(roots, 'c:\\code\\')).toBe(true)
    expect(hasScanRoot(roots, 'C:/Code')).toBe(true)
  })

  it('tells different folders apart, case included where the filesystem does', () => {
    expect(hasScanRoot(roots, '/home/dev/workspace')).toBe(false)
    expect(hasScanRoot(roots, '/home/dev/Workspace/sub')).toBe(false)
    expect(hasScanRoot(roots, '/home/dev')).toBe(false)
    expect(hasScanRoot([], '/')).toBe(false)
    expect(hasScanRoot([{ path: '/', depth: 1 }], '/')).toBe(true)
  })
})

describe('scanSummaryMessage', () => {
  it('leads with every repository found, not only the new ones', () => {
    expect(scanSummaryMessage({ found: 5, added: 0 })).toEqual({
      key: 'repos.scanFound',
      vars: { n: 5, added: 0 }
    })
  })

  it('says plainly when the folders hold no repository', () => {
    expect(scanSummaryMessage({ found: 0, added: 0 }).key).toBe('repos.scanFoundNone')
  })
})

const repo = (path: string, missing = false): RegistryRepo => ({
  path,
  name: path.split('/').pop() ?? path,
  owner: null,
  branch: 'main',
  source: 'scanned',
  lastOpenedAt: 0,
  missing
})

describe('groupByScanRoot', () => {
  it('lists each folder with the repositories under it, by name', () => {
    const groups = groupByScanRoot(
      [
        { path: '/w/alpha', depth: 3 },
        { path: '/w/beta/', depth: 3 }
      ],
      [repo('/w/beta/zed'), repo('/w/alpha/one'), repo('/w/beta/app'), repo('/elsewhere/x')]
    )
    expect(groups.map((g) => [g.root.path, g.repos.map((r) => r.name)])).toEqual([
      ['/w/alpha', ['one']],
      ['/w/beta/', ['app', 'zed']]
    ])
  })

  it('puts a repository under two overlapping folders in the deeper one only', () => {
    const groups = groupByScanRoot(
      [
        { path: '/w', depth: 3 },
        { path: '/w/team', depth: 1 }
      ],
      [repo('/w/team/api'), repo('/w/solo')]
    )
    expect(groups[0].repos.map((r) => r.name)).toEqual(['solo'])
    expect(groups[1].repos.map((r) => r.name)).toEqual(['api'])
  })

  it('does not mistake a sibling with a longer name for a child', () => {
    const groups = groupByScanRoot([{ path: '/w/app', depth: 3 }], [repo('/w/app-old/x'), repo('/w/app')])
    expect(groups[0].repos.map((r) => r.path)).toEqual(['/w/app'])
  })

  it('leaves out a repository whose folder has gone, and keeps an empty folder', () => {
    const groups = groupByScanRoot([{ path: '/w', depth: 3 }, { path: '/empty', depth: 3 }], [repo('/w/gone', true)])
    expect(groups.map((g) => g.repos.length)).toEqual([0, 0])
  })
})
