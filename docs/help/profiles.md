---
title: Profiles
category: Make it yours
order: 101
summary: Separate identities and tokens for work and everything else.
keywords: profile profiles identity git user email tokens accounts switch
---

# Profiles

A profile bundles a **Git identity** (name and email) with its **integration
tokens**. Switch profiles and both change together — commits are authored
correctly and API calls use the right account.

Useful when the same machine does work and personal repositories, or when you
have two GitHub accounts.

![A profile: git identity on one side, its integration tokens on the other](../screenshots/settings-profiles.webp)

## Each profile, its own accounts

Besides a token, a profile can **link** a login already on the machine — from
git's credential helper or the GitHub CLI — in Settings → Integrations. A link
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
  private repository then fails with an authentication error until the profile
  has a credential for it. Remotes on a host no profile can serve, and
  repositories that are not bound, are left to git's helper as before.
- Notifications are the account's own inbox, not a repository's: they always
  come from the active profile.

Tokens live in your [OS keychain](security.md), never in the settings file.

**See also:** [Security & secrets](security.md) · [Hosting](hosting.md)
