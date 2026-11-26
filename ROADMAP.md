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

### Reviewing a pull request like on the host
The pull request page now covers most of a review: line comments, editing and
deleting your own, rendered comments, the files as a tree, updates per push and
image diffs. What is still missing:

- **A review in one go.** Comments on several lines held as a pending review and
  sent together with Approve or Request changes, and comments on a range of
  lines. Every host has the idea; each spells it differently, and GitHub,
  GitLab and Azure disagree on when a pending comment becomes visible.
- **Images and files in a comment.** Pasting a screenshot into a comment needs
  each host's upload API. GitHub has no public one for comment attachments,
  so this would work on GitLab, Azure and Forgejo and not on the host most
  people use — which is why it has waited.
- **bitbucket.org.** It has pull request lists and checks in the app, but no
  pull request page: the API calls exist, the page does not.

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

### Electron 46, and the keychain key it changes
Electron 46 removes the synchronous `safeStorage` calls the token store and the
vault are read and written with. The asynchronous ones can take a different
key on Linux — under KDE they go through the secret portal — so the move is a
migration, not a rename: re-seal every store under the new key, keep a copy
under the old one for a rollback, and prove it on real data from the previous
release on KDE, GNOME, macOS and Windows. Mocked tests did not catch the key
change in v4.52.0; they will not catch this one either.

### A smaller installer
Libraries the interface uses are bundled by Vite into the renderer, yet still
ship again as runtime dependencies. Moving them to `devDependencies` should cut
50–70 MB from each package. The cost is a careful check of the packaged
`app.asar` and an install test of every package type, so it gets its own
release.

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
