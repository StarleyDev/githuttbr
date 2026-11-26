import { describe, it, expect, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { configKeyMatcher, isSafeConfigKey } from '@simple-git/argv-parser'
import { gitService, APP_CONFIG_KEYS } from '../src/main/git'
import { cloneFixture, cleanupFixtures } from './fixtures'

afterAll(() => cleanupFixtures())

// simple-git 4 warns on a config write outside its safe list and its next major refuses it.
// These keys are the app's own features, so the allow-list has to keep covering them — and
// must not grow into a pattern that also lets through a key git would execute.
const allowed = configKeyMatcher(APP_CONFIG_KEYS)
const permitted = (key: string): boolean => isSafeConfigKey(key) || allowed(key)

describe('simple-git allowConfig', () => {
  it('covers every config key gitService writes through simple-git', () => {
    for (const key of [
      'branch.feature/api.githuttbrParent',
      'branch.main.githuttbrbase',
      'githuttbr.protectedbranches',
      'githuttbr.subtree.vendor%2Fparser.url',
      'githuttbr.subtree.vendor%2Fparser.ref',
      'githuttbr.prepurge.at1795382730',
      'gitflow.branch.master',
      'gitflow.prefix.versiontag',
      'rerere.autoUpdate',
      'rerere.enabled',
      'commit.gpgsign',
      'gpg.format',
      'user.signingkey',
      'submodule.vendor/lib.url',
      'user.name'
    ]) {
      expect(permitted(key), key).toBe(true)
    }
  })

  it("does not reach upstream Gitcito's keys: this app never writes them", () => {
    for (const key of [
      'branch.feature/api.gitcitoparent',
      'branch.main.gitcitobase',
      'gitcito.protectedbranches',
      'gitcito.subtree.vendor%2Fparser.url',
      'gitcito.prepurge.at1795382730'
    ]) {
      expect(allowed(key), key).toBe(false)
    }
  })

  it('does not reach keys that run a program or locate one', () => {
    for (const key of ['submodule.vendor/lib.update', 'gitflow.path.hooks', 'core.sshCommand', 'gpg.program']) {
      expect(allowed(key), key).toBe(false)
    }
  })

  it('emits no SIMPLE_GIT_UNLISTED_CONFIG warning while the app writes its own config', async () => {
    const R = cloneFixture('stacked-branches')
    const codes: string[] = []
    const onWarning = (w: Error & { code?: string }): void => {
      if (w.code) codes.push(w.code)
    }
    process.on('warning', onWarning)
    try {
      const branch = execFileSync('git', ['-C', R, 'branch', '--show-current'], { encoding: 'utf8' }).trim()
      execFileSync('git', ['-C', R, 'branch', 'allow-config-child'])
      await gitService.stackSetParent(R, 'allow-config-child', branch)
      await gitService.setProtectedBranches(R, [branch])
      await gitService.setRerere(R, { enabled: false, autoUpdate: true }, 'repo')
      await gitService.setSigningConfig(R, { sign: false, format: 'openpgp', key: 'ABCDEF' })
      await gitService.gitflowInit(R, {
        main: branch,
        develop: 'develop',
        featurePrefix: 'feature/',
        releasePrefix: 'release/',
        hotfixPrefix: 'hotfix/',
        versionTagPrefix: 'v'
      })
      // process.emitWarning dispatches on the next tick.
      await new Promise((resolve) => setImmediate(resolve))
    } finally {
      process.off('warning', onWarning)
    }
    expect(codes.filter((c) => c === 'SIMPLE_GIT_UNLISTED_CONFIG')).toEqual([])
  })
})
