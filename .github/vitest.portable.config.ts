import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import base from '../vitest.config'

// The slice of the suite that runs on Windows and macOS runners (checks.yml →
// portable). The root config's globalSetup generates the playground with bash
// scripts; on Windows `bash` may resolve to WSL and on macOS it is bash 3.2, so
// the git-backed tests stay Linux-only. What runs here needs no playground and
// no git: pure logic, the i18n parity checks — the code most likely to trip
// over a path separator or a line ending that Linux never shows.
//
// Plain spreads, not mergeConfig: mergeConfig concatenates arrays, and
// globalSetup has to be replaced, not extended.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export default {
  ...base,
  root: ROOT,
  test: {
    ...base.test,
    globalSetup: [],
    include: [
      'test/prFileThreads.test.ts',
      // "← Pull requests" keeps the list's way back to Mission control.
      'test/prListMissionBack.test.ts',
      'test/pureLogic.test.ts',
      // The conflict workspace: unmerged codes, the file strip, picks from the result cards.
      'test/conflictWorkspace.test.ts',
      'test/sidebarFilter.test.ts',
      // Provider drafts, status badges and the masking of provider errors.
      'test/aiAccountDraft.test.ts',
      // What each provider row says under its name.
      'test/aiAccountSummary.test.ts',
      // First-run steps and how each AI card becomes an account.
      'test/onboarding.test.ts',
      'test/commitBody.test.ts',
      // Which lines an edit changed, tinted in the edit-commit editor.
      'test/changedLines.test.ts',
      // The commit editor's change count, cascade rows and "Add file" search.
      'test/commitEditPanel.test.ts',
      // Mission Control's refresh, hosting cadence and release column.
      'test/missionHosting.test.ts',
      'test/fileTree.test.ts',
      'test/prViewed.test.ts',
      // The Conversation tab's timeline, its filters and the last-visit marks.
      'test/prTimeline.test.ts',
      // The Commits tab's summary and type chips; the Files tab's filter and "next unviewed".
      'test/prCommitSummary.test.ts',
      // The PR list page's rows: triage sections, size, new comments, the review column.
      'test/prListRow.test.ts',
      // The list page's Azure file counts: which rows, main's cache by head, the count itself.
      'test/prFileCounts.test.ts',
      'test/i18n.test.ts',
      'test/ciRunsLogic.test.ts',
      // The CI runs overview: workflow cards, quick filters, a running run's progress.
      'test/ciRunsOverview.test.ts',
      // The PR Checks tab: failed tests read from vitest, jest and pytest logs.
      'test/prChecks.test.ts',
      'test/prPickerLogic.test.ts',
      'test/prBranchGo.test.ts',
      'test/markdownEdit.test.ts',
      'test/remoteContent.test.ts',
      'test/externalUrl.test.ts',
      // Remote URLs as written: scp-like, Windows paths and IPv6 hosts alike.
      'test/remoteUrlCredentialsParse.test.ts',
      'test/diff.test.ts',
      'test/lineDiff.test.ts',
      'test/movedLines.test.ts',
      // The tree-sitter grammars reach resources/tree-sitter through the
      // postinstall hook on every OS; this loads each one with the runtime.
      'test/semanticGrammars.test.ts',
      // Settings import/export translate paths between machines — Windows
      // drive letters and separators are exactly what this job is for.
      'test/settingsImport.test.ts',
      'test/settingsExport.test.ts',
      'test/keychainWeakBackend.test.ts',
      'test/keychainFailClosed.test.ts',
      'test/vaultUnreadable.test.ts',
      // The object explorer's trail, its Back/Forward history and identity dates.
      'test/objectExplorer.test.ts'
    ]
  }
}
