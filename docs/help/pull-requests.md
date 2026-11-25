---
title: Pull requests page
category: Sync & many repos
order: 57
summary: Every pull request of a repository on one page — by state, filtered by author, reviewer, target and CI — and ‹ › to walk the filtered list from inside a PR.
keywords: pull requests list page merge requests pr mr filter author reviewer mine awaiting my review review requested ci failing target branch drafts merged closed search triage previous next alt arrow navigation
---

# Pull requests page

A busy repository has twenty pull requests open at once. The sidebar lists
them, but one line each says little: whose is which, which wait on you, which
went red. Finding out meant opening each one, reading it, going back, opening
the next. The **pull requests page** answers those questions on one screen, and
once you open a pull request, **‹ ›** take you to the next one of the same list
without going back.

![The pull requests page searched for "pix": the matches highlighted, your own marked "you", a failing CI and a draft](../screenshots/pull-requests.webp)

## Opening it

- The **list icon** on the sidebar's **PULL REQUESTS** header (*See all pull
  requests*).
- *Pull requests…* in the command palette (⌘K), or **Tools → Pull requests…**.

Like the wiki and [CI runs](ci-runs.md), the page rides on the repository's tab.

## Tabs

| Tab | What it holds |
|---|---|
| **Open** | Every open pull request, drafts included |
| **Drafts** | Only the open ones marked as drafts |
| **Merged** | Merged pull requests, read when you first open the tab |
| **Closed** | Closed without merging (declined, abandoned), read with Merged |

The counts beside Open and Drafts come from the list the sidebar already holds.
Merged and Closed are asked for only when you open one of them, and once per
session; **Refresh** asks again.

## Filters

| Filter | Keeps |
|---|---|
| **Search** | Pull requests whose title, description, branches or number contain every word typed. `#482` or `482` finds that number; matches are highlighted in the title |
| **Author** | One author — each listed with how many it has in this tab. **Me** is first |
| **Reviewer** | One requested reviewer, or **Review requested from me** |
| **Target branch** | Pull requests into that branch |
| **Mine** | A shortcut for *Author: Me* |
| **Awaiting my review** | A shortcut for *Reviewer: review requested from me* |
| **CI failing** | Pull requests whose head's checks failed |

The line under the filters says how many of the tab's pull requests are shown
and which filters are on, with **clear filters** to drop them all.

Filters are kept per repository **while the app runs** — leave the page, come
back, they are as you left them. They are not saved across restarts on
purpose: a "mine, CI failing" filter brought back silently a week later would
hide pull requests you did not ask to hide.

### Who "me" is

"Me" is the account this repository's calls sign in as on the host — the
profile the repository is [bound to](profiles.md), else the active one — asked
of the host itself. When the token cannot say who it is (no user scope), or
there is no token, **Me**, **Mine** and **Awaiting my review** are not offered.

## The list

| Column | What it shows |
|---|---|
| **#** | The number, with an icon for open, draft, merged or closed |
| **Title** | The title, a *draft* badge, and who is still asked to review — in the accent colour when it is you |
| **Author** | The host's picture where it gives one, else the initial, and **you** on your own |
| **Branches** | Source → target |
| **Checks** | The head's checks rolled up — `6/6`, `1 failed`, `2 running`; hover for the counts |
| **Updated** | How long ago it last changed; hover for the date |

Rows are sorted by the latest activity. A click opens the pull request's own
page ([Hosting & pull requests](hosting.md)). On a host without that page, the
row opens the pull request in the browser.

In a [fork checkout](hosting.md#your-pull-requests-on-the-parent-of-a-fork), your pull requests on the parent are listed
too, marked *on owner/repo*.

## Walking the list from a pull request

![A pull request opened from the filtered list: ‹ 1 of 4 › and the filters it came from](../screenshots/pull-request-nav.webp)

A pull request opened from the page shows a strip above its title:

- **← Pull requests** goes back to the list, filters as you left them.
- **‹ k of n ›** moves to the previous or next pull request of the list you
  opened it from — the filtered list, in its order, as it was when you clicked.
  The tooltips name the pull request each arrow leads to.
- **Alt+← / Alt+→** do the same from the keyboard. They are rebindable in
  **Settings → Shortcuts**. They stand aside while the caret is in a text field
  (where Option+← moves by word) and while the terminal has the focus.

Moving replaces the page in place, so stepping through ten pull requests does
not leave ten icons on the tab; opening another row from the list replaces it
too.

A pull request opened **from anywhere else** — the sidebar, a notification —
walks the repository's open pull requests in the page's default order (Open,
no filters). One that is not on that list either, such as a merged level of a
stack, shows only the way back to the list.

## Limits

- **Open pull requests are the sidebar's list.** GitHub, GitLab and
  bitbucket.org read the first 30; a repository with more shows only those, and
  the Open count reads **30+**. Azure DevOps, Bitbucket Data Center and Forgejo
  read them all.
- **Merged and closed are bounded**, and the tab shows **+** when the host has
  more (its website lists them all):

  | Host | What is read |
  |---|---|
  | GitHub, bitbucket.org, Forgejo | The 100 most recently updated, merged and closed **together** |
  | GitLab | The 100 most recently updated of each |
  | Bitbucket Data Center | 100 of each in the server's *newest* order — its API does not say whether that means opened or updated |
  | Azure DevOps | 100 of each among those that ended in the **last year**; its API names no order, so past a hundred which ones is the server's choice |

  Their checks are not read — a finished pull request's CI decides nothing, and
  it would cost a request per row — so **CI failing** does not apply on those
  tabs (its chip is hidden there).
- **No account**: without a token that reaches the host, Merged and Closed say
  so instead of showing an empty list (GitHub can still read a public
  repository).
- **Checks**: GitHub and Bitbucket Data Center carry them in the list. GitLab,
  Azure DevOps and Forgejo are asked once per head when the page opens, through
  the same cache as the graph's CI badges. bitbucket.org has none.
- **Reviewers**: GitHub, GitLab, Forgejo, Bitbucket Data Center and Azure DevOps
  name who is still asked (Azure: a person who has not voted; a team is left
  out). bitbucket.org's list does not say, so the Reviewer filter is empty there.
- **Description search** works where the host's list carries the description;
  bitbucket.org may leave it out, and then only titles, branches and numbers
  are searched.
- **"Me" on bitbucket.org and Azure DevOps** is matched by display name, since
  that is how their lists name an author.
- **Updated on Azure DevOps** is when the pull request was opened (or closed):
  its list has no last-activity time.
- The walk is remembered while the app runs; after a restart, a pull request
  opened from the list walks the open pull requests instead.
