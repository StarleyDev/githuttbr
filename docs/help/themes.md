---
title: Themes & appearance
category: Make it yours
order: 100
summary: Built-in themes, light and dark, plus custom and AI-generated ones.
keywords: theme themes dark light appearance colors font size graph palette search settings find preference filter
---

# Themes & appearance

Built-in themes — Gitcito, Nord, Dracula, Solarized, GitHub, Monokai,
Midnight, Contrast and Daltonic — each with a light and a dark variant.

![Switching from light to dark](../screenshots/clip-themes.webp)

- **Light, dark, or follow the OS**, switched live.
- **Custom themes**, and **AI-generated** ones from a prompt.
- Adjustable **code font size**.
- A separate **graph style**: lane palette, corner style, row density and line
  thickness, with a live mini-graph preview.

![Theme settings](../screenshots/settings-themes.webp)

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
