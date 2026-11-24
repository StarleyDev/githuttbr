---
title: Themes & appearance
category: Make it yours
order: 100
summary: Built-in themes, light and dark, plus custom and AI-generated ones, and colored icons.
keywords: theme themes dark light appearance colors colours font size graph palette search settings find preference filter icon icons icon colors tint monochrome
---

# Themes & appearance

Built-in themes — Gitcito, Nord, Dracula, Solarized, GitHub, Monokai,
Midnight, Contrast and Daltonic — each with a light and a dark variant.

![Switching from light to dark](../screenshots/clip-themes.webp)

- **Light, dark, or follow the OS**, switched live.
- **Custom themes**, and **AI-generated** ones from a prompt.
- Adjustable **code font size**.
- **Icon colors** for the toolbar and the sidebar sections — see below.
- A separate **graph style**: lane palette, corner style, row density and line
  thickness, with a live mini-graph preview.

![Theme settings](../screenshots/settings-themes.webp)

## Icon colors

A row of grey icons makes Fetch, Push and Stash look alike until you read their
labels. **Icon colors**, under Appearance on the Theme tab, colors each icon by
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
- **Settings pages** — Layout, Workspaces and AI in the accent; Profile and
  Environment green; Integrations and Data cyan; Themes orange; Security red.
  General and Shortcuts stay grey.

| Option | What you see |
|---|---|
| **Monochrome** | Every icon grey, as before this option existed |
| **Soft tint** (default) | The color mixed into the grey; the whole color on hover |
| **Full color** | The color itself, on a small chip of the same hue |

The colors come from the theme — a theme that repaints its green or its accent
repaints the icons with it, custom and AI-generated themes included.

Limits: only the toolbar's main buttons, the sidebar section headers, the Tools
menu and the Settings pages are colored; other menus, the rows inside a section
and the commit graph are not. A hovered menu row keeps its usual look, icon
included. Color
is never the only clue — every icon keeps its label.

## Finding a setting

Settings is spread over many pages, and the option you want is rarely where you would
guess: you know it exists, not which page holds it. The search field in the
Settings header, next to the close button, looks through every page at once.

![Searching Settings for “terminal”](../screenshots/settings-search.webp)

As you type, the right-hand side lists the matching settings grouped by page —
each with its name, its one-line description and the page it lives on. The
sidebar dims the pages with no match and shows a count on the ones that have
some.

- It matches a setting's name, its description and the page's name. Case and
  accents are ignored, and every word you type has to appear, so "terminal
  font" narrows to the terminal's font settings.
- It searches in the interface language and in English at the same time:
  someone using the app in Portuguese who types "token" or "font" still finds
  the setting.
- Click a result, or press **Enter** for the first one, to open its page (and
  the right tab on Themes — Theme or Graph), scroll to the setting and
  highlight it for a moment.
- **Esc** clears the search; a second **Esc** closes Settings.

It searches names and descriptions, not the values you have set. The per-host
server lists on Integrations (GitHub Enterprise Server, self-managed GitLab,
Bitbucket Data Center) open the Integrations page; you pick the host's tab
yourself. Individual keyboard shortcuts are not indexed — the search finds the
Shortcuts page, whose editor lists them.

## Layout

Sidebar on the left or the right, resizable panels everywhere, a collapsible
sidebar for when the graph deserves the whole window, where the
[terminal](terminal.md) docks (under the graph by default) and whether it opens
with each repository, and the global **Sidebar sections** checklist — the default set of
panes every repository sidebar starts with (a repository can override it from
its own sections menu).

**See also:** [The commit graph](graph.md) · [Profiles](profiles.md)
