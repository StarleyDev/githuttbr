import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// One handbook locale per path segment: docs/help/<code>/<page>.md.
const HELP_LOCALE = /docs\/help\/([a-z]{2}(?:-[A-Za-z]{2,4})?)\//

// Main and preload leave node_modules external — electron-vite's
// `build.externalizeDeps`, on by default since v5, replaces externalizeDepsPlugin.
export default defineConfig({
  main: {
    build: {
      // externalizeDeps only reads `dependencies`, and Rolldown — unlike Rollup —
      // follows a plain `require()`. node-pty is an optional dependency with a
      // native addon loaded by relative path: bundled, it cannot find pty.node and
      // the terminal silently drops to basic shell mode.
      externalizeDeps: { include: ['node-pty'] },
      rolldownOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          // Headless git-textconv entry, run via ELECTRON_RUN_AS_NODE by
          // resources/cli/githuttbr-textconv — must stay electron-free.
          textconvCli: resolve(__dirname, 'src/main/textconvCli.ts'),
          // Headless `githuttbr doctor|status|repos|…`, run the same way by
          // resources/cli/githuttbr — also electron-free.
          cliEntry: resolve(__dirname, 'src/main/cliEntry.ts')
        }
      }
    }
  },
  preload: {},
  renderer: {
    plugins: [react()],
    // Transform the renderer's import graph while main builds and Electron boots,
    // instead of one request at a time once the window asks for it.
    server: { warmup: { clientFiles: ['./src/main.tsx'] } },
    build: {
      rolldownOptions: {
        output: {
          // The translated handbook is one lazy Markdown module per page. Left
          // alone that is 61 chunks per locale — roughly 900 files, each a few
          // kilobytes, for no gain: a reader who opens Help in Japanese wants
          // all of the Japanese pages. Group each locale into one chunk.
          codeSplitting: {
            groups: [
              {
                test: HELP_LOCALE,
                name: (id: string): string | null => {
                  const help = HELP_LOCALE.exec(id)
                  return help ? `help-${help[1]}` : null
                }
              }
            ]
          }
        }
      }
    }
  }
})
