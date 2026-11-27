---
title: Themes & appearance
category: Make it yours
order: 100
summary: Built-in themes, light and dark, plus custom and AI-generated ones, and colored icons.
keywords: theme themes dark light appearance colors colours font size graph palette search settings find preference filter icon icons icon colors tint monochrome menu groups moved general where
---

# Themes & appearance

Built-in themes — GitHuttBr, Nord, Dracula, Solarized, GitHub, Monokai,
Midnight, Contrast and Daltonic — each with a light and a dark variant.

![Switching from light to dark](../screenshots/clip-themes.webp)

- **Light, dark, or follow the OS**, switched live.
- **Custom themes**, and **AI-generated** ones from a prompt.
- Adjustable **code font size**.
- **Icon colors** for the toolbar and the sidebar sections — see below.
- The **graph's look** — lane palette, corner style, row density and line
  thickness, with a live mini-graph preview — has a page of its own,
  **Settings → Graph**: see [the commit graph](graph.md).

![Theme settings](../screenshots/settings-themes.webp)

## Icon colors

A row of grey icons makes Fetch, Push and Stash look alike until you read their
labels. **Icon colors**, under Appearance on the Themes page, colors each icon by
what it does, so the eye finds the action before the word:

| Role | Icons | Theme color it takes |
|---|---|---|
| Receiving | Fetch, Pull, Remotes, Worktrees | the theme's cyan slot |
| Sending, finishing | Push, Todos, Issues, Releases | green |
| Refs | Branch, Local, Tags, Pull requests, Milestones, Submodules | the accent |
| Set aside | Stash, Pop, Stashes, Bookmarks, Pinned | the theme's orange slot |

Undo, Redo, Tools and Settings stay grey: they are utilities, and leaving them
plain is what lets the colored ones stand out.

Lists that group many entries color a whole group at once, so a group reads as
one family:

- **Tools menu** — time travel (Reflog, Snapshots, Time machine, Bisect) in
  orange; the branch tools (Absorb, the radars, Local CI, comparisons) in the
  accent; and one color per group: Inspect cyan, Branches & history the accent,
  Files & patches green, Repository orange, Secrets & sharing red.
- **Settings pages** — Layout & terminal, Workspaces and AI in the accent;
  Profile & identity, Code analyzers and Environment green; Connected accounts,
  Git & sync and Data & backup cyan; Themes and Graph orange; Security &
  confirmations red. General, Shortcuts and About stay grey.

A row of icon buttons with no labels does the opposite — each button gets its
own color, so they can be told apart. On the [pull request page](pull-requests.md)
the header's buttons read refresh blue, AI review the accent, preview locally
teal, go to source branch green and go to target branch orange (open in browser
stays grey), and your own comments' **Edit** takes the accent and **Delete**
red — there and on the issue page. Blue and teal are mixes of the theme's colors, so they follow it too.

The right-click menus of commits, branches and repositories — the graph's
commits, stashes and branch or tag badges, the sidebar's branches, tags and
stashes, the branch picker, the menu a drag-and-drop opens, and a repository's
menu on its tab, its group chip, the Repositories page and the launcher — give
every row an icon colored by what its action does, the same way in each of them:

| Color | Actions |
|---|---|
| Refs (the accent) | check out, create a branch or tag, merge, rebase, cherry-pick, revert, compare, rename, worktree, squash, fixup; a repository's alias, and moving it into a group, folder or workspace |
| Sending (green) | push, create a pull request, open on the host, go to the release, export a patch |
| Receiving (cyan) | pull, fast-forward |
| Set aside (orange) | apply or pop a stash, pin, star, copy, amend, edit the message |
| Security (red) | reset, delete, drop, undo the commit, move a branch, remove from the list, close |
| Preview (teal) | range-diff, conflict radar, local CI, show worktrees, open in the terminal, file manager or editor |

A destructive row is red throughout, icon included, as it always was.

| Option | What you see |
|---|---|
| **Monochrome** | Every icon grey, as before this option existed |
| **Soft tint** (default) | The color mixed into the grey; the whole color on hover |
| **Full color** | The color itself, on a small chip of the same hue |

The colors come from the theme — a theme that repaints its green or its accent
repaints the icons with it, custom and AI-generated themes included.

**Palette** picks which color each role takes. Each swatch shows its five colors
(receiving, sending, refs, set aside, security):

| Palette | Receiving · Sending · Refs · Set aside · Security |
|---|---|
| **From the theme** (default) | cyan slot · green · accent · orange slot · red — the table above |
| **Cool** | accent · teal · purple · lavender · wine |
| **Warm** | orange · yellow · magenta · olive · red |
| **Nature** | teal · green · lime · yellow · red |
| **Sunset** | purple · orange · magenta · yellow · red |
| **One color** | everything in the accent; security stays red |

Every palette is made of the theme's own colors and mixes of them, so it changes
with the theme and keeps its contrast in light and dark. The pull request page's
row of buttons follows the palette too, each button taking the role nearest to
it. Security stays red in most palettes because it is a warning; with
**Monochrome** the palette has nothing to color.

Limits: only the toolbar's main buttons, the sidebar section headers, the Tools
menu, the right-click menus of commits, branches and repositories, the Settings and repository settings pages, the buttons of the pull request and issue pages and the status bar's icons (the folder, Help, Report issue) are colored — the version number stays grey; other menus, the rows inside a section
and the commit graph are not. A hovered menu row keeps its usual look, icon
included. Color
is never the only clue — every icon keeps its label.

## How Settings is organised

The side menu groups its pages by what they are about:

| Group | Pages |
|---|---|
| **You** | Profile & identity · Connected accounts · AI — the first two edit the profile named in the heading ([profiles](profiles.md)) |
| **Appearance** | Themes · Graph · Layout & terminal |
| **Behaviour** | General · Git & sync · Security & confirmations · Code analyzers |
| **System** | Workspaces · Shortcuts · Environment · Data & backup · About |

General keeps only what is about the app as a whole — language, what repository
tabs show, desktop notifications, opening the changelog after an update, and
the warning when closing the app. Everything else it used to hold moved to the
page it belongs to, and General's own note links there:

| Option | Now in |
|---|---|
| Initial commits loaded, commits per "load more", auto-load on scroll, relative dates, avatars, GitHub profile pictures | **Graph**, with the palette, corners, density, node style, focus, stash layout and line width that were Themes' Graph tab |
| Auto-fetch, always create a merge commit, remember conflict resolutions, external diff & merge tools, external editor, default "Open with" app | **Git & sync** |
| Confirm before force push | **Security & confirmations** |
| When code analyzers run, launch.json | **Code analyzers** |
| File viewer (change gutter, minimap), animate the profile avatar, hide completed todos, group refs by prefix (the sidebar's lists) | **Layout & terminal** |

Integrations is now **Connected accounts**, Data is **Data & backup**. Nothing
about what a setting does changed, and saved settings carry over as they are.
A link that opens a page by its old name still lands on the right one.

## Finding a setting

Settings is spread over many pages, and the option you want is rarely where you would
guess: you know it exists, not which page holds it. The search field in the
Settings header, next to the close button, looks through every page at once.

![Searching Settings for “terminal”](../screenshots/settings-search.webp)

As you type, the right-hand side lists the matching settings grouped by page —
each with its name, its one-line description and the page it lives on. The
sidebar dims the pages with no match and shows a count on the ones that have
some.

- It matches a setting's name, its description and the page's name — also the
  page it lived on before the menu was regrouped, so "general fetch" still
  finds auto-fetch on Git & sync, and "integrations" finds Connected accounts.
  Case and accents are ignored, and every word you type has to appear, so "terminal
  font" narrows to the terminal's font settings.
- It searches in the interface language and in English at the same time:
  someone using the app in Portuguese who types "token" or "font" still finds
  the setting.
- Click a result, or press **Enter** for the first one, to open its page,
  scroll to the setting and highlight it for a moment.
- **Esc** clears the search; a second **Esc** closes Settings.

It searches names and descriptions, not the values you have set. The per-host
server lists on Connected accounts (GitHub Enterprise Server, self-managed GitLab,
Bitbucket Data Center) open the Connected accounts page; you pick the host's tab
yourself. Individual keyboard shortcuts are not indexed — the search finds the
Shortcuts page, whose editor lists them.

## Layout

Sidebar on the left or the right, resizable panels everywhere, a collapsible
sidebar for when the graph deserves the whole window, where the
[terminal](terminal.md) docks (under the graph by default) and whether it opens
with each repository, and the global **Sidebar sections** checklist — the default set of
panes every repository sidebar starts with (a repository can override it from
its own sections menu). The same page, **Settings → Layout & terminal**, also
holds the title bar and sidebar extras — **Animate the profile avatar**, **Hide
completed todos**, **Group refs by prefix** — and the file viewer's change
gutter and minimap.

**See also:** [The commit graph](graph.md) · [Profiles](profiles.md)
