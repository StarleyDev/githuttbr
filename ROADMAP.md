# Roadmap

What GitHuttBr might do next, and why. Nothing here is a promise — it is the
shortlist, kept honest about cost and about what each item actually buys.

Two sources feed it: gaps against other clients (GitKraken, Fork, Tower,
SourceTree, Sublime Merge), and **[Pro Git](https://git-scm.com/book/en/v2)** —
the parts of git the book teaches that no client surfaces. Shipped items leave
this file; what is here is what is not built yet.

Ideas are welcome as [issues](https://github.com/StarleyDev/githuttbr/issues).

---

## Near term

### Windows code signing
The release workflow already builds and publishes Windows and Linux — unsigned.
An unsigned Windows build hits the SmartScreen wall on first run. The CI change
is about fifteen lines; the blocker is a certificate, and the only option that
buys immediate reputation for a project this size is Azure Trusted Signing.

### A helper binary, so RunAsNode can go
The `githuttbr` command, the bundled diff converter and the credential helper all
run the app's own executable as Node (`ELECTRON_RUN_AS_NODE`), which is why the
RunAsNode fuse stays on. On Linux that makes the `.deb`'s AppArmor profile —
unconfined, user namespaces allowed, attached to that executable — available to
any local program that wants a Node interpreter with `userns`
([security](docs/help/security.md)). A small separate helper (Node SEA or a
native shim) for those three would let the fuse go off and the profile cover
only the browser. The cost is a second binary to sign, notarize and keep in
step with the app on three platforms.

### Issue trackers beyond GitHub
Branch-from-issue and smart commits against Jira or Linear. Both are what teams
actually run, and both mean another token and another API surface.

### Running tests, beyond vitest and jest
The [Tests tab](docs/help/problems.md#tests) already runs a vitest or jest suite
from its machine report and turns it into a tree, with a click from a failure to
the line that failed. What is left is the rest of the adapter table — every
runner worth targeting can emit machine-readable output (`flutter test
--machine`, `go test -json`, `cargo nextest`, junit-xml for the rest) — and a
monorepo's per-package suites.

What would make it GitHuttBr's rather than an IDE's: running only the tests that
cover what you changed, before the commit, and hanging the verdict off the
commit the way local CI already does. The cost is honest — an adapter per
runner, and a promise to keep them working across runner versions.

### A real debugger
Breakpoints, stepping, variables. Doing it properly means a Debug Adapter
Protocol client — launch the adapter, capabilities, breakpoints, stack frames,
scopes, evaluate — plus an adapter per language (`dart debug_adapter`,
vscode-js-debug, debugpy, `dlv dap`, codelldb). It is the largest single item
on this list, and today the handbook says plainly that GitHuttBr is not a
debugger.

If it happens: one adapter first (Dart, because it ships with the SDK), with
the protocol layer written generic, and no second language until the first one
is genuinely pleasant.

### A device preview
Choosing the device a launch runs on already ships ([run target](docs/help/launch.md#run-target--which-device-a-config-launches-on));
showing it is the open part. For web, this is small: the dev server's URL is already detected for
`serverReadyAction`, so a preview pane is a webview pointed at it.

For mobile it is not. No API embeds an iOS Simulator or an Android emulator
window inside an Electron app. The alternatives are worse than they sound: a
screenshot mirror (`adb exec-out screencap`, `simctl io screenshot`) is laggy
and cannot be touched, and `scrcpy` is genuinely good but is its own window —
at best GitHuttBr could launch it, not contain it. A laggy mirror that looks like
a device but does not behave like one is not worth shipping.

---

## Keeping the platform current

Not features, but they decide when features can ship. Electron supports its
three newest majors, so staying current is a schedule, not a choice.

### Keychain calls on the asynchronous API — before Electron 46
GitHuttBr moved to Electron 45 in v4.50. Its synchronous `safeStorage` calls —
the ones that encrypt tokens, AI keys and the Vault — are deprecated there and
removed in Electron 46, so moving them to the asynchronous API has to land
before that upgrade. It touches the most sensitive path in the app (reading,
writing and migrating every saved secret), so it ships on its own, with tests
for the unreadable-store and no-keyring cases, not folded into a version bump.

### The semantic diff's grammars, rebuilt
The semantic diff parses with web-tree-sitter 0.24 and 18 prebuilt grammars.
Newer web-tree-sitter releases cannot load those grammars — they were built in
an older WebAssembly format — so upgrading means building the grammars here
with tree-sitter's own CLI instead of taking a prebuilt bundle. More work up
front; in exchange, a grammar can be updated or added without waiting on a
third-party package.

### xterm.js 6
The integrated terminal is on xterm.js 5. Version 6 and its addons move
together (the fit addon measures the scrollbar differently), so they are one
change, tested against resizing, links and the shell-integration marks.

### Larger dependency moves, when there is a reason
React 19, zustand 5, framer-motion and lucide's 1.x icon names each touch most
of the renderer and none fixes a problem today. They wait for a feature that
needs them or a security reason, rather than being done for the version number.

---

## Deliberately not doing

- **Cloud workspaces, telemetry, shared team boards.** GitHuttBr has no backend
  and phones nothing home. That is a feature, and these would end it.
- **Hosting our own git implementation.** GitHuttBr drives the real `git`. A bug
  in git is a bug you can reproduce in a terminal, and that is worth more than
  any speed-up.
- **A plugin system**, until the core is finished. An extension API freezes
  internals that still need to move.

---

## How something gets here

Any of: it closes a gap another client has and users hit; the book teaches it and
git already does it; or it removes a reason to drop into a terminal. Cost and
limits get written down at the same time as the idea — a roadmap that only lists
upside is a wish list.
