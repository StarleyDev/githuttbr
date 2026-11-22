import { defineConfig } from 'vitest/config'

// The end-to-end smoke suite: drives the real built app with Playwright.
// Deliberately apart from vitest.config.ts — it needs a display and a fresh
// `npm run build`, and the gate (`npm test`) stays fast and display-free.
// Run with `npm run test:e2e`; see test/e2e/README.md.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/e2e/**/*.e2e.ts'],
    globalSetup: ['./test/e2e/global-setup.ts'],
    // Each case launches its own Electron, one after another: several instances
    // sharing a software rasterizer on a CI runner is how timing flakes start.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000
  }
})
