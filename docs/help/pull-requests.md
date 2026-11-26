---
title: Pull requests page
category: Sync & many repos
order: 57
summary: Every pull request of a repository on one page — by state, filtered by author, reviewer, target and CI — ‹ › to walk the filtered list from inside a PR, its commits, and comments on a line of its diff.
keywords: pull requests list page merge requests pr mr filter author reviewer mine awaiting my review review requested ci failing target branch drafts merged closed search triage previous next alt arrow navigation checkout branch go to source target branch copy branch name fetch line comment inline comment review comment diff comment comment on line files tab code review commits tab commit list pr commits commit history open commit copy sha fetch pr branch markdown editor toolbar preview mention file tree folder tree view path view viewed files mark folder viewed edit delete remove edited typo
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

## Going to a pull request's branch

To work on a pull request you need its branch checked out — and in a
repository with thousands of branches, finding it in the branch list by name
is the slow part. On a pull request's page, the **Branches** field does it for
you:

- **The branch name is a link.** A click checks that branch out and takes you
  to the repository's graph, at the branch's tip. The pull request's page stays
  open on the tab.
- **A branch that only exists on the server** is fetched first — that one
  branch, not the whole remote — and checked out as a local branch that tracks
  it. A branch you already have locally is switched to as it is — it is not
  updated, so pull when you want the pull request's latest commits.
- **The branch you are already on** is marked *current* instead. Nothing is
  checked out.
- **The copy button** beside each name puts it on the clipboard.
- **Undo** (⌘Z) goes back to the branch you were on and deletes the local
  branch the checkout created — unless you have committed on it since, in which
  case it is left alone.

The header has the same two moves as buttons: **Go to source branch** and
**Go to target branch**. They work on the branch you are already on too —
they just take you to the repository.

Nothing is looked up until you click: opening a pull request does not read or
fetch any branch.

What it does not do:

- **A fork's source branch** lives in another repository, so it has no link
  (the copy button stays). **Preview pull request locally…**, offered right
  under it, is the way to run it here. The target branch still links.
- **No matching remote.** The branch is looked for on the remote whose URL is
  the pull request's repository. When no configured remote points there, the
  link does nothing and its tooltip says why.
- **A deleted branch.** A merged pull request has often taken its branch with
  it; the fetch then says the branch no longer exists on the remote, and you
  stay on the pull request.
- **Local changes.** Checking out is not destructive, so there is no confirm —
  and git refuses the checkout when your uncommitted changes would be
  overwritten. The error says which files; commit or stash them and click again.
- **This window.** The checkout happens in this repository's working tree. When
  the branch is already checked out in another [worktree](worktrees.md), that
  worktree's tab opens instead.

## Commits

The sidebar said how many commits a pull request has, never which. Reviewing
one commit at a time — the way most pull requests are meant to be read — sent
you to the browser. The **Commits** tab, between Conversation and Files, lists
them:

- **Oldest first**, the order they apply in, grouped under the day they were
  authored. A commit rebased in out of date order starts a day of its own
  rather than being moved.
- Each row has the author's picture (where the host gives one), the subject,
  the author, how long ago, and the short SHA. A **merge** badge marks a commit
  with two parents, where the host says.
- **▸** beside a commit with more than a subject shows the rest of its message.
- **Copy** puts the full SHA on the clipboard; **Open in browser** opens the
  commit on the host — inside the pull request where the host has such a page
  (GitHub, GitLab, Bitbucket Data Center), else on the repository's commit page.

![The Commits tab: a pull request's commits grouped by day, one with its full message open](../screenshots/pr-commits.webp)

**Click a row** — or Tab to it and press Enter — to open the commit in the app,
as a click in the graph would: the repository's view, that commit selected,
its details open. That works when this clone **has** the commit. When it does
not, the row says so instead of failing quietly, and offers:

- **Fetch the PR branch to see it** — the same single-branch fetch as
  [going to the branch](#going-to-a-pull-requests-branch), without the
  checkout. When the commit came with it, it opens; when it did not (a force
  push rewrote it since), the toast says so.
- **Open in browser**, for when fetching is not an option.

The list is read the first time you open the tab, not with the page, and again
on every **Refresh**. Until it is in, the tab's count is the one the host
gave for the pull request. Merged and closed pull requests list their commits
the same way.

What it does not do:

- **At most 250 commits.** GitHub itself lists no more than 250 for a pull
  request; the app stops at the same number on every host, and says *the host
  has more* when it does, with a link to the pull request on the host. Which
  250 depends on the order the host lists them in — the app keeps the ones
  listed first, and the line above the list says which:

  | Host | A longer pull request shows |
  |---|---|
  | GitHub | The **first** 250 (GitHub's own limit) |
  | GitLab, Azure DevOps, Bitbucket Data Center, bitbucket.org | The **250 most recent** |
  | Forgejo | Whichever end the server lists first; its order is not documented |
- **A fork's branch** cannot be fetched from here — it lives in another
  repository — so a commit only in the fork offers the browser alone.
  **Preview pull request locally…** is the way to bring it in.
- **A deleted branch.** A merged pull request has often taken its branch with
  it: the fetch says so. bitbucket.org lists no commits at all once the source
  branch is gone.
- **Squash merges.** A squash-merged pull request's commits never reached the
  target branch, so after its branch is deleted they are on the host only.
- **Authors** are named as their commits name them. GitLab, Azure DevOps and
  Bitbucket Data Center give no picture without a sign-in an image cannot
  send, so those rows show the initial.
- **Long messages on Azure DevOps** may be cut short: Azure's list truncates a
  commit's message, and the app shows what it sends.
- **bitbucket.org** pull requests open in the browser — the app has no page for
  them yet — so this tab is not reached there, although the app can read the
  list.

## Reading the files

A pull request of two hundred files is hard to read as two hundred full paths.
The **Files** tab's list has the same **Path / Tree** switch as the commit
panel, and the choice is the same one app-wide. In **Tree**, files sit under
their folders (a chain like `src/main/ipc` is one row), and each folder shows
its summed **+/−** and how many of its files are viewed (*3/5*). A folder's
checkbox marks every file inside as viewed, or clears them all; ticks are kept
on this computer only, never sent to the host. A tick holds the version of the
file's diff: when a push changes a viewed file, it reads as not viewed again,
with a yellow dot (*changed since you viewed it*). A file without a diff
(binary, too large) is compared by its status and line counts only. A file with review
conversations shows a speech-bubble count beside it (folders add theirs up), so
the ones with comments stand out in a long list; outdated conversations count
too. Click a folder, or press ←/→ on
it, to fold it; ↑/↓ (or j/k) step through the files on screen and open each
diff. Folded folders are remembered per pull request until the app quits, and a
file opened inside one unfolds the way to it. The tree is sorted by name, not in
the order the host lists the files.

![The Files tab in Tree view: folders with their summed changes and viewed counts, one folded](../screenshots/pr-files-tree.webp)

## Commenting on a line

Replying to a review thread was possible here; starting one was not, so a real
review still sent you to the browser. In a pull request's **Files** tab, any
line of the diff takes a comment of its own:

- **Hover a line** and press the **+** that appears over its number, or
  **click the line** itself (a click that ends a text selection, or a double
  click selecting a word, does not count — that is reading). The right-click
  menu — or the keyboard's context-menu key — has *Comment on line N* too.
- A box opens **under that line**. Write, then **Comment** — or ⌘/Ctrl+Enter.
  **Cancel** closes it; **Esc** does too, asking first when something was typed.
  Either way the focus goes back to that line.
- On success the new thread appears **under its line**, and in the
  Conversation tab's review threads, where everyone else will see it.

![A comment being written under a changed line, with an earlier thread under its own line](../screenshots/pr-line-comment.webp)

Which side the comment lands on follows the line:

| Line | Anchored to |
|---|---|
| **Added** (green) | The new version of the file, at its new number |
| **Deleted** (red) | The old version, at its old number |
| **Unchanged** | The new version (GitLab is sent both numbers, as it requires) |

Existing threads are drawn under their lines as well, with their reply box
where the host lets the app reply inside a thread (Forgejo does not). A thread
is drawn on a line only when the host says it still belongs to the diff shown;
anything else stays in the Conversation tab, rather than on a guessed line:

| Host | A thread written before the latest push |
|---|---|
| GitHub | Outdated when its line changed: Conversation only |
| GitLab | Written against an older head: Conversation only |
| Azure DevOps | Followed by Azure to where its line is now |
| Bitbucket Data Center | Orphaned when its line is gone: Conversation only |
| Forgejo | Forgejo does not say a comment is outdated, so it is drawn at its recorded line number — after a push that line may now hold other code |

A comment on a line outside the hunks shown is in the Conversation tab only, on
every host.

A comment typed and not sent counts as unsent text: **‹ ›** and Alt+arrows ask
before leaving it, as they do for the main comment box. Looking at another file
keeps it; to start one on another line, post or cancel the first.

What it does not do:

- **One line, posted at once.** There is no range of lines, no pending review to
  batch comments into and submit later, and no suggested change. Each comment is
  published the moment you send it, as its own thread (on Forgejo, as a review
  holding that one comment, since Forgejo has no single-comment call).
- **The diff you are looking at.** The Files tab remembers which commit (on
  Azure DevOps, which iteration) its diff was read at, and a comment is sent
  against that. When the pull request has moved on since — a push, a new merge
  base — the comment is not posted on whatever line now has that number: it is
  refused with *the pull request changed since this diff loaded*, and
  **Refresh** shows the new diff. On GitHub the comment is posted against the
  commit you read instead, and GitHub marks it outdated if that line has changed.
  A line the host still will not take is refused as outside the diff.
- **Refused.** Without permission to comment (a read-only token, an account the
  repository does not let comment), the host refuses it and the message says
  that is the reason.
- **bitbucket.org** pull requests open in the browser — the app has no page
  for them yet — so a line comment there is still made on the website.
- **A file without a diff** (binary, or too large for the host to include)
  has no lines to comment on.

## Writing comments

Every box on the page — the comment at the bottom, a reply inside a thread, a
comment on a line — is the same Markdown editor: **Write / Preview** tabs, a
formatting toolbar with GitHub's shortcuts, lists that continue on Enter, and
**@** / **#** completion from the people and pull requests already on screen.
A reply box shows its tools once you click into it, and sends with
⌘/Ctrl+Enter, since Enter now starts a new line. [Writing comments](writing-comments.md)
has the details and the limits.

## Editing and deleting your comments

A typo in a comment already sent, or a remark that no longer applies, used to
mean a trip to the browser. Your own comments now carry **Edit** (the pencil)
and **Delete** (the bin) at the end of their header: conversation comments,
review-thread comments and replies, in both the Conversation and Files tabs.
The issue page has them too, for its comments on GitHub and Forgejo.

![Your own comment, marked edited, with Edit and Delete at the end of its header](../screenshots/comment-editor.webp)

"Yours" is decided by the page itself, which asks the host who this
repository's calls sign in as each time it loads (its bound profile, not
whichever profile is active). Most hosts name an author by login, compared
without regard to case. Azure DevOps names authors by display name, which two
people can share, so there the comment's author id must match the account's id;
when either id is missing, no comment shows the actions. When the app cannot
tell who you are (a token without user scope, or the host did not answer), no
comment shows them either; **Refresh** asks again. The host still decides: an
account it does not let change a comment is refused, and the message says so.

- **Edit** opens the comment in place, in the same Markdown editor, with its
  text as written. **Save** (or ⌘/Ctrl+Enter) sends it; **Cancel** or **Esc**
  closes it, asking first when you changed something. Only the blank lines
  around the text are dropped: indented code and a trailing two-space line
  break stay as typed. The new text shows at once and the page reads the pull
  request again. On the pull request page, an edit nobody saved counts as
  unsent text: **‹ ›** ask before leaving it. The issue page has no such
  arrows, and nothing there asks before its tab closes.
- **Delete** always asks first, and the question says what happens: the server
  removes the comment for everyone, and it cannot be undone. There is no undo
  entry, since nothing can bring it back.

Deleting the **first comment of a thread** that has replies (a review thread,
or a conversation comment others answered) differs per host, and the confirm
names which. Two of these are not written down by the host, and say so:

| Host | First comment of a thread with replies |
|---|---|
| GitHub | The replies should stay; GitHub's documentation does not say. Replying to that thread from the app is no longer possible: its replies point at a comment that is gone, and the API takes no reply to a reply. The thread then offers **Reply on GitHub** instead |
| GitLab | Only that note goes; the thread and its replies stay |
| Azure DevOps | Should be marked deleted and hidden, with the thread and its replies kept; Azure's documentation does not say |
| Bitbucket Data Center | Refused: Data Center does not delete a comment that has replies. Delete the replies first, or edit it instead |

Some hosts mark a comment **edited**. Only Azure DevOps keeps a date for the
text alone; on GitHub, Bitbucket Data Center and Forgejo the app compares when
the comment was created and last updated, so the mark is an approximation there
(anything else that touches the comment may set it). GitLab's date also moves
when a thread is resolved, so it is not used.

What it does not do:

- **Forgejo review comments** (comments on a line) cannot be edited through its
  API, and only some versions can delete one, so they show neither action:
  change them on the website. Conversation comments work as elsewhere.
- **Someone changed it meanwhile.** Bitbucket Data Center checks the comment's
  version: an edit or a delete of a comment changed since the page loaded is
  refused, and **Refresh** shows the current one. The other hosts take the last
  write.
- **Not found**: when the host does not find the comment, the message says it
  may have been deleted, or that this account cannot see it, and the page reads
  the pull request again. An edit open on a comment that is gone is dropped.
- **bitbucket.org** pull requests open in the browser, so there is no page to
  edit their comments on yet, although the app can make the call.
- **The description** of the pull request and its reviews' summaries are not
  comments, and are not edited here.

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
