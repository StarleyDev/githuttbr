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
      'test/pureLogic.test.ts',
      'test/i18n.test.ts',
      'test/ciRunsLogic.test.ts',
      'test/prPickerLogic.test.ts',
      'test/prBranchGo.test.ts',
      'test/markdownEdit.test.ts',
      'test/externalUrl.test.ts',
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
      'test/vaultUnreadable.test.ts'
    ]
  }
}
