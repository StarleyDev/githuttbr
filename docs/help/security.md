---
title: Security & secrets
category: Security
order: 70
summary: Masking, guards, the keychain — and what Gitcito refuses to do.
keywords: security secrets masking keychain safeStorage tokens protected branch large file guard privacy import export settings unreadable
---

# Security & secrets

Gitcito has **no backend**. The only network calls are to your Git host and, if
you turn it on, your AI provider.

![Security settings](../screenshots/settings-security.webp)

## Secret masking

Values in `.env*`, `*.pem`, `*.key`, `id_rsa`, `credentials.*` and friends
render as `KEY=••••••` in the diff, file and blame views, so a screen-share or a
screenshot cannot leak them. Apple signing material counts:
`*.mobileprovision`, `*.provisionprofile`, `*.p12` and the `*.p8` App Store
Connect keys. A `*.cer` does not — a certificate is public by design.

It is **display-only**: it never changes the file and never changes what you
stage. An eye toggle reveals them per view. `.env.example`, `.sample` and
`.template` are treated as templates, not secrets.

![A .env rendered with every value masked, and the reveal toggle](../screenshots/secret-masking.webp)

## Guards before you do damage

| Guard | When |
|---|---|
| **Secret file** | Committing something that looks like a credential — with a one-click *Ignore & untrack* |
| **Large file** | Committing an oversized blob (threshold in Settings → Security) |
| **Build noise** | Committing `xcuserdata/`, `DerivedData/` or a `.DS_Store` — with the same one-click *Ignore & untrack* |
| **Protected branch** | Committing straight to `main`/`master`, or force-pushing one |
| **Tracked secrets** | Pushing a repository that *tracks* a secret file — warned once per session |

## The AppImage and paths that outlive it

An AppImage runs from a folder under `/tmp` (`/tmp/.mount_…`) that exists only
while the app is open, is renamed every launch, and sits in a directory every
local user can write to. Up to 4.37.1, the AppImage could write a path inside
that folder into two places that outlive it: the `gitcito` link in `PATH`
([CLI](cli.md)) and a repository's `diff.<name>.textconv` setting
([attributes](attributes.md)). Once the app quits, another user on the same
machine could recreate the folder with a program of their own, which your next
`gitcito` or `git diff` would run.

Gitcito now refuses both under an AppImage, warns about a stale `gitcito` link
at start-up (with a palette command to remove it), and flags a stale converter
in the Attributes dialog with a **Remove** button. It can only see the
repository you have open; to find stale converters elsewhere, run
`git config --get-regexp 'diff\..*\.textconv'` in each repository (and with
`--global`) and unset any entry under `/tmp/.mount_`. A single-user machine is
not exposed, but the stale entries are still dead weight.

## The OS keychain

Tokens and [vault](vault.md) entries are encrypted with your OS keychain
(Electron `safeStorage`), never with a key in the settings file.

**Nothing touches the keychain until you say so.** Before the system's own
permission dialog can appear, Gitcito explains what is being stored, what it
cannot do (an app only ever reads back the entry it created — your other
passwords are unreachable), and that saying no is fine: tokens then live in
memory for the session only, the vault stays closed, and you can turn it on
later in **Settings → Security → OS keychain**.

A fresh install makes **zero** keychain calls until something actually needs
storing.

While it is off, the token field in Integrations says so — *Saved only until you quit Gitcito: the OS keychain is off.* — with an **Enable** button beside it. Turning it on, from there or from here, also stores the tokens you already typed in this session, so nothing has to be pasted again.

## Importing settings

**Settings → Import / Export** moves settings, profiles and themes between
machines. The default export carries **no tokens or API keys**, and importing
such a file never touches the ones you have saved — a blank token in the file
means "not in this file", not "remove mine".

A file exported with the opt-in carries credentials, so importing it asks:

| Choice | Your saved credentials |
|--------|------------------------|
| **Add to mine** | The file's are added, replacing any for the same account; all the others are kept |
| **Replace all** | Become exactly the file's — every saved token and API key the file does not have is deleted |
| **Cancel** | Nothing is imported |

**The limit:** credentials belong to a profile. A profile the import removes
takes its saved tokens with it, whichever you choose.

## The settings file

The settings file and the encrypted token store are written whole: to a new
owner-only file beside them, then swapped in, so a crash or two saves at once
never leave half a file. One that exists but cannot be parsed (a hand edit gone
wrong, a damaged disk) is **never** replaced by the defaults: Gitcito says it
could not read it and starts no further. Fix or move `gitcito-settings.json` in
its data folder, then restart.

## A profile's token while git runs

When a [profile](profiles.md) signs a fetch, pull or push in with its token,
Gitcito does not write the token into `.git/config` or into the command line,
where any local user could read it in the process list. It hands it to that one
git command through its **environment** (`GITCITO_GIT_PASSWORD*`), with a
credential helper scoped to the remote's host.

**The limit:** every program that git command starts inherits that environment.
That includes the repository's **hooks** — a `pre-push` hook, a husky script, a
`post-merge` hook a pull triggers — which can read the token while the
operation runs, and so can anything those hooks start in turn.

What follows from that:

- **Do not run hooks you do not trust** with a profile signed in. A repository
  you just cloned can ship hooks through tools such as husky, which install
  them on `npm install`; git runs whatever sits in `.git/hooks`, from Gitcito
  or from a terminal alike. Read a stranger's hooks before you push from their
  repository.
- **Scope the token down.** A token that can only write to the repositories you
  work on is worth much less to a hook that leaks it than an all-access one.
- **SSH remotes are not affected** — no token goes into the environment for
  them; the [SSH agent](ssh-keys.md) answers instead.

A delivery that keeps the token away from hooks is planned; until then, this is
how it works.

## Sharing safely

[Secure share](secure-share.md) exports settings, vault entries or whole
workspaces as an **encrypted bundle** — secrets are only ever included when you
tick the box.

## Reporting a problem

**Report issue** on an error opens a pre-filled GitHub issue — and opening it
already sends the text to GitHub, before you choose to post. So the message is
cleaned first: a credential written into a URL, tokens, your home folder (and
with it your user name), private servers and repository paths, e-mails and LAN
addresses are replaced. Public hosts such as `github.com` stay, and git's own
message stays readable. Read the issue before posting it all the same: the
cleaning recognises known shapes, not everything private.

**See also:** [Vault](vault.md) · [Secure share](secure-share.md)
