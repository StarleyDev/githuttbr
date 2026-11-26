---
title: Writing comments
category: Sync & many repos
order: 57
summary: The Markdown editor behind every comment box — Write / Preview, a formatting toolbar with GitHub's shortcuts, lists that continue on Enter, and @mention / #reference completion.
keywords: markdown editor comment box toolbar bold italic code link quote heading bulleted numbered task list checklist preview write shortcut mention at sign reference hash issue number autocomplete reply pull request description issue body
---

# Writing comments

A comment sent to GitHub is Markdown, and a bare text box leaves you to type
every `**` and `- [ ]` by hand, then find out in the browser whether the table
rendered. Every box in the app that writes to a host is now the same editor,
with the tools GitHub's own comment box has:

- a pull request's comment box, its thread replies and its line comments
  ([Pull requests page](pull-requests.md));
- an issue's comment box;
- the description of a new pull request and the body of a new issue
  ([Hosting](hosting.md)).

![The comment box on a pull request, with the formatting toolbar and the list of people to mention open on "@al"](../screenshots/comment-editor.webp)

## Write and Preview

**Preview** shows the text as it will render, drawn by the same Markdown
renderer as the rest of the app. It is read-only; **Write** brings back the
field with the text and the caret where you left them, so ⌘/Ctrl+Z still
undoes what you typed before looking.

The tabs are a tab list: with one focused, ← and → switch between them.

## The toolbar

| Tool | Shortcut | What it does |
|---|---|---|
| **Heading** | — | A menu of H1, H2 and H3 for the lines selected; picking the level a line already has removes it |
| **Bold** | ⌘/Ctrl+B | `**text**` |
| **Italic** | ⌘/Ctrl+I | `_text_` |
| **Code** | ⌘/Ctrl+E | `` `code` `` within a line; a fenced ```` ``` ```` block when the selection spans lines |
| **Link** | ⌘/Ctrl+K | `[text](url)` — a selected URL becomes the address, other text the label |
| **Quote** | — | `> ` on every selected line |
| **Bulleted list** | ⌘/Ctrl+Shift+8 | `- ` on every selected line |
| **Numbered list** | ⌘/Ctrl+Shift+7 | `1. `, `2. `… on every selected line |
| **Task list** | — | `- [ ] ` on every selected line |

Every tool is a toggle: applied to text that already has it, it takes it off.
With nothing selected, bold, italic, code and link insert a placeholder and
select it, ready to type over. A list tool replaces a list of another kind
rather than stacking on it.

The edits go through the text field's own editing, so **⌘/Ctrl+Z undoes a
tool** exactly like a typed word, and redo brings it back.

The toolbar is one stop for Tab; ← → move between its buttons, and ↓ opens the
heading menu. Inside a comment box ⌘/Ctrl+K makes a link instead of opening the
command palette.

## Lists

**Enter** at the end of a list item starts the next one — the same bullet, the
next number, an empty `- [ ]` for a task — at the same indentation. Enter on an
item with nothing after its marker ends the list and removes the marker.
Shift+Enter is a plain new line.

## Mentions and references

Typing **@** opens a short list of people, narrowed as you type; **#** lists
pull requests and issues by number and title (`#42`, or `#search` for a word
of the title). ↑ ↓ choose, Enter or Tab inserts, Esc closes the list — only
the list, not the box or the dialog around it.

The list is drawn from what the app already holds, without asking the host
again:

| Box | @ offers | # offers |
|---|---|---|
| Pull request | Its author, reviewers, assignees and everyone who commented | The repository's open pull requests and issues, as loaded in the sidebar |
| Issue | Its author, assignees and commenters | The same |
| New pull request | The people its reviewer and assignee pickers read, and the authors of the loaded pull requests | The same |
| New issue | The authors of the loaded pull requests and issues | The same |

An **@** or **#** inside a word (an email address), a heading's `#`, and
anything inside code are left alone.

## Sending

The keys the boxes had stay: ⌘/Ctrl+Enter sends a pull request or issue comment,
a thread reply and a line comment; Esc cancels a line comment. A **thread
reply** used to be a one-line field sent with Enter; it is a small text box now,
so Enter is a new line (or the next list item) and ⌘/Ctrl+Enter sends. A reply
box shows its tabs and tools once you click into it, so a long conversation
does not grow a toolbar under every thread.

**Markdown supported**, under a box on the pull request and issue pages, opens
this page. Inside the new pull request and new issue dialogs it is a plain note:
the handbook would open behind the dialog.

## Limits

- **No attachments.** Dragging a file or pasting an image into the box does not
  upload it: GitHub has no public API for comment attachments, so there is
  nowhere to put the file. Upload it on the website and paste the link.
- **Only who and what is already loaded.** @ does not search the host's users,
  and # does not search all issues — a person who has not taken part in the
  conversation, or a closed issue the sidebar did not read, is not offered. You
  can still type the name or number in full.
- **No suggested changes, saved replies or emoji picker.**
- **Preview is the app's renderer.** It shows Markdown as the app draws it; the
  host's own rendering may differ in details (GitHub-specific extensions,
  mentions turned into links).
- The shortcuts are fixed: they are not in the shortcuts settings, and do not
  follow a rebinding there.
