import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['./test/setup/global-setup.ts'],
    // Each test runs real git against the playground repos.
    testTimeout: 20_000,
    // First run may regenerate the whole playground (~a few seconds).
    hookTimeout: 180_000,
    // Vitest 5 turned this on by default. Off keeps a mock's call history across
    // tests in a file, as every test here was written against.
    clearMocks: false
  },
  resolve: {
    alias: {
      // Resolve the bare `electron` import in src/main/git.ts to a stub.
      electron: resolve(HERE, 'test/stubs/electron.ts')
    }
  }
})
