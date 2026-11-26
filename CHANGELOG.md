

## [4.59.0](https://github.com/StarleyDev/githuttbr/compare/v4.58.0...v4.59.0) (2026-11-26)

### Bug Fixes

* **identity:** ship as its own app, with its own identifier ([4c7db95](https://github.com/StarleyDev/githuttbr/commit/4c7db9569e1b3242bad7da5714328cc7ec94068b))
  - The app identifier is now com.huttbr.git. Settings, tokens and repositories stay where they are: the data folder and the keychain entry keep the GitHuttBr name.
  - On Windows the installer removes the previous GitHuttBr install before copying the new files, so one entry is left; an unrelated app is never touched. An upgrade test installs the last release and this build on top.
  - The .deb and .rpm no longer replace, conflict with or provide another package, and the first run no longer imports another app's data.
  - Every text says GitHuttBr: the UI in 16 languages, the handbook and the site. A test keeps the old name from coming back.
  - The notes of this release open with what to do if the automatic update fails: download the version from the site, or uninstall and reinstall.
  - macOS may ask once for the password so the app can read its saved tokens.
* **release:** stage the enriched changelog before the release commit ([31f686d](https://github.com/StarleyDev/githuttbr/commit/31f686d20f57d9244587c56be621d919093df7b8))

## [4.58.0](https://github.com/StarleyDev/githuttbr/compare/v4.57.0...v4.58.0) (2026-11-26)

### Features

* **pr:** image diffs, every file's diff, and a page that keeps your place ([646763f](https://github.com/StarleyDev/githuttbr/commit/646763f302ef299d3c7ef65672e0c2f4e426af38))
  - Images in a pull request's Files tab show before and after, as in a commit, read from this clone first and from the host otherwise; Git LFS pointers are recognised instead of drawn as a broken image.
  - Every changed file gets its diff, however large the pull request: it is computed here from the two commits (fetched once, quietly, within 20 s when missing), and the host's API is only the fallback. A file without a diff says why, and its counts show a dash instead of +0 -0.
  - Leaving a pull request and coming back returns to the same tab, file and scroll, with every unsent comment, reply and edit still there.
  - A changed file can be copied by path, old path or folder, opened in your editor or shown in its folder; Devin Desktop joins the editors, found through the Linux application menu.
  - Text in legacy encodings and accented file names show correctly.
  - The changelog and release notes list each release's items, not one line.

## [4.57.0](https://github.com/StarleyDev/githuttbr/compare/v4.56.0...v4.57.0) (2026-11-26)

### Features

* **remotes:** spot a password saved in a remote URL and offer to remove it ([cddfb21](https://github.com/StarleyDev/githuttbr/commit/cddfb21d1acb07ac2c06488d853fd0826e10d2df))
  - A password or token saved in a remote URL wins over the profile's token, and an old one fails every fetch and push with "Invalid username or token". On that failure the app now says why and offers to remove it from the URL; the sidebar marks such a remote with a key.
  - Removal asks first, says what changes, warns when the profile has no token for that host (with a way to add one first), and has no undo on purpose: undoing would write the secret back in plain text.
  - The password no longer reaches the window: copying a remote URL, the edit dialog, web links, the workspace export, the sign-in status, subtree URLs and the repository owner all saw it before.
  - Renaming a remote keeps its URLs as they are, never copying a password from a global insteadOf rule or overwriting a separate push URL.

## [4.56.0](https://github.com/StarleyDev/githuttbr/compare/v4.55.0...v4.56.0) (2026-11-26)

### Features

* **pr:** an Updates tab that shows each push to a pull request ([f2e4cc8](https://github.com/StarleyDev/githuttbr/commit/f2e4cc80826d8763a98b36002fd15be29ac3e91a))
  - The pull request page has an Updates tab: every push, newest first, with its date, who pushed and the commits it added or removed; a force push or rebase is marked as history rewritten, and a retarget on Azure as such.
  - "View changes in this update" shows only what that push changed, compared here from its two heads (fetched by id when missing), and says so when it has to fall back to the host's comparison from the common base.
  - Updates that arrived since your last visit carry a New badge.
  - Azure, GitLab and Bitbucket Data Center report pushes natively; on GitHub and Forgejo they are inferred from the commits, and the tab says so.
  - Every diff the app reads now forces the a/ and b/ prefixes, so a global diff.noprefix no longer hides added and binary files.

## [4.55.0](https://github.com/StarleyDev/githuttbr/compare/v4.54.0...v4.55.0) (2026-11-26)

### Features

* **pr:** show comments formatted, and close the pull request gaps ([6c37fda](https://github.com/StarleyDev/githuttbr/commit/6c37fdac17e7dcf35450b625adc346ef254a310b))
  - Pull request and issue comments render as Markdown through a strict profile: no scripts, styles or forms, web and mail links only. Images from other sites wait for a click (a setting in Security can load them always), GitHub comments use GitHub's own HTML, and a very long or deeply nested comment falls back to plain text instead of stalling the window.
  - The editor's Preview matches what the comment will look like once posted.
  - Replying works on a GitHub review thread whose first comment was deleted, and warns when the reply lands in a pending review.
  - A fork pull request's commits can be fetched into a private ref the graph shows, never into a branch name.
  - On Azure, your comments are recognised by account id or sign-in name.
  - Page headers no longer slide up before they pin.
  - The handbook pages for workspaces, branch cleanup, pull requests and security are current in every language.

## [4.54.0](https://github.com/StarleyDev/githuttbr/compare/v4.53.0...v4.54.0) (2026-11-26)

### Features

* **pr:** review pull requests in the app, and clean up local branches ([3894593](https://github.com/StarleyDev/githuttbr/commit/3894593569ed2c30c62973209b9f5ac9ce01de43))
  - Pull requests: comment on a line of the diff, edit and delete your own comments, a Commits tab, the files as a tree with viewed marks that reset when a push changes a file, a count of conversations per file, and cards with the title of #⁠123 / AB#⁠123 references. The page uses the whole tab.
  - Every comment box is a Markdown editor: toolbar, shortcuts, Write/Preview, @mentions and #references, buttons on the right.
  - Tools → Clean up local branches: gone, merged and squash-merged branches, never one whose commits exist nowhere else without a red confirm; undoable.
  - Page headers and dialog buttons stay in view while the body scrolls; page chips carry a word; PR icons follow the icon colours setting.
  - The window never navigates away from the app, and only web and mail links open outside it.

## [4.53.0](https://github.com/StarleyDev/githuttbr/compare/v4.52.1...v4.53.0) (2026-11-25)

### Features

* **pr:** go to a pull request's branches, and right-click in text fields ([a679cc4](https://github.com/StarleyDev/githuttbr/commit/a679cc498f04576137aae0e06cb78c0a8baae31f))
  - From a pull request, "Go to source branch" and "Go to target branch" (header buttons and links in the Branches field) check the branch out and open the repository on it. A branch that only exists on the server is fetched alone, never the whole remote. A copy button sits next to each name, fork pull requests are recognised on GitLab, Azure and GitHub, and the checkout can be undone.
  - Text fields get a right-click menu: cut, copy, paste, select all and spelling suggestions.
  - The PR page stacks its sidebar by the panel's width and keeps the merge bar in view; Mission Control spins the button that is actually running.
  - The pull requests handbook page is now in 14 more languages.

## [4.52.1](https://github.com/StarleyDev/githuttbr/compare/v4.52.0...v4.52.1) (2026-11-25)

### Bug Fixes

* **keychain:** bring back tokens saved before v4.52.0 ([f34a58d](https://github.com/StarleyDev/githuttbr/commit/f34a58d9c861c638ef6267023198bd7b558a88c2))

## [4.52.0](https://github.com/StarleyDev/githuttbr/compare/v4.51.0...v4.52.0) (2026-11-25)

### Features

* **platform:** a pull requests page, clearer token checks, and Electron 45 APIs ([f0bfceb](https://github.com/StarleyDev/githuttbr/commit/f0bfceb223b020b85af1b607b7d210377dc8539f))
  - Pull requests page: open, draft, merged and closed PRs with search, author, reviewer and target-branch filters, CI status, and ‹ › / Alt+←/→ to step through the filtered list from a PR's detail.
  - Token checks tell a refused token from a server that could not be reached, and the server address now comes before the token.
  - The keychain uses Electron's async safeStorage and refuses a basic_text store on Linux; the vault keeps drafts and stops exports when it cannot write.
  - xterm.js 6, web-tree-sitter 0.27 with official grammars (signature changes in 18 languages), React 19, zustand 5, framer-motion 14, lucide 1.x.

## [4.51.0](https://github.com/StarleyDev/githuttbr/compare/v4.50.0...v4.51.0) (2026-11-25)

### Features

* **updates:** roll back to an earlier version from Settings (beta) ([1920a73](https://github.com/StarleyDev/githuttbr/commit/1920a733717ec5bba34f813e92ed7cba73c05847))

## [4.50.0](https://github.com/StarleyDev/githuttbr/compare/v4.49.0...v4.50.0) (2026-11-25)

### Features

* **platform:** move to Electron 45 — macOS 13 Ventura or later is required ([41f66ff](https://github.com/StarleyDev/githuttbr/commit/41f66ff8dcd3df52d5c9ee5dea1b08e29cdcac1a))
* **settings:** warn before importing credentials on Linux without a keyring ([0a227cf](https://github.com/StarleyDev/githuttbr/commit/0a227cf193424a5b63a11884f65d54c6da384018))
* **worktrees:** tell a worktree tab apart from its main repository ([85ffa3f](https://github.com/StarleyDev/githuttbr/commit/85ffa3f0fec3e6e855a94b3d2a5ec827159b12f0))

### Bug Fixes

* **docs:** read handbook images whose alt text wraps onto several lines ([011e362](https://github.com/StarleyDev/githuttbr/commit/011e362da34ceb44ab1c32e6a13d69e20eeb49fb))
* **i18n:** name Settings and the Vault in French and Spanish as the app does ([75d299b](https://github.com/StarleyDev/githuttbr/commit/75d299b3ea01e983e523bdbc1c6006389a9f683d))
* **release:** keep merge commits in the changelog ([3d1a0eb](https://github.com/StarleyDev/githuttbr/commit/3d1a0ebc89a5e26822794e4a5dd62d086d17e9f8))
* **worktrees:** suggest and open new worktrees at an absolute path ([f32ced4](https://github.com/StarleyDev/githuttbr/commit/f32ced43bb257d01f6bd7c3060935197af22aeeb))

## [4.49.0](https://github.com/StarleyDev/githuttbr/compare/v4.48.0...v4.49.0) (2026-11-25)


### Features

* **security:** keep new tokens session-only on Linux without a keyring ([8b4666d](https://github.com/StarleyDev/githuttbr/commit/8b4666defcd82b1917b5e63a14e0b6c9468779bf))
* **settings:** choose what an exported settings file carries ([2db1f38](https://github.com/StarleyDev/githuttbr/commit/2db1f38d5e9a4dae36ad6b8465b3482ed34b82f9))
* **settings:** merge imported profiles with yours instead of replacing them ([b65858c](https://github.com/StarleyDev/githuttbr/commit/b65858ce5304bdc312890857b84d082175ccda41))


### Bug Fixes

* **i18n:** proofread recent Spanish, French and German strings ([c5286c5](https://github.com/StarleyDev/githuttbr/commit/c5286c5dd7377b073911e140a68a35f70018499d))

## [4.48.0](https://github.com/StarleyDev/githuttbr/compare/v4.47.0...v4.48.0) (2026-11-25)


### Features

* **settings:** import only the parts you choose, translating repository paths between machines ([4a510b5](https://github.com/StarleyDev/githuttbr/commit/4a510b573db9397b8467b1ae494e307c34c1964c))
  - Open repository greets with the same art as a new workspace, and its Clone, Create, Create group and Scanned repositories dialogs have a Back arrow to it.
  - Scanned repositories keeps its header and buttons fixed while only the list scrolls; a new group's page offers it too.
  - Settings hints sit between a section title and its control.
  - "Git" is capitalised where it names the program, in every language.

## [4.47.0](https://github.com/StarleyDev/githuttbr/compare/v4.46.0...v4.47.0) (2026-11-25)


### Features

* **avatars:** use an icon from the profile's repositories as its picture ([c184ea8](https://github.com/StarleyDev/githuttbr/commit/c184ea8b3ffe6daf3d66c71e2753eba9fe1016d4))
* **settings:** create profiles without switching, name AI providers, flag a weak Linux keychain ([b3674e2](https://github.com/StarleyDev/githuttbr/commit/b3674e2898e1ffb18df5ab8d1d106181deb0bc52))
  - Settings → Profile → "New profile" creates the profile to edit it, not to switch to it: the app keeps the profile in use and the bar shows the new one. The title-bar switcher still switches, as before.
  - The AI page's "Providers" section says provider throughout ("Add provider", "Default provider"…), not account.
  - Settings → Security warns when Linux has no keyring and Electron falls back to basic_text, where tokens are scrambled with a fixed password. It only warns: nothing already saved becomes unreadable.
  - The license badge opens the license of the installed version's tag, not main's.
  - A failed settle of the general AI's keys is logged (it retries on the next unlock).
  - The model picker's list-or-typed decision moves into lib/modelPicker with tests, and the repository-chat ignore test runs in a repository of its own, so it passes in a worktree too.
* **settings:** set up every AI on the AI page, and stop the model picker jumping ([6fcd2e5](https://github.com/StarleyDev/githuttbr/commit/6fcd2e573dfd4449526dac981d2b5d6ccc831606))

## [4.46.0](https://github.com/StarleyDev/githuttbr/compare/v4.45.0...v4.46.0) (2026-11-24)


### Features

* **settings:** split profile and app settings, and share one AI across profiles ([42ae873](https://github.com/StarleyDev/githuttbr/commit/42ae873a0fcf1228892e935f9f800baad20db95a))
  - The sidebar is two groups: "This profile" (Profile, Integrations) and "App" (the rest, each saying it applies in any profile).
  - A profile bar on the profile pages picks the profile being edited without changing the one in use; an amber band says when they differ, with "Use this profile". New and delete live there, delete confirms.
  - Integrations names the profile on each card, on the link button ("Link to the profile Work") and in the success toast.
  - One general AI serves every profile (AppSettings.ai). A profile may use its own (Profile.ownAI) from its Profile page; going back confirms and removes its accounts. How the AI writes (commit style, instructions, repository chat...) stays per profile.
  - Migration keeps everyone's setup: the in-use profile's AI becomes the general AI, a profile with a different AI keeps it as its own. Keys move to a "@general-ai" keychain entry, settled in the main process on the first unlock so no copy is left behind and none is lost.
  - Section titles in Settings carry the accent and a rule to the edge.


### Bug Fixes

* **site:** name the Apache 2.0 license in the hero badge and sponsor copy ([ac9dad1](https://github.com/StarleyDev/githuttbr/commit/ac9dad1a0453be36c3ea01039919134ebe5f0da7))

## [4.45.0](https://github.com/StarleyDev/githuttbr/compare/v4.44.0...v4.45.0) (2026-11-24)


### Features

* **license:** ship GitHuttBr under the Apache 2.0 license ([7ad585b](https://github.com/StarleyDev/githuttbr/commit/7ad585b056412c0e9076c6b72c20d931a85d94c9))

## [4.44.0](https://github.com/StarleyDev/githuttbr/compare/v4.43.0...v4.44.0) (2026-11-24)


### Features

* **ci:** follow CI runs from GitHub, GitLab, Azure DevOps and Forgejo ([a43a14e](https://github.com/StarleyDev/githuttbr/commit/a43a14eebfaef6a6f150f0258484079aff4c5593))
* **pr:** keep the review and merge actions fixed below the PR conversation ([6a6d73b](https://github.com/StarleyDev/githuttbr/commit/6a6d73bc69141a51cf10630e09221072cb345c0b))


### Bug Fixes

* **repos:** list repositories reached through a link under their scanned folder ([3db2c73](https://github.com/StarleyDev/githuttbr/commit/3db2c732317fb50d61b1ceb0630523a1e816cadd))

## [4.43.0](https://github.com/StarleyDev/githuttbr/compare/v4.42.0...v4.43.0) (2026-11-24)


### Features

* **repos:** list scanned repositories from the Open repository window ([6127790](https://github.com/StarleyDev/githuttbr/commit/6127790dd8d3420d55ad2f46e959bdb427b6ee6f))
* **themes:** color toolbar, sidebar, menu and settings icons by what they do ([26580e1](https://github.com/StarleyDev/githuttbr/commit/26580e12869b7ab41535152d9a213329fdc72b2d))

## [4.42.0](https://github.com/StarleyDev/githuttbr/compare/v4.41.0...v4.42.0) (2026-11-24)


### Features

* **settings:** protect a settings export with an optional password ([54738c0](https://github.com/StarleyDev/githuttbr/commit/54738c01553e29202c04037c67c872f5d0a204b3))
* **ui:** keep a dialog's title and close button fixed while its content scrolls ([8e2c0e9](https://github.com/StarleyDev/githuttbr/commit/8e2c0e95d9a8a5f809ff11e4ad08028b5590f333))
  - Dialogs built for a fixed header — a root that fills the height with a list that scrolls on its own — finally get that height: the conflict and teammate radars, the time machine, range-diff and local CI (and Settings, which already worked this way). Only their list moves now.
  - Every other dialog scrolls as a whole with its title pinned: an <h3> or .modal-title-row at the top sticks, its gap below turned from margin into padding so the resting layout is unchanged.
  - Dialogs rendered as a fragment (title, label, input) stay in normal flow, so inputs and buttons do not stretch.
  - The close button sits above the pinned title; the stacked dialog and the theme dialog get the same frame.

## [4.41.0](https://github.com/StarleyDev/githuttbr/compare/v4.40.3...v4.41.0) (2026-11-24)


### Features

* **commit-edit:** open the editor in the centre pane, with the code editor ([cc50920](https://github.com/StarleyDev/githuttbr/commit/cc50920451055b87800cdf547d094f266e1bdce9))
  - Esc or the header's close button leaves; with unapplied edits it asks first. Clicking outside can no longer throw an edit away, as it could in the modal.
  - The draft lives in the ui store, so switching repository tabs (which unmounts the pane) keeps it; opening another commit over unapplied edits asks before replacing them.
  - The file editor is the file viewer's own editor, extracted as CodeEditor: syntax colours, plus line numbers here. FileViewer uses it unchanged.
  - The commit message follows the code font size setting, like the editor.
  - Handbook page updated in all 16 languages, docs-map entry removed (it is no longer a modal), both screenshots recaptured.
* **compare:** open branch comparison in the centre pane, all at once or by commit ([bfbb418](https://github.com/StarleyDev/githuttbr/commit/bfbb4180ae9a21df9d5c660caefd7b7d30fb1f2d))
  - Two modes, one click apart: All changes (the combined diff, as before) and By commit (one commit's diff). Clicking any commit shows just that commit.
  - The changed files are listed beside the diff with added/removed counts, split from the diff by lib/diffFiles (renames, binaries, quoted paths).
  - Refs, mode, commit and file live in the ui store, so switching repository tabs comes back to the same place.
  - Every entry point (toolbar, palette, ref menu, branch drop, conflict and teammate radars) goes through lib/branchCompare. It refuses while the conflict resolver or commit editor is open in that repository, since the comparison would open behind it; opening a file there closes it instead.
  - Escape closes the view, except an Escape the diff's find box handled.
  - The "commits in / not in" sentence was built by concatenation; it is one interpolated key now. Handbook section rewritten in every language, a by-commit screenshot added, docs-map entry dropped (no longer a modal).
* **settings:** search every settings page from the header ([09636af](https://github.com/StarleyDev/githuttbr/commit/09636af720376805c27ba08741036804bdf46505))
  - Results are grouped by page, with each setting's description; the sidebar counts the matches per page and dims the pages that have none.
  - It matches the label, the description and the page name, ignores case and accents, needs every word typed, and reads the interface language and English together — a Portuguese reader typing "font" still finds it.
  - A result (or Enter for the first) opens its page — and the right Themes tab — scrolls to the setting and flashes it. Esc clears the search first.
  - Only the open page is ever rendered, so the search runs over an index in lib/settingsSearch.ts; a test walks the components each page renders and fails when a labelled setting is missing from it.
  - The code and terminal font-size sliders get a name (aria-label/title): they had none, and the terminal one announced itself as "Terminal theme".
  - Handbook section in all 16 languages, a screenshot, and a README line.
* **site:** redesign the landing page and serve it from git.huttbr.com ([545faf7](https://github.com/StarleyDev/githuttbr/commit/545faf7c0851ab1fecd828dcc455a55ae66b65d8))
  - Hero with the mascot, the graph in a window frame and a stats strip whose counts come from the build (locales, handbook pages), never typed.
  - A showcase row per headline feature beside its screenshot, reusing the already-translated feature.<id>.* copy; the cards keep the rest.
  - Hosts, repository chat with the AI providers, security, themes, an honest disclaimer, and a download card per platform with a button per installer, resolved from the latest release and limited to github.com URLs.
  - A language menu in the header, alongside the footer switcher.
  - 25 new site keys in all 16 locales; the macOS note no longer claims the build is signed and notarised, which this fork's build is not.
  - SITE_URL now points at https://git.huttbr.com (Cloudflare).
  - The share card is recaptured: it still showed the app's old name.


### Bug Fixes

* **compare:** keep the comparison fast, current and in sight ([1f43b99](https://github.com/StarleyDev/githuttbr/commit/1f43b99a431422d5112a5589561de9cea5c0795f))
  - App selected the whole compareView, which the view rewrites on every click and keystroke, so the whole app re-rendered; it now selects the repository only and the view reads its own state.
  - Jumping to a commit in the graph (sidebar branch, palette, code search) closes a comparison open in that repository: it covers the graph, so the jump landed out of sight.
  - Typing a ref compares once, 300 ms after the last keystroke, instead of on every key; the first comparison still runs at once. A refresh that moved a ref (fetch, pull, commit) compares again.
  - A commit whose diff fails to load says why instead of spinning forever; picking it again retries.
  - File rows are buttons, so the list is reachable by Tab.
  - hosting.md links the branch comparison instead of naming the old modal.
* keep the commit editor and settings search fast and their reveal reliable ([42f2845](https://github.com/StarleyDev/githuttbr/commit/42f28455d59209a8de52e8be6b6b54b323833a3e))
  - The app re-rendered on every keystroke in the commit editor: App selected the whole commitEditView, which the draft mirror replaces each time. It now selects the repo path and sha only, and the editor reads its saved draft once, on mount.
  - The code editor re-highlighted every line per keystroke — ~770 ms for a 1.75 MB file, which the commit editor accepts up to 2 MB. Past HUGE_LINES (5000, now shared from lib/highlight with the file viewer) it shows the text uncoloured.
  - Settings search: the reveal's canceller ran as the effect cleanup, which the clearReveal re-render triggered at once — a row rendering late was never scrolled to, and the flash was never removed. It lives in a ref now.
  - Searching no longer unmounts the open page; it is hidden, so unsaved local state (a theme being edited) survives a look at the results.
  - Results are announced as buttons again (listitem role removed); the code editor's text area is labelled with the file name; the commit editor ignores an Escape something else already handled.

## [4.40.3](https://github.com/StarleyDev/githuttbr/compare/v4.40.2...v4.40.3) (2026-11-24)


### Bug Fixes

* **release:** read the macos upload list without mapfile ([0bfb5ea](https://github.com/StarleyDev/githuttbr/commit/0bfb5ea1384068453a94b07b776c710daffd70c0))

## [4.40.2](https://github.com/StarleyDev/githuttbr/compare/v4.40.1...v4.40.2) (2026-11-23)


### Bug Fixes

* **mac:** the unsigned macOS app opens again — 4.38.0 to 4.40.1 wrote a file into the bundle after sealing it, and macOS refused the app as damaged ([bb8668a](https://github.com/StarleyDev/githuttbr/commit/bb8668a12ffd2473ba34ab7daf850948827de5a6))


### Releases

* build macOS on an Intel runner; GitHub's macOS arm64 runners were out of capacity ([8f055e4](https://github.com/StarleyDev/githuttbr/commit/8f055e4a5986332dd6bc2d2bd97891f8733e861d))
* verify every macOS app's signature before uploading it ([e6d79f2](https://github.com/StarleyDev/githuttbr/commit/e6d79f2520c8016277eca27eb44b263b917f202c))
* close, not open, the macOS-missing issue when the build is already on the release ([a15bf0c](https://github.com/StarleyDev/githuttbr/commit/a15bf0c830bf32658180c2e118919cc1737b0534))

## [4.40.1](https://github.com/StarleyDev/githuttbr/compare/v4.40.0...v4.40.1) (2026-11-23)


### Features

* **terminal:** pick the shell on macOS and Linux in Settings → Layout (system default, the shells in /etc/shells, or a custom path) ([54283b6](https://github.com/StarleyDev/githuttbr/commit/54283b6c488aa6129fcf9b56a4ad316372e70c31), [287d678](https://github.com/StarleyDev/githuttbr/commit/287d6785a122af0363325add9390779a353ab4a7))


### Bug Fixes

* **terminal:** start `$SHELL`, falling back to the account's login shell, and tell programs inside the terminal which shell runs ([755773d](https://github.com/StarleyDev/githuttbr/commit/755773d27bfe379f7eebf5955652218e5146dfec), [5097177](https://github.com/StarleyDev/githuttbr/commit/50971776b9a75b223f17aeeb8615f983a3d8a1e0))
* **terminal:** keep a fish user's PATH in launch tasks on Debian/Ubuntu ([5097177](https://github.com/StarleyDev/githuttbr/commit/50971776b9a75b223f17aeeb8615f983a3d8a1e0))


### Releases

* build macOS on macos-15, and let a manual backfill run while a release is still queued ([c53911e](https://github.com/StarleyDev/githuttbr/commit/c53911e39f094cdd54a8ea86cb0d47dacf90f4e9))
* move every GitHub action to its Node 24 release ([980e1ac](https://github.com/StarleyDev/githuttbr/commit/980e1ac570692cdd15044f43ec8ae00cd752dbe2))

## [4.40.0](https://github.com/StarleyDev/githuttbr/compare/v4.39.1...v4.40.0) (2026-11-23)


### Features

* **terminal:** dock under the graph and open with each repository by default ([570cab3](https://github.com/StarleyDev/githuttbr/commit/570cab3e49abdf11bef555768b62a42016ec1477))
* **terminal:** move a bottom-docked terminal to the center once on upgrade ([eb251a4](https://github.com/StarleyDev/githuttbr/commit/eb251a496dd08dcc665b6a0f0a1c652d8310441b))
* widen the create pull request dialog by 20px ([9ff2d21](https://github.com/StarleyDev/githuttbr/commit/9ff2d217a4911ab28e80ba741ac344bb7df609fd))

### Bug Fixes

* **pr:** prefill a new pull request from the remote base, not the local branch ([eb30f86](https://github.com/StarleyDev/githuttbr/commit/eb30f862bc64c3e00d3a5370352952157a9bae3b))
  - refreshPrBase (write, exclusive lock): a quiet, non-interactive `git fetch --no-tags <remote> <target>` with a 10 s timeout; never throws, returns whether the ref was refreshed.
  - prComparison (read): compares against refs/remotes/<remote>/<target>, falling back to the local target when the remote has no such branch; `log --no-merges base..source` and `diff base...source`.
* **updater:** treat a release without this platform's update file as no update ([97d4137](https://github.com/StarleyDev/githuttbr/commit/97d413776935caf4db25b4304d7fa292044e3667))


### Releases

* publish Linux and Windows without waiting for a macOS runner; macOS uploads when it builds, retries on its own for 48 h, and opens an issue while it is missing ([f6d506b](https://github.com/StarleyDev/githuttbr/commit/f6d506bfaf0df51332877700ba7beb5994b260f5), [9ecceef](https://github.com/StarleyDev/githuttbr/commit/9ecceefa51c3b48eeb72762172d27fc8677f10db))
* retry only the macOS job, never republish after a manual cancel, and never let two macOS builds of one tag overwrite each other ([d9cc191](https://github.com/StarleyDev/githuttbr/commit/d9cc19127b4bd69312685ec02f05f48bfe48e95e), [4921395](https://github.com/StarleyDev/githuttbr/commit/49213953e0912378e0422213ef51f90740d6448b), [5251319](https://github.com/StarleyDev/githuttbr/commit/525131984fc88d51e8ded924c0d18b16e796fc98), [dbaf96d](https://github.com/StarleyDev/githuttbr/commit/dbaf96dbbb3aa1d9d307e2b5b2fde475689e5cb3))

## [4.39.1](https://github.com/StarleyDev/githuttbr/compare/v4.39.0...v4.39.1) (2026-11-23)


### Features

* **pr:** make opening the new pull request in the browser optional ([c20aa65](https://github.com/StarleyDev/githuttbr/commit/c20aa65a0614c22bc63bffe03d8d5e8f7808bf04))

## [4.39.0](https://github.com/StarleyDev/githuttbr/compare/v4.38.0...v4.39.0) (2026-11-23)


### ⚠ Upgrading from 4.38

Export your settings **with tokens** (Settings → Data) before installing. Settings and preferences move automatically; saved tokens and AI keys must be imported from that export or typed again, because the OS keychain entry is new. See [Upgrading from 4.38](docs/help/upgrading.md).


### Features

* rename the product to GitHuttBr: app name, settings folder, packages, the `githuttbr` command and `GITHUTTBR_*` variables ([5f9d92a](https://github.com/StarleyDev/githuttbr/commit/5f9d92a46837f1f25bf0b3514a9e5a47426eab65), [2cb3ce2](https://github.com/StarleyDev/githuttbr/commit/2cb3ce22923b1d66352d48949f298eae092fa63f))
* write repository data as `.githuttbr.json`, `githuttbr.*` config keys and `refs/githuttbr/*`, still reading the old names ([ba2aefc](https://github.com/StarleyDev/githuttbr/commit/ba2aefc7966968912fb4512230ad4ad477cd1cf8), [f69004a](https://github.com/StarleyDev/githuttbr/commit/f69004a9ca9cfa77405cac905718cb841aedee4c))
* carry settings, preferences and plain user data over from 4.38 on first launch, once; tokens and AI keys come back from an export made with tokens ([5eaaeb3](https://github.com/StarleyDev/githuttbr/commit/5eaaeb3b4a3a7def73014f9e27d8b1741651f069), [f51d458](https://github.com/StarleyDev/githuttbr/commit/f51d458e7cfe07b77318ef01c90a6d8b05a095ef), [9536409](https://github.com/StarleyDev/githuttbr/commit/95364095248a66c4d9589b127fa9e7b0550cb91a))
* repoint 4.38 diff converters automatically and flag git editors left on the old command ([d319758](https://github.com/StarleyDev/githuttbr/commit/d3197585fd2153e4c8872db6b416679bb020db10), [6065f87](https://github.com/StarleyDev/githuttbr/commit/6065f87c39c56bad40694bd88bc934bbd001a019), [f3b7872](https://github.com/StarleyDev/githuttbr/commit/f3b787278bf331b518c00976d98286821eefb520))
* show GitHuttBr and the new identifiers everywhere the app and the website display text ([0746009](https://github.com/StarleyDev/githuttbr/commit/0746009853482ca8fa4c67c52a7dfd6eaa2715f0), [2215424](https://github.com/StarleyDev/githuttbr/commit/22154248465b3f4c7281a2833c501cdbe6e999d3))
* website points at this repository ([e8a6bad](https://github.com/StarleyDev/githuttbr/commit/e8a6bad654c30ce86f9fa8b2c276a1da1af2469b), [aff412c](https://github.com/StarleyDev/githuttbr/commit/aff412ccaa76d0d9fc2306fb95f5212948d5f385))


### Bug Fixes

* keep the pre-rename app id so updates replace 4.38 in place; the deb replaces the old package ([db068b2](https://github.com/StarleyDev/githuttbr/commit/db068b2108abada2b58522113bbf7454a8883af7))
* read the legacy repository config file in doctor, status and config ([bf6c8a3](https://github.com/StarleyDev/githuttbr/commit/bf6c8a3c3c478b11b4af1e273f198ad04c269e1f))
* also export the pre-rename device variables to launch configurations ([d72af9a](https://github.com/StarleyDev/githuttbr/commit/d72af9a830294a34aa3b70e1cc7b50587e798acc))
* name the stale command link that was actually found ([22edd84](https://github.com/StarleyDev/githuttbr/commit/22edd84601fcd8f254756cf8d1d98a4c1409f68e))


### Documentation

* add an upgrading from 4.38 page, rename the fork's own docs and regenerate the screenshots ([de6044c](https://github.com/StarleyDev/githuttbr/commit/de6044c319b6de176031181f36f056a2ec6bee8a), [53ed46f](https://github.com/StarleyDev/githuttbr/commit/53ed46fc433aa08445838f7f94153f3d202cced1), [cabe9e2](https://github.com/StarleyDev/githuttbr/commit/cabe9e2a229b845fb8b0e27611e342b0089d7751))

## [4.38.0](https://github.com/StarleyDev/githuttbr/compare/v4.37.2...v4.38.0) (2026-11-23)


### Features

* support github enterprise server hosts ([c14249e](https://github.com/StarleyDev/githuttbr/commit/c14249e5c017747e61dfdc876a9fabd15deae5d7))
* let a profile hold several self-managed gitlab servers ([3ce66a7](https://github.com/StarleyDev/githuttbr/commit/3ce66a786e0ba888383e28657501e813bdeaaf1e))
* support bitbucket data center servers ([30d5543](https://github.com/StarleyDev/githuttbr/commit/30d55435bba0b65f510492c0cbce3b6b18e6fc3c))
* show github profile pictures for commit authors ([cc36e4a](https://github.com/StarleyDev/githuttbr/commit/cc36e4aae42269dcd36e5c754c8235624dff0ccf))
* pick reviewers, assignees and labels when creating a pull request ([d8ac9df](https://github.com/StarleyDev/githuttbr/commit/d8ac9df091eaa775c1440ca33b5a7732f247255b), [f3d1506](https://github.com/StarleyDev/githuttbr/commit/f3d15060d93adcedf29cadd3ddd6a8a67f62b9c5), [b824d9c](https://github.com/StarleyDev/githuttbr/commit/b824d9ca9faef2b3e4130976f30d69e667e07da6), [f195a48](https://github.com/StarleyDev/githuttbr/commit/f195a4892d36f3b0ca060af5275554f0ab69e73e), [9658372](https://github.com/StarleyDev/githuttbr/commit/96583724976c287fced99e89ecb1f4df6b9fb9a5))
* run every repository hosting action as the profile the repository is bound to ([68088de](https://github.com/StarleyDev/githuttbr/commit/68088deaba6dfbfc460076929926e0f4f7658073), [ad513f4](https://github.com/StarleyDev/githuttbr/commit/ad513f4fd55171630cb37699dbb987c682a6e63c), [7c544f6](https://github.com/StarleyDev/githuttbr/commit/7c544f67132bdf762277ea02c1ebd1725bb86132), [6f1de1e](https://github.com/StarleyDev/githuttbr/commit/6f1de1e4ac3ebcd6bdea81c3040cfd983d81bb13))


### Security

* serve the profile token to git's helper over a private endpoint, not the environment ([a77fef5](https://github.com/StarleyDev/githuttbr/commit/a77fef5268693369da9eb830e12a789c1cd952e3), [d911de1](https://github.com/StarleyDev/githuttbr/commit/d911de13049955fc389cf57404367590d845ddd5))
* scope credential config to the server and encode its key ([fe4af8e](https://github.com/StarleyDev/githuttbr/commit/fe4af8ea6985258d931c9e19d4a57a225e1b2ff4))
* match remotes on their encoded path and exact cloud hosts; resolve a provider by its full server address ([26204dc](https://github.com/StarleyDev/githuttbr/commit/26204dc519ad6de9e5ccc8806a64314391bf9331), [46e8288](https://github.com/StarleyDev/githuttbr/commit/46e828845b02bce3d9d056e1e0fee4a9f2b468ee), [b663d07](https://github.com/StarleyDev/githuttbr/commit/b663d0732ec39a89b649927ad78f5ae115477925))
* keep private servers, profile names and stale tokens out of reports and files ([acd6e34](https://github.com/StarleyDev/githuttbr/commit/acd6e34e7cefb95e024bf28d33671dcd87bbf211), [00a9218](https://github.com/StarleyDev/githuttbr/commit/00a92181d18439b83a72e6c6fb10a7428696a56c))
* harden appimage paths, packaged cli shims and mac notarization ([ca5020c](https://github.com/StarleyDev/githuttbr/commit/ca5020c33544778779c3862aac875899060cbaba))
  - AppImage: never persist a path under the per-launch /tmp mount. "Install the command" refuses with a translated reason; the bundled textconv is offered disabled and setDiffDriver refuses a mount path. Stale links and textconv entries an older AppImage wrote are flagged, with a removal action.
  - Packaged shims: after-pack writes cli/app-binary with the real executable per platform; the command and textconv shims run it with ELECTRON_RUN_AS_NODE and fail closed instead of falling back to a node on PATH. macOS opens the bundle the shim lives in, not an app looked up by name.
  - macOS privileged install: every path is single-quoted for the root shell.
  - Warn on stderr when the app runs with --no-sandbox; document the AppImage sandbox behaviour and the .deb AppArmor/RunAsNode limitation.
  - Release workflow: fail a signed mac build whose notarization secrets are empty.
* stop saved tokens and ai keys from being silently wiped; atomic settings writes and safe recovery from a damaged settings file ([c74cb3a](https://github.com/StarleyDev/githuttbr/commit/c74cb3a2428bd1e440cf011d573c4b6bc12a7283), [da849a0](https://github.com/StarleyDev/githuttbr/commit/da849a021abfe80231a74094a1ed1cbc20b214f6), [c320269](https://github.com/StarleyDev/githuttbr/commit/c32026937f89318b83d6c717d093faf7ad6f9076), [20198b0](https://github.com/StarleyDev/githuttbr/commit/20198b0d8297f2717658d6b6d4900ce9d9ff0542), [a5f682d](https://github.com/StarleyDev/githuttbr/commit/a5f682df81540154b99c2147f25550173dfaa216), [0d60b44](https://github.com/StarleyDev/githuttbr/commit/0d60b4485de103422b8f41450b32b0cc9f04ea6d))
* keep avatar lookups off the keychain and stop caching 404s as misses ([b49a885](https://github.com/StarleyDev/githuttbr/commit/b49a8854e2436df0a6652078e777227bbc015e3d), [d09f66b](https://github.com/StarleyDev/githuttbr/commit/d09f66b81b76f63dba0564faa180588dc053fb31), [be2597c](https://github.com/StarleyDev/githuttbr/commit/be2597c4cfeec2417d2b551510767dab5450a0b9))


### Bug Fixes

* clone as nobody when the picked profile has no credential ([1849827](https://github.com/StarleyDev/githuttbr/commit/18498272279e2a501bd1041508b932f14bf4b961))
* offer create pr for profiles with only an enterprise or data center token ([8813b7c](https://github.com/StarleyDev/githuttbr/commit/8813b7ce11d7fe07d2ad1ca9a026d401adef31a1), [ae3471f](https://github.com/StarleyDev/githuttbr/commit/ae3471f432feb91af36dbc2cb06cf46400a7eb75))
* drop a removed server's token from the encrypted store; clear a session-only token the user empties ([3fa6240](https://github.com/StarleyDev/githuttbr/commit/3fa62409866d097da9d4ef277d98833e177c0fe0), [9c56808](https://github.com/StarleyDev/githuttbr/commit/9c568082d34ae276fbaffc2f70f7995db6beb6c1))
* translate hosting errors and no-credential messages shown outside toasts ([bccfe7c](https://github.com/StarleyDev/githuttbr/commit/bccfe7c50d1d653dc57738264a5e513ccc62a3f0), [407a0e5](https://github.com/StarleyDev/githuttbr/commit/407a0e51453017f07cf98050f5f7ee60148171c4))
* let a settings row check its token against a server not saved yet ([e810589](https://github.com/StarleyDev/githuttbr/commit/e8105897cdaafc92b674cbf5ea776f5db63d2867), [faf5b9b](https://github.com/StarleyDev/githuttbr/commit/faf5b9b9f3d734e8bbabc7065b4e8c1519770d0c))
* keep empty commit lists per repository and re-ask avatars on unlock ([2b0df70](https://github.com/StarleyDev/githuttbr/commit/2b0df70a7ba9aed3f71bc0df61557fbf819285ba))

## [4.37.2](https://github.com/StarleyDev/githuttbr/compare/v4.37.1...v4.37.2) (2026-11-23)


### Bug Fixes

* catch appimage mount paths anywhere on a textconv line ([c7bb0b0](https://github.com/StarleyDev/githuttbr/commit/c7bb0b0bc40efd520f55235c3b355db1981e2711))
* docs guard sees wrapped palette entries, map the cli commands ([9ca94d5](https://github.com/StarleyDev/githuttbr/commit/9ca94d51b604d8413ea216af17d0a4473ce7dc1a))
* keep background reads read-only and explain a refused move-aside ([c3fffa2](https://github.com/StarleyDev/githuttbr/commit/c3fffa29f2349435b03e818200c189d0677f82bc))
  - remove the persisted tombstones (pendingSecretClears, loadPendingClears, flushTombstones, forgetPendingClears). Clears made with the keychain off hold for the session and reach the store when the keychain is turned on in that session; a stale list in the file is dropped, never obeyed
  - readers outside the settings queue (profileAuth, allProfileAuth, activeProfileAiKey) never write; the plaintext-token migration runs only from the queued settings:unlock
  - the keychain question settles only on a main-frame, cross-document navigation, not on the PDF preview's iframe loading
  - a move-aside refused because the token store could not be copied answers { refused: 'secrets-copy', dir } and the boot screen explains it
* refuse appimage mount paths for cli and textconv ([67cc87b](https://github.com/StarleyDev/githuttbr/commit/67cc87b5e0223252fe2a0b1ee1cf54086f6818ac))
  - cli: install refuses with a translated reason under an AppImage; a stale command link into a mount is warned about once per launch and removable from the palette (re-read before unlink, never escalated).
  - attributes: bundled converters are disabled under an AppImage, setDiffDriver refuses a mount path, and an existing stale driver is flagged with a Remove button (no undo).
  - handbook: cli, attributes and security notes, including how to find stale textconv entries in other repositories.
* settle abandoned keychain asks and keep keychain-off clears for the session ([905b2f1](https://github.com/StarleyDev/githuttbr/commit/905b2f13612459575972c71a5080b00f93640306))
  - a consent question whose page reloads, crashes or is destroyed settles as unanswered, so settings:get is never stuck behind it
  - clears made with the keychain off persist as slot ids (pendingSecretClears) and reach the store at the next load or write, surviving a restart
  - the keychain-enable move bumps the generation on arrival, not in the queue
  - moving a damaged settings file aside copies the secrets first, or refuses
  - a failed directory fsync after the rename never fails the write
  - a fresh store (keychain usable, or first created by a save) counts as served
  - separate retry budgets for busy reads and parse failures
  - textconv globs into /tmp or before a mount name count as ephemeral
  - a refused save on a damaged file is toasted once, in every locale
  - a failed read-back after an import no longer hides why the import failed
* stop settings imports and saves from wiping saved tokens ([4c22542](https://github.com/StarleyDev/githuttbr/commit/4c225420b04337ed325fdbabd0855a920d5ee6f6))
  - Importing a tokenless export (the default) with Settings unlocked cleared every token and AI key. An import now merges; a file carrying credentials asks Add to mine / Replace all / Cancel, and only Replace all overwrites.
  - A debounced save scheduled before settings:unlock but landing after it was read as "clear everything". get/unlock replies carry a generation, saves echo it, and only a save from the latest reply can clear; persist sends the state at fire time and a pending save is flushed before a load.
  - The settings JSON and the token store were written in place: torn reads, interleaved writes, and a half-written file read as defaults. Writes are now atomic (owner-only temp file, fsync, rename) and serialized per path; a file that exists but cannot be parsed is retried, then an error, and the window says so instead of spinning.
* stop settings saves from overwriting unreadable files or reviving tokens ([ff6e9ad](https://github.com/StarleyDev/githuttbr/commit/ff6e9adc3793a0af8e0417f47a678863514bf455))
  - refuse every settings save until a get/unlock has answered, and while the file is known unparseable; the renderer store also ignores changes until it has loaded, so the boot error screen can no longer save defaults
  - pass the load failure kind (parse, io, other) through ipc; only a parse error is called damaged, every error offers a retry, and a damaged file can be renamed aside (never deleted) to start fresh; locked files retry ~2 s
  - refuse "replace all" imports while the keychain is off instead of reporting success and keeping the old tokens
  - decide whether a save may clear credentials when it arrives, take the reply generation before reading, serialize settings reads and writes, and make reloads wait for saves in flight
  - with the keychain off, a cleared token is gone for the session and its stored copy is deleted when the keychain is turned on
  - only a reply carrying the decrypted store lets a blank mean a clear, and moving session tokens into the store starts a new generation
  - write through a symlinked settings file and fsync the directory after the rename

## [4.37.1](https://github.com/StarleyDev/githuttbr/compare/v4.37.0...v4.37.1) (2026-11-23)


### Bug Fixes

* bump electron to 43.8.12 and audit it in ci ([3084669](https://github.com/StarleyDev/githuttbr/commit/3084669d1f45228ac435877ef475153871b1b47d))
* drop cwd-relative search path entries before main spawns anything ([00da47b](https://github.com/StarleyDev/githuttbr/commit/00da47b3a670fd83a00eb8406df499d502743b28))
* harden git argument, credential redaction and clone paths ([c34c7c1](https://github.com/StarleyDev/githuttbr/commit/c34c7c1bdabe7a7e864cc98abaa3db2a564319d7))
  - remoteBranches runs `ls-remote --heads -- <url>` from a neutral cwd and refuses option-shaped URLs; every network call (fetch, push, ls-remote, subtree, submodule, remote add/edit, bundle fetch) now puts `--` before its positionals, and withRemoteAuth refuses an option-shaped remote
  - one shared redaction helper (shared/redact.ts) takes URL userinfo up to the last `@`, so a token holding `/` no longer leaks; it also masks bare GitHub, GitLab, Atlassian and Bitbucket DC token shapes. Used by the op log, toasts, the repo-chat result and bug reports
  - Forgejo job-log and Azure build-log URLs refuse `..` segments and are checked again after normalisation, so the token stays on its instance
  - the multi-branch push secret guard holds a branch whose outgoing files could not be listed instead of treating it as clean
  - clone refuses folder names that escape the parent, name a Windows device or read as an option; the batch dialog sanitises server names
  - the handbook states that a profile token reaches repository hooks
* ignore --shot in packaged builds ([216b753](https://github.com/StarleyDev/githuttbr/commit/216b7538fe0f0fe28c42bb4162d2901c44e8c6b0))
* set electron fuses and drop dyld entitlements on macos ([bacc2cc](https://github.com/StarleyDev/githuttbr/commit/bacc2cce5f2d0977a52fd654a43069e9d0ec764b))

## [4.37.0](https://github.com/StarleyDev/githuttbr/compare/v4.36.1...v4.37.0) (2026-11-23)


### Features

* **docs:** warn when a translated handbook page has fallen behind its english ([b96f092](https://github.com/StarleyDev/githuttbr/commit/b96f092d25bc8228b66ef8fc7d6cef40c27df3d2))
* extend the i18n guard with a syntax pass ([8f6649a](https://github.com/StarleyDev/githuttbr/commit/8f6649a8aa787f984b0e9c679fcf2d638da4be83))
* push several branches at once ([331150a](https://github.com/StarleyDev/githuttbr/commit/331150acd9281423ead909acdf53b1c26f8ef899))


### Bug Fixes

* **build:** derive the licence list from the lockfile, not npm ls paths ([50d9020](https://github.com/StarleyDev/githuttbr/commit/50d9020881f9da0f0db0a51f9a4a1282ff1fae7a))
* clear the push destination clash on select all/none ([c3ddc78](https://github.com/StarleyDev/githuttbr/commit/c3ddc78a63fda751ac240ed845ca3e9721b33306))
* clear the push destination clash when the remote changes ([a693a6a](https://github.com/StarleyDev/githuttbr/commit/a693a6a5abaa6a2d9a76aaf473314147e145157a))
* highlight on-demand code fences that mount after their language loads ([65afd76](https://github.com/StarleyDev/githuttbr/commit/65afd76cd0e8e04a3ba6d30e7f11d53aed8c76f9))
* push each branch to its own name in the push branches dialog ([6bb2f04](https://github.com/StarleyDev/githuttbr/commit/6bb2f04cd7bc5d50f5bb66fcf99f96e80e783588))
* send chat action failures to the model in english, translated on the card ([2f37f8b](https://github.com/StarleyDev/githuttbr/commit/2f37f8b89288855e01d82c851ab109a2306f6bb4))
* translate the renderer copy the i18n guard could not see ([3fe620f](https://github.com/StarleyDev/githuttbr/commit/3fe620f9c7156c25541f68907362654fb546f45e))


### Performance Improvements

* load xterm with the first terminal instead of at startup ([b79d87e](https://github.com/StarleyDev/githuttbr/commit/b79d87e732d4d53b54f5fa2df0a2044dc469b8c9))
* register a curated highlight.js set and load other languages on demand ([9d6b70b](https://github.com/StarleyDev/githuttbr/commit/9d6b70be789d424d2c4f532ce6e68c89dbcb6fc6))

## [4.36.1](https://github.com/StarleyDev/githuttbr/compare/v4.36.0...v4.36.1) (2026-11-22)


### Bug Fixes

* allow the app's own config keys in simple-git before its next major blocks them ([0f48aef](https://github.com/StarleyDev/githuttbr/commit/0f48aef4ca2a44d569fe0138bb609d7bbf35830b))
* show the pull requests that close an issue, from github's graphql ([b9f6ef9](https://github.com/StarleyDev/githuttbr/commit/b9f6ef9c32487dd7a5fbf0119bfbfdd662c7fd9d))
* upgrade echarts and uuid past their security advisories ([b0984b9](https://github.com/StarleyDev/githuttbr/commit/b0984b9ed913e80268372cf5a558cb01f70a6cd6))


### Performance Improvements

* load only the active ui language at startup ([d2fd25e](https://github.com/StarleyDev/githuttbr/commit/d2fd25ec586f70e6820a6477e5b760dab1152bdf))
* load the 3d cosmos view and the licenses page only when they open ([a366fc4](https://github.com/StarleyDev/githuttbr/commit/a366fc4c589d075d8e744fb38685fcd90b6553dd))

## [4.36.0](https://github.com/StarleyDev/githuttbr/compare/v4.35.0...v4.36.0) (2026-11-22)


### Features

* keep clones running in the background, cancel them, and clone several at once ([c62b9c7](https://github.com/StarleyDev/githuttbr/commit/c62b9c7fd40a075cf074268ae75c968ca5547857))


### Bug Fixes

* apply imported settings immediately, not after a restart ([ae6e550](https://github.com/StarleyDev/githuttbr/commit/ae6e5501976c475e6abb2ae16b8d86d13f5d6f0b))

## [4.35.0](https://github.com/StarleyDev/githuttbr/compare/v4.34.4...v4.35.0) (2026-11-21)

### Features

* connect a ChatGPT or Claude subscription during onboarding and in Settings → AI ([1af5b46](https://github.com/StarleyDev/githuttbr/commit/1af5b4632e483856feaa3b3a96987cf4dde03dad))


### Bug Fixes

* update SheetJS to 0.20.3, past its prototype-pollution and ReDoS advisories for spreadsheet parsing ([cf82c5e](https://github.com/StarleyDev/githuttbr/commit/cf82c5e90580f3577a9a687a171b953bd8f4b6d6))
* validate and deduplicate Azure build links, and read build logs through the shared streaming reader ([ea373f1](https://github.com/StarleyDev/githuttbr/commit/ea373f1f35ea282282815193c632f917f43f9254))
* isolate commit-signing drafts and queue reversible config writes ([6d99f31](https://github.com/StarleyDev/githuttbr/commit/6d99f314e400289bbe6fd2b65bc3f2db0a85e643))
* ignore review notifications that come from a previous profile's request ([e67c61a](https://github.com/StarleyDev/githuttbr/commit/e67c61a0cfbe3861a69a69219cf32cac0d9006e9))
* stop a cancelled test run before its runner starts ([862d7e5](https://github.com/StarleyDev/githuttbr/commit/862d7e5057e4a74a07af1bdbaf0ebd15d4790742))
* track test cancellation while the report directory is prepared ([f0d9730](https://github.com/StarleyDev/githuttbr/commit/f0d9730f3015baff1f98411068efbc450c014bc1))
* resolve canonical repository paths in test reports ([add00bc](https://github.com/StarleyDev/githuttbr/commit/add00bc4314bf5e35d1c6e1d1944d1e80c6f00c5))


## [4.34.4](https://github.com/StarleyDev/githuttbr/compare/v4.34.3...v4.34.4) (2026-11-21)


### Bug Fixes

* never send an AI API key over plaintext http off this machine ([5889253](https://github.com/StarleyDev/githuttbr/commit/5889253b9132cd8e58f575fcf985fefd4735ead7))
* strip private details from an error before reporting it as an issue ([c2de86e](https://github.com/StarleyDev/githuttbr/commit/c2de86ed8ede96a71da283c3f9492a3ec471cee1))

## [4.34.3](https://github.com/StarleyDev/githuttbr/compare/v4.34.2...v4.34.3) (2026-11-21)


### Bug Fixes

* let Linux desktops tie the app's window to its menu entry ([29bb878](https://github.com/StarleyDev/githuttbr/commit/29bb878783680e4cb0034899c53859d86551c051))

## [4.34.2](https://github.com/StarleyDev/githuttbr/compare/v4.34.1...v4.34.2) (2026-11-21)


### Bug Fixes

* save commit-signing settings as they change, like the rest of Settings ([4028e20](https://github.com/StarleyDev/githuttbr/commit/4028e20ab33ca814861687f82ac7837f85a7d892))

## [4.34.1](https://github.com/StarleyDev/githuttbr/compare/v4.34.0...v4.34.1) (2026-11-21)


### Bug Fixes

* move to simple-git 4, past its command-execution advisories ([1594dc7](https://github.com/StarleyDev/githuttbr/commit/1594dc7a3f9cc144c0324040c272082e73d8a4a1))
* update js-yaml, dompurify and xmldom past their security advisories ([8eb7d13](https://github.com/StarleyDev/githuttbr/commit/8eb7d138b056ba0c5ddd23749faaa2ca6744ec3d))

## [4.34.0](https://github.com/StarleyDev/githuttbr/compare/v4.33.0...v4.34.0) (2026-11-21)


### Features

* fetch only the stale repos from mission control, and name the operation in the row's language ([76111a4](https://github.com/StarleyDev/githuttbr/commit/76111a46c0541f6fef339399ba0729d1260443c1))
* show Azure build validation as checks, and read an Azure Pipelines build's log ([d9b47f0](https://github.com/StarleyDev/githuttbr/commit/d9b47f03475a25db1b6164c106a143dba5201c45))


### Bug Fixes

* define the colour variables the stylesheet uses but no theme sets ([c08f32a](https://github.com/StarleyDev/githuttbr/commit/c08f32a30afd6b34e0ff772cc871b6bf7f86ed08))

## [4.33.0](https://github.com/StarleyDev/githuttbr/compare/v4.32.0...v4.33.0) (2026-11-20)


### Features

* show each repo's last commit, last fetch and a column layout in mission control ([60278ad](https://github.com/StarleyDev/githuttbr/commit/60278adad91151a7ca9178a50c17fb95f0af5710))

## [4.32.0](https://github.com/StarleyDev/githuttbr/compare/v4.31.0...v4.32.0) (2026-11-20)

### Bug Fixes

* keep only a Forgejo job log's tail in memory, and keep its panel on its check ([b78b6e8](https://github.com/StarleyDev/githuttbr/commit/b78b6e803512407001a7ccd6beaed4714f33c140))
  - The whole log was read into the main process and only then cut to its last 512 KB, so a job that printed hundreds of megabytes allocated all of it. readTail streams the body and keeps just the tail, trimmed to a whole line.
  - The open log was tracked by position in the checks list, so a refresh that reordered the list showed another check's log. It is tracked by the check's link now.
  - The GitHub notifications doc comment sat above forgejoInbox; it is back on the function it describes.
* no burst of review notifications after a profile switch ([362957e](https://github.com/StarleyDev/githuttbr/commit/362957eaa24ddaad74128a46cfa99369b5db4b74))
* tell a cancelled test run apart from the next one ([7c5149f](https://github.com/StarleyDev/githuttbr/commit/7c5149ff9b59d846d38e24d4d7e0ab0b58fe9210))
* translate the notification reasons ([acd023a](https://github.com/StarleyDev/githuttbr/commit/acd023a839852f4915f1bb29918157d151684867))

## [4.31.0](https://github.com/StarleyDev/githuttbr/compare/v4.30.0...v4.31.0) (2026-11-20)


### Features

* run the project's tests from the Problems dock ([632b771](https://github.com/StarleyDev/githuttbr/commit/632b7716512ff3f6487c3db92f7cc600f91d1d33))


### Bug Fixes

* run tests without a shell, and make a stopped run look stopped ([72b5d45](https://github.com/StarleyDev/githuttbr/commit/72b5d45677ea255484048849b949eee5cde1c98e))
  - Windows ran the runner's .cmd shim through a shell, which concatenates arguments unescaped: a space in the user's temp path broke every run, and an & in a repository folder's name executed a command. The runner's own JS entry (its package.json bin) now runs through Node directly — the Node on PATH, else Electron's as Node — with no shell anywhere.
  - A cancelled run came back as "the runner finished without a report" and replaced the last result; it now reports itself cancelled and is dropped.
  - No runner installed: an untranslated English error toast from the palette. The store re-detects before running and the panel's translated text explains; main returns 'unavailable' instead of throwing.
  - The error chip and the Problems command open the dock on Problems, not on whichever tab was used last.
  - A test at the root no longer takes its failing line from another file of the same name in a subfolder.
  - The runner is re-detected when the window regains focus; rows key by position; the report goes to a private mkdtemp directory; a timeout says so; the Tests section is translated into every locale.

## [4.30.0](https://github.com/StarleyDev/githuttbr/compare/v4.29.0...v4.30.0) (2026-11-20)


### Features

* a desktop notification when a pull request starts waiting for your review ([da21fa3](https://github.com/StarleyDev/githuttbr/commit/da21fa3098df8cf0c09ac566ba8d2176c86846a9))
* issues, milestones, releases and notifications on Forgejo ([88dade2](https://github.com/StarleyDev/githuttbr/commit/88dade2155acfdaf39e6d10cc69831c2a13b8946))
  - issues: list, detail with comments, close/reopen, create;
  - milestones: list (their page is /owner/repo/milestone/<id>, which the API does not send) and the issues in each;
  - releases: the most recent, a draft counted as unpublished;
  - notifications: the active profile's Forgejo inbox joins GitHub's, newest first, its ids prefixed fj: so marking one read goes back to Forgejo.
* read a Forgejo Actions job's log in the PR page's Checks tab ([8d7dce1](https://github.com/StarleyDev/githuttbr/commit/8d7dce1d50a77cb462c5f18203ec73d460b08d86))

## [4.29.0](https://github.com/StarleyDev/githuttbr/compare/v4.28.0...v4.29.0) (2026-11-20)


### Features

* show the work items linked to an Azure DevOps pull request ([a217c67](https://github.com/StarleyDev/githuttbr/commit/a217c67f8bbcca430a43238fb031144deb40a518))
* suggest Makefile targets, Composer scripts and branches in the terminal ([d8cebb0](https://github.com/StarleyDev/githuttbr/commit/d8cebb032589f7c10a124c13778bd4ffafdc4685))
* suggest package.json scripts after npm run in the terminal ([1822268](https://github.com/StarleyDev/githuttbr/commit/1822268cb072a565c914e3d494ad678fd62a56bd))


### Bug Fixes

* read every page of Forgejo lists and Azure DevOps pull requests ([6f5278d](https://github.com/StarleyDev/githuttbr/commit/6f5278d303634c6879b37bad9bb9fe42cd2ec032))

## [4.28.0](https://github.com/StarleyDev/githuttbr/compare/v4.27.2...v4.28.0) (2026-11-20)


### Features

* branch from an Azure Boards work item, and link AB# mentions ([44a39d0](https://github.com/StarleyDev/githuttbr/commit/44a39d0c8d234f768e0c1e139bd305acf14f6f19)), closes [AB#1234](https://github.com/StarleyDev/AB/issues/1234) [AB#1234](https://github.com/StarleyDev/AB/issues/1234) [#1234](https://github.com/StarleyDev/githuttbr/issues/1234) [#1234](https://github.com/StarleyDev/githuttbr/issues/1234)
* check which account each remote signs in with ([ad1571c](https://github.com/StarleyDev/githuttbr/commit/ad1571c67cf3242e838e230beb63b5d51c8a776b))
* drag a commit onto a branch to cherry-pick it or move the branch ([9911e39](https://github.com/StarleyDev/githuttbr/commit/9911e394b62986d6e659e90de4892ef58a9572da))
* mark the pull requests waiting for your review ([21d6e97](https://github.com/StarleyDev/githuttbr/commit/21d6e979e8aaf6f967bae18430bcf9499611bf59))
* review a PR with AI from its page, on the host's diff ([451c489](https://github.com/StarleyDev/githuttbr/commit/451c48906317de2bf70f5de641fb9f85f3efc55f))
* review Azure DevOps pull requests in the PR page ([a7603ab](https://github.com/StarleyDev/githuttbr/commit/a7603ab780314e0e378e1939b1b1e5dd80a7d0df))
* review Forgejo pull requests in the PR page ([c9d6c0a](https://github.com/StarleyDev/githuttbr/commit/c9d6c0a0274f8e1bbcb10a27e6deb41d1bd5ab94))
* suggest package.json scripts after npm run in the terminal ([bd9d5fa](https://github.com/StarleyDev/githuttbr/commit/bd9d5fade0fe821ae1ad5348a23135e8e260011f))


### Bug Fixes

* bind self-managed credentials to their issuing instance ([2a8d0b7](https://github.com/StarleyDev/githuttbr/commit/2a8d0b7efcbde4d1616e66437e1785a3cf4b824d))
* constrain credential probes to recognized instances ([45b7199](https://github.com/StarleyDev/githuttbr/commit/45b7199ec204d95e64dba2d27edaf66af9656da5))
* credit the fork's author with the right Portuguese article ([ca5b76b](https://github.com/StarleyDev/githuttbr/commit/ca5b76babf17be0b68ac7887bef65fc8c70218f9))
* enforce HTTPS origin and reject authenticated redirects ([3a1b41e](https://github.com/StarleyDev/githuttbr/commit/3a1b41e1c80b6046a7f77c4409d1ad3302478515))
* isolate PR tab state and keep credentials out of saved tabs ([f8f0678](https://github.com/StarleyDev/githuttbr/commit/f8f0678dd6fcff23f26e783d8ca5bdec8c53cdea))
* keep helper commands private and document environment checks ([55c6b43](https://github.com/StarleyDev/githuttbr/commit/55c6b43e6acfbc13600422b33e41622c55997f4c))
* keep the Settings window one size while moving between sections ([cc7f18f](https://github.com/StarleyDev/githuttbr/commit/cc7f18f1ab40ade3c455cad94b75be8562b71854))
* **main:** don't crash when stdout or stderr has lost its reader ([6dc9baf](https://github.com/StarleyDev/githuttbr/commit/6dc9baf5c8b0ee1d7698747cdeb312ca5dcffb47))
* match hosting names only in the remote authority ([fafdd46](https://github.com/StarleyDev/githuttbr/commit/fafdd46cdc8a0eb6d299b73c5d66c02ccdcb3e75))
* read a PR's whole conversation, not its first 100 comments ([cf12614](https://github.com/StarleyDev/githuttbr/commit/cf12614ddb7363d692e3bc17d40596b90de9b5e9))
* resolve the remote sign-in check per GitLab/Forgejo instance ([29671ff](https://github.com/StarleyDev/githuttbr/commit/29671ff79e6e659cf48694b3effc4ec7c986d0b0))
* share push credential selection with sign-in diagnostics ([19b76da](https://github.com/StarleyDev/githuttbr/commit/19b76da97ad69c5ad36417e85911010457de9119))
* **tabs:** keep fit-mode groups compressible and reachable ([dd01cec](https://github.com/StarleyDev/githuttbr/commit/dd01cec57a9cadbbfb106a3f441c8e940f75edca))
* translate the remove-remote confirmation ([e14ac41](https://github.com/StarleyDev/githuttbr/commit/e14ac41bc25b46bd778cace426b98c6514b00b1a))

## [4.27.2](https://github.com/StarleyDev/githuttbr/compare/v4.27.1...v4.27.2) (2026-11-20)


### Bug Fixes

* give the package author an e-mail, which the .deb maintainer field needs ([f756c51](https://github.com/StarleyDev/githuttbr/commit/f756c510b850f232425d1e8f9149562383677a49))

## [4.27.1](https://github.com/StarleyDev/githuttbr/compare/v4.27.0...v4.27.1) (2026-11-20)

## [4.27.0](https://github.com/StarleyDev/githuttbr/compare/v4.26.0...v4.27.0) (2026-11-20)


### Features

* add an environment check to settings ([1e4e38e](https://github.com/StarleyDev/githuttbr/commit/1e4e38e936bb15885ed90de92af73f3f008943d2))
* add Forgejo (and Gitea) as a hosting provider ([094bd6e](https://github.com/StarleyDev/githuttbr/commit/094bd6e558bb73fac6e1095ac026cefb7e1648ef))
* check which account each remote signs in with ([a7bbb7c](https://github.com/StarleyDev/githuttbr/commit/a7bbb7c431ff5cd71212362b369f6bcd6b8fcb5f))
* explain common push and auth errors in the toast ([82011bf](https://github.com/StarleyDev/githuttbr/commit/82011bf3c7cf483e27f9d8dcba34264cdc636cb2))
* list the Forgejo token scopes under the create-token link ([95f36e4](https://github.com/StarleyDev/githuttbr/commit/95f36e4d0cce4b64675cb497536bd43aaf2688b3))
* open a pull request on its repository's tab or group chip ([e6eb492](https://github.com/StarleyDev/githuttbr/commit/e6eb4924f46554d1c3bf80ba93302490ba1ae759))
* open pull requests as a page with a details sidebar ([5f02ab4](https://github.com/StarleyDev/githuttbr/commit/5f02ab443dd8210377ce15257d76d26820140f18))
* show each changed file's diff on the PR page ([a0a5517](https://github.com/StarleyDev/githuttbr/commit/a0a55175e69614961fc2caa95d9d3b7de1743990))
* support self-managed GitLab instances ([0c35533](https://github.com/StarleyDev/githuttbr/commit/0c3553364732131d6e507a2927da5881a30c3d3b))


### Bug Fixes

* count per-host credential helpers in the environment check ([821a7f8](https://github.com/StarleyDev/githuttbr/commit/821a7f8ea124c3532e7155feaf65137a4cd613ca))
* explain missing token scopes, and unwrap errors in Integrations ([9dccc0c](https://github.com/StarleyDev/githuttbr/commit/9dccc0cbdb1e8eaa3b83cba5e3ef263cf23ff7bd))
* keep git's messages in English whatever the system locale ([92bd7f9](https://github.com/StarleyDev/githuttbr/commit/92bd7f9a6fbe0325dfb7299e7abb65764415fc0e))
* keep GitLab and Forgejo tokens on their own instance in every path ([56378e3](https://github.com/StarleyDev/githuttbr/commit/56378e34651eeb1e55e2aa5a6ad3388b6d7ee999))
  - Clone and the clone dialog's ls-remote checked the instance for GitLab only: with two profiles on two Forgejo servers, the active profile's token could be sent to the other server. Forgejo gets the same check.
  - tokenForProvider took the instance from the renderer's `org` but the token from the active profile; it now refuses an instance that is not the active profile's.
  - The onboarding wizard reuses the Integrations page but dropped the GitLab address and the Forgejo address and token. It also stripped an import's secrets with a hand-kept list that missed the Forgejo token and AI account keys; it now uses the shared strip and detection.
  - Remove the unused activeProfileToken, which bypassed the instance rule.
  - Forgejo compare links keep slashes in branch names.
  - Read settings at startup so the instance registry is filled for runs without a window.
* list every file of a large PR, and tidy the PR page ([2ac5e6b](https://github.com/StarleyDev/githuttbr/commit/2ac5e6b259e85cbef9ee3bba80396634834ff231))
  - GitHub caps per_page at 100, so `?per_page=300` listed only the first 100 files of a larger PR while the sidebar counted all of them. GitLab's diffs had the same cut. Both now follow the pages (up to 30).
  - The header read "wants to merge" on merged and closed PRs; it now says what happened.
  - A GitLab MR with 100+ commits showed "100 commits"; it shows "100+".
  - Avatars are drawn only from https URLs.
  - Remove the six translation keys only the old modal used.
  - README: the PR line describes the page.
* match hosting providers at a host boundary, and surface GitLab owner errors ([09e2aee](https://github.com/StarleyDev/githuttbr/commit/09e2aee3a055c4048241c995098a74e48d7b2118))
* resolve the remote sign-in check per GitLab/Forgejo instance ([f99ded7](https://github.com/StarleyDev/githuttbr/commit/f99ded7c71c011322b180b1ccacc2e6993ea91ab))
* restore a brace lost when merging the stylesheet ([9bc8194](https://github.com/StarleyDev/githuttbr/commit/9bc81949f0b7546032f5c7c2c13ece27815d1c5e))
* say an expired token can also cause a refused write ([24dc5ae](https://github.com/StarleyDev/githuttbr/commit/24dc5aec06ab44abcd9848a7facee190465b2cb2))
* translate the remove-remote confirmation ([41f6761](https://github.com/StarleyDev/githuttbr/commit/41f6761f9b45d29473febb3575ed719a2f99a775))
