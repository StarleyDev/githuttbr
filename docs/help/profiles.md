---
title: Profiles
category: Make it yours
order: 101
summary: Separate identities and tokens for work and everything else.
keywords: profile profiles identity git user email tokens accounts switch connected accounts integrations status expired renew
---

# Profiles

A profile bundles a **Git identity** (name and email) with its **integration
tokens**. Switch profiles and both change together — commits are authored
correctly and API calls use the right account.

Useful when the same machine does work and personal repositories, or when you
have two GitHub accounts.

![Settings → Profile & identity: the profile card, the git identity with the apply hint, and the connected accounts summary](../screenshots/settings-profiles.webp)

## Editing a profile, using a profile

Two Settings pages change with the profile — **Profile & identity** and
**Connected accounts**, at the top of the **You** group, whose heading names the
profile they edit. Every other page applies in any profile and says so at the top.

**Profile & identity** opens with the profile's card: its picture, its name
(edited in place), *in use* when the app is using it, the picker and **New
profile**. **Connected accounts** opens with the same picker in a bar, *Editing
the profile*. The picker chooses which profile you are **editing**; it does not
change the one the app is **using**. When they differ, an amber band says so —
*You are editing Work. The app is using Personal* — with **Use this profile** to
switch. That is the moment an account is most easily linked to the wrong
profile, so Connected accounts also names the profile on every card and on the
button itself: **Link to the profile Work**, and the confirmation repeats it.
Deleting a profile is in the same place, and asks first.

Below the card come the git identity and commit signing. When a repository is
open and commits as someone else — its git config names another author — a line
says so, *my-repo commits as … not as this profile*, with **Apply identity to current
repo**; when the two agree there is nothing to apply and the line is not
shown. Then the profile picture, a summary of its **connected accounts** — one
line per host with *Connected*, *Token expired or error*, *Could not reach* or
*Not connected*, and **Connect** or **Renew**, which open Connected accounts on
that host — and which AI the profile uses.

The summary checks quietly, without a sign-in window, each time the page opens
or a token changes; it never polls. What it finds is also what the side menu
uses: **Connected accounts** shows a small warning count when a token was
refused or failed, and only for checks Settings already made. A host it could
not reach does not count — the token may be fine.

![Editing the Work profile while the app uses another: the amber band, and the link button naming Work](../screenshots/settings-profile-band.webp)

## The AI is shared

A profile does not need its own AI: one [general AI](ai.md#one-ai-for-every-profile)
serves every profile, and a profile opts into its own only when it must. The
choice covers everything: a profile on the general AI also writes the way the
general AI is set to — commit style, extra rules for commits, repository chat. A
profile that needs another style gets its own AI, a copy of the general one it
can then change. All of it is edited on the **AI** page; the Profile page only
says which AI the profile uses and links there.

## Each profile, its own accounts

Besides a token, a profile can **link** a login already on the machine — from
git's credential helper or the GitHub CLI — in Settings → Connected accounts. A link
belongs to one profile: a new profile starts disconnected, and an account
another profile already holds is refused, so two profiles can hold two GitHub
(or Azure DevOps) accounts side by side. See [Hosting](hosting.md#tokens).

## Per-repository binding

A repository can be **bound to a profile**, so a background fetch on it always
authenticates as the right account — even while you are looking at a repository
that belongs to the other one.

The rule is plain: **a repository's hosting actions always run as the profile it
is bound to.** Fetch, pull and push; the pull request list and every page behind
it — detail, files, checks and their logs, comments and replies, approve,
request changes, merge; creating or retargeting a pull request and submitting a
stack; CI badges in the graph; issues, milestones and releases; Azure Boards
work items. Which profile is active in the title bar does not matter, and
neither does which tab is in front. A repository that is not bound uses the
active profile.

The [clone dialog](cloning.md) binds a new repository for you: its provider tab
lists repositories, clones and then binds as the **profile picked in the
dialog** (the active one unless you change it). Change the picker and the list
reloads as that profile.

**Add remote** works the same way for a repository you already have. Its picker
starts at the profile the repository is bound to (else the active one). Pick
another, and creating the repository on the host, the push that follows and
every later hosting call run as the new pick: the repository is bound to it as
soon as the remote is added. Pasting a URL changes no binding.

When a bound profile has no credential for a host, the error says so by name —
*No GitHub account is linked to the profile "Work" this repository is bound
to* — rather than pointing at whichever profile is active.

What binding cannot do:
- It picks which of *your* saved credentials is used; it does not create one. A
  bound profile with no token or link for that host gets no credential at all —
  it never borrows the active profile's, and git's credential helper is
  switched off for that remote too, so fetch, pull and push go out as nobody
  rather than as whichever account the machine's credential manager holds. A
  private repository then fails with an error naming the bound profile until
  it has a credential for it. Like a token, going as nobody covers the remote's
  whole server — its other repositories, a redirect, Git LFS — and no other
  server on the same address. Remotes on a host no profile can serve, and
  repositories that are not bound, are left to git's helper as before.
- Notifications are the account's own inbox, not a repository's: they always
  come from the active profile.

Tokens live in your [OS keychain](security.md), never in the settings file.

**See also:** [Security & secrets](security.md) · [Hosting](hosting.md)
