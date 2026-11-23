# End-to-end smoke suite

A handful of checks against the **real built app**, driven by Playwright — the
things a change used to end with as "someone open the app and look":

| Case | Asserts |
|------|---------|
| Boot | The playground repo's commits are all drawn as graph rows (subjects match `git log --all`), the store loaded the same count, no error boundary, nothing logged at error level, no network request but the avatar lookups |
| Portuguese cold start | The first frame with any copy in it already shows the toolbar in Portuguese, with none of the English labels |
| Arabic cold start | `dir="rtl"` on that first frame, and `lang="ar"` after boot |
| Runtime switch | Switching to German through the settings store relabels the toolbar; no visible text or `title`/`aria-label`/`placeholder` equals a raw translation key or holds an unfilled `{placeholder}` |
| Lazy views | The 3D cosmos view and the Licenses page mount, their chunks (absent at startup) load from `file://`, no error boundary or scene error |
| Clone tray | Tasks seeded through the shot bridge render with their names, progress and queued state |

```bash
npm run build       # the suite drives out/, so build first
npm run test:e2e
```

It is **not** part of `npm test`: it needs a display and a fresh build, and the
gate stays fast and display-free. The global setup refuses to run against a
missing build, or one older than `src/` (`E2E_ALLOW_STALE=1` overrides), so a
pass never describes code that is no longer there. CI runs it in
`.github/workflows/e2e.yml` under `xvfb-run`.

## Displays

- **Linux without a desktop** (CI): `xvfb-run -a npm run test:e2e`.
- **A Wayland desktop**: run through XWayland, as the screenshot harness does:
  `env -u WAYLAND_DISPLAY SHOT_ELECTRON_ARGS=--ozone-platform=x11 npm run test:e2e`.
  Windows appear briefly while it runs.

## How a case launches the app

`app.ts` launches through the same harness as the screenshots
(`examples/screenshots/harness.mjs`): `--shot` (which attaches the
`window.__shot` store bridge), a throwaway userData dir with a seeded settings
file, the keychain question answered "declined" in advance. On top of that,
each case isolates the machine:

- The repo is a **private copy** of a playground scenario, so the app never
  touches the repos `npm test` reads.
- `HOME`, the XDG dirs, `GIT_CONFIG_GLOBAL` and `GITHUTTBR_SSH_DIR` point into a
  temp dir; `GIT_CONFIG_NOSYSTEM=1`. Nothing reads `~/.ssh`, `~/.gitconfig` or
  the keyring.
- The profile has no tokens and AI off, and every `http(s)` request is answered
  locally with a 404 — the test runs offline and sends nothing anywhere.
- WebGL runs on SwiftShader (CPU), so the cosmos view works without a GPU.

## Console allow-list

Every `console.error` and uncaught page error fails the case, except what
`BENIGN_CONSOLE` in `app.ts` names, each with its reason. Today that is one
entry: Chromium logs the 404 that gravatar answers for an author with no
picture, which `Avatar.tsx` asks for on purpose (`d=404`) before falling back to
the generated avatar. Keep additions narrow — a pattern broad enough to swallow
a real failure defeats the suite.

## Adding a case

Add an `it` to `smoke.e2e.ts`: `start()` a fresh app, drive it through
`window.__shot` (the stores — see `src/renderer/src/lib/shotBridge.ts`), assert
on the DOM, and end with `expect(r.errors()).toEqual([])`. Compare against the
dictionaries (`en`, `ptBR`, …) rather than hard-coded copy, so a wording change
does not break the suite. Keep it a smoke test: one launch per case, seconds
each; behaviour with real git belongs in the unit suite.
