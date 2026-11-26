import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './helpers'

// GitHuttBr is its own product. The name of the app it was derived from may
// appear only where it has to: the legal attribution, the release history, the
// code and tests that prove that app's data is left alone, and the few read-only
// fallbacks for data this app itself wrote under the inherited name. Anything
// else is a leftover. A line that has to name it says why with an
// `upstream-name:` comment on the same line.

const NAME = /gitcito|git&#99;ito|GIT&#67;ITO/i
const MARKER = 'upstream-name'

/** Whole files, each with the reason it has to name the other app. */
const ALLOWED_FILES: Record<string, string> = {
  NOTICE: 'legal attribution, kept with every copy',
  'CHANGELOG.md': 'release history, never rewritten',
  'test/noUpstreamName.test.ts': 'this guard',
  'test/upstreamIgnored.test.ts': "plants the other app's data and proves it is ignored",
  'test/nsisUpgrade.test.ts': 'pins the old appId the Windows upgrade looks for',
  'build/installer.nsh': 'the old appId GUID, and the rule never to touch that app',
  'src/main/legacyShims.ts': "recognises this app's own pre-4.39 converter by its old file name",
  'test/legacyShims.test.ts': "this app's old converter paths, and the other app's",
  'test/legacyTextconv.test.ts': "this app's old converter paths, and the other app's",
  'test/cliConfig.test.ts': "proves the CLI ignores the other app's repository config and editor",
  'test/simpleGitAllowConfig.test.ts': "proves the other app's config keys are not reachable",
  'test/repoConfig.test.ts': "proves the other app's repository config is not read",
  'test/packagingHardening.test.ts': 'proves the packages no longer claim the other app',
  'docs/help/upgrading.md': 'the page about updating across the identity change and living beside that app'
}

function trackedTextFiles(): string[] {
  // -I skips binaries; -l lists only the files that match at all.
  const out = execFileSync('git', ['-C', ROOT, 'grep', '--untracked', '-I', '-l', '-i', '-E', NAME.source], { encoding: 'utf8' })
  return out.split('\n').filter(Boolean)
}

describe("the upstream app's name", () => {
  it('appears only in the allowlisted files and on marked lines', () => {
    let files: string[] = []
    try {
      files = trackedTextFiles()
    } catch {
      files = [] // git grep exits 1 when nothing matches
    }
    const leftovers: string[] = []
    for (const file of files) {
      if (file in ALLOWED_FILES) continue
      readFileSync(join(ROOT, file), 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (NAME.test(line) && !line.includes(MARKER)) leftovers.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`)
        })
    }
    expect(leftovers).toEqual([])
  })

  it('every allowlisted file still exists and still needs the exception', () => {
    const files = new Set(trackedTextFiles())
    for (const file of Object.keys(ALLOWED_FILES)) expect(files.has(file), file).toBe(true)
  })
})
