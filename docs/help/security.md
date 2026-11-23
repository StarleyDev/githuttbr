---
title: Security & secrets
category: Security
order: 70
summary: Masking, guards, the keychain — and what Gitcito refuses to do.
keywords: security secrets masking keychain safeStorage tokens protected branch large file guard privacy import export settings unreadable backup
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

A token you **remove** while the keychain is off is gone at once — nothing is
sent with it any more — and the stored copy is deleted the moment the keychain
is back on. Until then the notice stays up, since quitting first would bring
the old token back.

### When the saved tokens cannot be read

If you dismiss the system's keychain prompt, the keyring is locked, or the token
store was written by another copy of Gitcito (a development build, a re-signed
one), Gitcito **cannot read your saved tokens — and leaves them untouched**.
Settings → Security says *Gitcito could not read your saved tokens*, and a token
you type meanwhile is kept for the session only (the field says so too). It is
never written over the store it could not read: that would replace every saved
token with the one you just typed.

| Button | What it does |
|--------|--------------|
| **Retry** | Reads the store again — the system may ask for the keychain now. Once it can be read, the tokens typed meanwhile join it. |
| **Start a new token store** | Asks first. Gitcito stops waiting for the old store and starts a new one with only this session's tokens. The old file stays beside it as a backup for 30 days, then it is deleted. For a store that is gone for good, not a prompt you dismissed. |

The settings file gets the same rule: one that exists but cannot be parsed (a
hand edit gone wrong, a damaged disk) is **never** replaced by the defaults.
Gitcito says it could not read it and starts no further; fix or move
`gitcito-settings.json` in its data folder, then restart.

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

## A profile's token while git runs

When a [profile](profiles.md) signs a clone, fetch, pull or push in with its
token, the token goes into none of the places another program could read it:
not `.git/config`, not the command line (any local user can read the process
list), and not the **environment** of the git command — which every hook, filter
and LFS process git starts inherits, along with every npm package a husky or
lefthook script runs.

Instead, for each operation Gitcito opens a private endpoint of its own — a
socket in a folder only your user can enter (a named pipe with a random name on
Windows) — and registers a credential helper for that one server. When git asks
for a login, the helper connects, proves it belongs to this operation with a
random code made for it alone, says which host and repository git is asking about, and
receives the login. The endpoint answers every request of the operation — git
can ask more than once, for LFS, after a redirect, for each process it starts —
and is closed and deleted when git exits. A hook that dumps its environment
finds the code, not the token.

What it still cannot do:

- **A hook can still ask, while the operation runs.** That code is in
  git's environment, because the helper is a program git starts and git gives
  every program it starts the same environment. A hook written to speak the
  helper's protocol can use the code to ask for the login until git exits —
  that is exactly how git-lfs's `pre-push` hook gets one. It is a far smaller
  opening than a token sitting in a variable — nothing reads it by accident,
  a dump or a crash report shows only a code that is useless once git exits —
  but it is an opening.
- **It answers only for the server it was opened for.** The endpoint refuses
  any other host, a plain `http` request, a path outside the server's base, and
  a server nested under it (a Data Center at `/bitbucket` beside a GitLab at
  the root) — even with the right code. A multi-URL push gets one endpoint per
  server, each holding only that server's login. Under a server with another
  nested inside it, a path the nested server's proxy could route to itself is
  refused too: any `;` in it (Tomcat drops `;params`), a segment ending in a
  dot, and the nested base's name in another case or as a prefix
  (`/Bitbucket/`, `/bitbucketx/`) — so a group on the outer server whose name
  starts with the nested server's path does not get its token either.
- **A carve-out does not survive a redirect on the server's own side.** The
  check is on the path git asks about. If the outer server itself redirects a
  request into the nested server's path, or a proxy rewrites it there after
  git has sent its login, no client can see that.
- **A login inherited through `git -c` is set aside.** A credential helper (or
  an `include` that could add one) passed down in `GIT_CONFIG_PARAMETERS` — the
  app started from a git alias, or by another git — is removed for the
  operation, so it is never offered the profile's token to store, nor asked as
  nobody. Every other inherited `-c` setting is kept.
- **A server address must be written the way git reads it.** Gitcito names the
  server by the standard URL rules, git by its own: an internationalised name
  (`bücher.example`), a numeric shorthand (`127.1`, `0x7f.0.0.1`), a compressed
  or mapped IPv6 address, or an encoded character in the host are a different
  server to each. With a profile involved, such an address is refused with a
  message instead of being left to the machine's own login. Case and an
  explicit default port (`:443`) are fine.
- **Git older than 2.26** matched a credential entry only for the exact
  address, not for everything under a server's base. Asking as nobody, the app
  then switches the helpers off for the whole host for that one command;
  signing in with a token needs git 2.31 anyway.
- **Do not run hooks you do not trust** with a profile signed in all the same. A
  repository you just cloned can ship hooks through tools such as husky, which
  install them on `npm install`; git runs whatever sits in `.git/hooks`, from
  Gitcito or from a terminal alike, and a hook can do far worse than read a
  token.
- **Scope the token down.** A token that can only write to the repositories you
  work on is worth much less to anything that gets hold of it.
- **SSH remotes are not affected** — no token is involved; the
  [SSH agent](ssh-keys.md) answers instead.

## Sharing safely

[Secure share](secure-share.md) exports settings, vault entries or whole
workspaces as an **encrypted bundle** — secrets are only ever included when you
tick the box.

## Reporting a problem

**Report issue** on an error opens a pre-filled GitHub issue — and opening it
already sends the text to GitHub, before you choose to post. So the message is
cleaned first: a credential written into a URL, tokens, your home folder (and
with it your user name), private servers and repository paths, the name of the
profile a repository is bound to, e-mails and IP addresses are replaced. Public
hosts such as `github.com` stay, and so do file names and git's own message.

**The limit:** a server name standing alone in a sentence is recognised by its
shape — dotted, lower case. A one-word host (`gitserver`) is caught only in the
messages Gitcito itself writes, and a server under a top-level domain spelled
like a file extension (`.sh`, `.md`) is kept as a file name. Read the issue
before posting it all the same: the cleaning recognises known shapes, not
everything private.

## What stays on disk

The settings file, the operation log, the avatar cache and the encrypted token
store are readable by your account only (on macOS and Linux). A server address
saved with a `user:password@` or a `?token=` in it — from an import or an older
version — has that part removed when it is read, imported or saved. The commit
avatar cache stores no e-mail addresses, only hashes salted per install.

Each of these files is written whole: to a new file beside it, then swapped in,
so a crash or two saves at once never leave half a file — which Gitcito would
otherwise have to treat as unreadable. A backup of the token store is deleted
early only when every token in it is also in the current store; any other
backup is kept for 30 days.

## Linux packages: the sandbox and AppArmor

Chromium's sandbox needs unprivileged user namespaces. Ubuntu 24.04 and later
deny those to any program without an AppArmor profile that allows them, and
the two Linux packages deal with that differently:

| Package | What happens |
|---------|--------------|
| `.deb` | Installs `/etc/apparmor.d/gitcito`, a profile for `/opt/Git HuttBr/gitcito` that allows user namespaces. The app runs sandboxed. |
| AppImage | Has no profile. Its launcher tries `unshare -Ur true`, and when that fails it starts the app with `--no-sandbox` — on Ubuntu 24.04+, that is every launch. Gitcito prints a warning to its console output when this happens. |

To run the AppImage sandboxed, install the `.deb` instead, or give the
AppImage its own AppArmor profile that allows `userns` (or, machine-wide,
`sysctl kernel.apparmor_restrict_unprivileged_userns=0`, which switches the
restriction off for everything).

**The limit of the `.deb` profile.** It is `flags=(unconfined)` with `userns`
allowed, and it attaches to the executable path. The same executable also runs
as plain Node when started with `ELECTRON_RUN_AS_NODE=1` — that is how the
`gitcito` command, the bundled diff converter and Gitcito's credential helper
work, so the switch cannot be turned off without breaking them. Together that
means any local program can use Gitcito's executable as a Node interpreter that
is allowed to create user namespaces — the same kind of gap as the known
workarounds for Ubuntu's restriction through other profiled programs. It does
not give anyone more than their own account's rights; it weakens a kernel
hardening layer Ubuntu adds on top. AppArmor cannot tell the two modes of one
executable apart, so a narrower profile is not possible while the CLI shares
it; a separate helper binary for the CLI is on the roadmap.
Administrators who would rather not have this can add a deny rule in
`/etc/apparmor.d/local/gitcito`, at the cost of the sandbox.

**See also:** [Vault](vault.md) · [Secure share](secure-share.md)
