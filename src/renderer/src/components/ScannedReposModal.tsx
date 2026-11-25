import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FolderGit2, FolderSearch } from 'lucide-react'
import { useSettingsStore } from '../stores/settings'
import { useReposStore } from '../stores/repos'
import { useUIStore, type ModalSpec } from '../stores/ui'
import { useT, interp } from '../i18n'
import { groupByScanRoot } from '../lib/scanRoots'
import { isRepositoryOpen } from '../openRepositories'
import { canonicalRepoPath } from '../lib/repoAlias'
import type { GroupTab, RegistryRepo } from '../../../shared/types'
import { ScanRootsEditor } from './ScanRootsEditor'
import { LauncherBack } from './LauncherBack'

/**
 * Everything the scanned folders hold, grouped by folder, to open in one go —
 * or, from a group's launcher, to add to that group. The folder editor sits
 * at the top, opened when there is no folder yet, so an empty list always
 * says what to do next.
 */
export function ScannedReposModal({
  spec
}: {
  spec: Extract<ModalSpec, { kind: 'scanned-repos' }>
}): React.JSX.Element {
  const t = useT()
  const closeModal = useUIStore((s) => s.closeModal)
  const openModal = useUIStore((s) => s.openModal)
  const roots = useSettingsStore((s) => s.settings.repoScanRoots)
  const groupTab = useSettingsStore((s) =>
    spec.groupId
      ? s.settings.tabs.find((tab): tab is GroupTab => tab.id === spec.groupId && tab.kind === 'group')
      : undefined
  )
  const entries = useReposStore((s) => s.entries)
  const scanning = useReposStore((s) => s.scanning)

  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const [manageOpen, setManageOpen] = useState(roots.length === 0)

  // Walk the folders on every open: a repository cloned since the last scan
  // should be here without a trip to Settings. Silent — the list is the answer.
  useEffect(() => {
    const { load, scan } = useReposStore.getState()
    const current = useSettingsStore.getState().settings.repoScanRoots
    void load().then(() => (current.length > 0 ? scan(current) : undefined))
  }, [])

  // Open in a tab, or already in this group: listed, but not offered again.
  const isAlreadyOpen = useMemo(() => {
    if (groupTab) {
      const keys = new Set(groupTab.repos.map((r) => canonicalRepoPath(r.path)))
      return (path: string): boolean => keys.has(canonicalRepoPath(path))
    }
    return isRepositoryOpen
  }, [groupTab])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (r: RegistryRepo): boolean =>
      !q || r.name.toLowerCase().includes(q) || r.path.toLowerCase().includes(q)
    return groupByScanRoot(roots, entries).map((g) => ({ ...g, repos: g.repos.filter(match) }))
  }, [roots, entries, query])

  const total = groups.reduce((n, g) => n + g.repos.length, 0)

  const togglePicked = (path: string): void =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const openRepos = (repos: RegistryRepo[]): void => {
    const refs = repos.map((r) => ({ path: r.path, name: r.name }))
    const st = useSettingsStore.getState()
    if (spec.groupId) {
      for (const ref of refs) st.addRepoToGroup(spec.groupId, ref)
      // Back where it was opened from, which shows what was just added: the
      // group's launcher, or the group's own page behind this dialog.
      if (spec.from === 'launcher') openModal({ kind: 'launcher', groupId: spec.groupId })
      else closeModal()
      return
    }
    closeModal()
    for (const ref of refs) st.openRepoTab(ref)
  }

  const openPickedRepos = (): void => {
    const byPath = new Map(entries.map((r) => [r.path, r]))
    openRepos([...picked].map((p) => byPath.get(p)).filter((r): r is RegistryRepo => !!r && !isAlreadyOpen(r.path)))
  }

  const pickedCount = [...picked].filter((p) => !isAlreadyOpen(p)).length

  return (
    <div className="scanned-root">
      <h3 className="modal-title-row scanned-title">
        {/* A mis-click on "Scanned repositories" should not mean closing and
            reopening Open repository: this goes straight back to it. */}
        {spec.from === 'launcher' && <LauncherBack target={{ groupId: spec.groupId }} />}
        <FolderSearch size={17} /> {t('scanned.title')}
      </h3>
      <p className="modal-hint">
        {groupTab ? interp(t('scanned.introGroup'), { name: groupTab.name }) : t('scanned.intro')}
      </p>

      <div className="scanned-manage">
        <button
          className="scanned-manage-toggle"
          aria-expanded={manageOpen}
          onClick={() => setManageOpen((v) => !v)}
        >
          {manageOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          {interp(t('scanned.manage'), { n: roots.length })}
        </button>
        {manageOpen && <ScanRootsEditor />}
      </div>

      {roots.length === 0 ? (
        <p className="scanned-empty">{t('scanned.noRoots')}</p>
      ) : (
        <>
          <input
            className="scanned-filter"
            value={query}
            placeholder={t('scanned.filter')}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="scanned-list">
            {query.trim() && total === 0 ? (
              <p className="scanned-empty">{interp(t('scanned.noMatches'), { query: query.trim() })}</p>
            ) : (
              groups.map((g) => (
                <section key={g.root.path} className="scanned-group">
                  <div className="scanned-group-head" title={g.root.path}>
                    <span className="scanned-group-path">{g.root.path}</span>
                    <span className="scanned-group-count">{interp(t('repos.wsCount'), { n: g.repos.length })}</span>
                  </div>
                  {g.repos.length === 0 ? (
                    <p className="scanned-empty">{scanning ? t('repos.scanning') : t('scanned.emptyRoot')}</p>
                  ) : (
                    g.repos.map((r) => {
                      const isTaken = isAlreadyOpen(r.path)
                      return (
                        <label
                          key={r.path}
                          className={`scanned-row${isTaken ? ' scanned-taken' : ''}`}
                          onDoubleClick={() => !isTaken && openRepos([r])}
                        >
                          <input
                            type="checkbox"
                            disabled={isTaken}
                            checked={isTaken || picked.has(r.path)}
                            onChange={() => togglePicked(r.path)}
                          />
                          <FolderGit2 size={13} className="scanned-row-icon" />
                          <span className="scanned-row-info">
                            <strong>{r.name}</strong>
                            <span>{r.path}</span>
                          </span>
                          {isTaken ? (
                            <span className="scanned-row-note">
                              {groupTab ? t('scanned.inGroup') : t('scanned.alreadyOpen')}
                            </span>
                          ) : (
                            r.branch && <span className="scanned-row-branch">{r.branch}</span>
                          )}
                        </label>
                      )
                    })
                  )}
                </section>
              ))
            )}
          </div>
        </>
      )}

      <div className="modal-actions">
        <button className="btn ghost" onClick={closeModal}>
          {t('common.cancel')}
        </button>
        <button className="btn primary" disabled={pickedCount === 0} onClick={openPickedRepos}>
          {interp(t(spec.groupId ? 'scanned.addToGroup' : 'scanned.open'), { n: pickedCount })}
        </button>
      </div>
    </div>
  )
}
