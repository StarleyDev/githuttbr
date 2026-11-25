---
title: Security & secrets
category: Security
order: 70
summary: Masking, guards, the keychain — and what Gitcito refuses to do.
keywords: security secrets masking keychain safeStorage tokens protected branch large file guard privacy import export settings unreadable backup parts translate paths remap another computer new machine merge profiles replace profiles choose what to export full backup another computer for the team manifest
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

![The token field in Integrations with the keychain off: saved only until you
quit, with an Enable button](../screenshots/token-keychain-notice.webp)

A token you **remove** while the keychain is off is gone at once — nothing is
sent with it any more — but only **for this session**: the encrypted store
cannot be written while the keychain is off, and the clear is kept in memory,
never in a file. Turn the keychain back on before quitting and the stored copy
is deleted then; quit first and the old token is back on the next launch. Until
then the notice stays up for that reason. To delete a stored token for good in
one step, clear it while the keychain is on.

A blank only clears what Gitcito showed you. With the keychain off from the
start, the saved tokens are never decrypted and never shown — the fields are
empty — so a token you type there and then clear again is the only one
removed; the saved one underneath it is still there once the keychain is on.

If the window reloads or crashes while the keychain explanation is on screen,
the question counts as unanswered — not as a no — and is asked again the next
time a token needs storing. Nothing waits on a question nobody can answer any
more: the settings load again normally.

### Linux without a keyring

On Linux the keychain is a secret service — GNOME Keyring or KWallet. When none
is running, the system still "encrypts", but with a fixed password that is the
same on every machine: the tokens and keys are scrambled, not protected.
Settings → Security says so under the keychain status — *No keyring is running…*
— so the word *keychain* never stands for protection that is not there.

So that nothing new lands in a store anyone could unscramble, a token you type
while no keyring runs is kept **only until you quit**. The token field says so —
*Saved only until you quit Gitcito: no keyring is running…* — with no button to
retry, because retrying cannot help; only a keyring can. Importing a settings file
with credentials says the same before it imports them. Tokens saved before stay
readable — you are never locked out of them — and clearing or replacing one still
removes the old value from disk. Two limits: the general AI key is not moved to its
shared slot (each profile keeps reading its own), and the Vault still saves to the
basic store, because it has no session-only mode. Install or unlock a keyring and
restart Gitcito to store new tokens again.

Gitcito does not take the system's word for which store it got. It counts the
store as basic when the system names it as such, when it cannot name it at all,
and when what it encrypts comes back marked with the fixed password — whatever
the system said. So a keyring that silently falls back still keeps new tokens
off the disk.

A keyring that stops answering is not waited on forever. On Linux, once the
keyring has answered once this session, a question it leaves unanswered for 10
seconds counts as *no keyring*: a token you save is kept until you quit, and the
Vault stays closed. The first question of a session — the one that may bring up
the keyring's own password prompt — and the one right after Gitcito's
explanation get two minutes, so reading a dialog is never cut short. For half a
minute after such a timeout the answer stays *no keyring* without asking again;
then Gitcito asks afresh. macOS and Windows answer locally and are never timed out.

The limit covers that one question — *is a keyring there?* A keyring that
answers it and then hangs while encrypting or decrypting is still waited on:
saving settings, and the Vault, stay busy until it answers or Gitcito restarts.

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

## Importing settings

**Settings → Import / Export** moves settings, profiles and themes between
machines. The default export carries **no tokens or API keys**, and importing
such a file never touches the ones you have saved — a blank token in the file
means "not in this file", not "remove mine".

### Choosing what to export

A backup and a file for a colleague are not the same file. A backup wants
everything; a file for another computer should not carry folders that do not
exist there; a file for the team should carry neither your accounts nor your
paths. So **Export settings** opens a dialog with the same four parts the import
offers (the table below), each with its size on this computer, and writes only
the ones you tick. A part left out is not in the file at all — importing it
later leaves that part of the other machine exactly as it is.

![Settings → Data → Export: "Another computer" picked, the green note saying the file carries no path of this machine, and the manifest of what goes in](../screenshots/settings-export.webp)

Three shortcuts above the parts tick the usual combinations. Changing a
checkbox by hand lights the shortcut that matches, or none:

| Shortcut | Parts | For |
|----------|-------|-----|
| **Full backup** | All four | Restoring this computer, or a copy of it — the same file Export wrote before it had parts |
| **Another computer** | Profiles and accounts, App preferences | Your identity and taste on a new machine, without this one's folders and programs |
| **For the team** | App preferences | A shared theme, shortcuts and graph setup — nothing personal, no paths |

Under the parts, a note says whether the file names folders or programs of this
computer: amber with **Repositories** or **Programs** ticked (the import on
another machine translates those paths or leaves out the ones it cannot find),
green without them. **Profiles and accounts** without **Programs** also leaves
out the path of the AI CLIs, which are stored with the profiles but name
binaries of this machine.

**Credentials only with Profiles, and only when you ask.** Tokens and API keys
belong to profiles, so **Include API keys, tokens & Vault secrets** is available
only with **Profiles and accounts** ticked; untick the part and the opt-in is
cleared with it. With credentials ticked, the dialog recommends **Protect with
a password** (below), and exporting them unencrypted asks once more.

A box at the bottom lists what the file will contain before you press
**Export…**: how many profiles (with or without credentials), profile pictures,
preferences, repository and program paths, whether the repository notes and
wikis and the vault go in, which parts are left out, and whether the file is
encrypted. What travels with which part:

| Extra | Goes with | Condition |
|-------|-----------|-----------|
| Profile pictures | Profiles and accounts | Pictures chosen as an image |
| Vault secrets | Profiles and accounts | Only with the credentials opt-in |
| Repository notes and wikis | Repositories and workspaces | Always with the part |

Limits: the parts are the whole unit — there is no picking single profiles,
single repositories or single preferences. **Programs** without **Profiles**
carries the terminal, editor and default apps, but not the AI CLI paths (they
live inside the profiles). The manifest counts entries; it does not show the
paths themselves. And a file without a part cannot give it back: restoring a
**For the team** file restores preferences only.

### Choosing what to import

A settings file holds two kinds of thing: what follows *you* (profiles, theme,
shortcuts) and what only makes sense on the machine that wrote it (the folders
your repositories live in, the path of your terminal). Applying all of it on a
new computer fills the sidebar with tabs pointing nowhere. So after you pick the
file (and type its password, if it has one), a dialog asks which parts to bring
in. Nothing is applied until you press **Import**; **Cancel** leaves everything
as it was.

![Settings → Data → Import: four parts, the repositories unticked because none of their folders exist here, and the path translation open](../screenshots/settings-import.webp)

| Part | What it carries |
|------|-----------------|
| **Profiles and accounts** | Profiles, git identity, integration links, the general AI settings and profile pictures — and the credentials and [vault](vault.md), when the file has them |
| **App preferences** | Theme, language, shortcuts, layout, the graph and icon colours |
| **Repositories and workspaces** | Tabs, workspaces, favourites, nicknames, tab pictures, which profile each repository uses, scanned folders, and the per-repository notes and wikis |
| **Programs on this computer** | Terminal, external editor, default apps and the path of the AI CLIs |

Each part shows how many entries the file has for it. A part left unticked
stays exactly as it is on this machine.

**Profiles merge with yours.** A file from another computer rarely has every
profile this one has — an account added on the Linux laptop, a client profile
that only exists on the Mac. So **Profiles and accounts** adds the file's
profiles to yours instead of replacing the list. Before you import, the part
lists every profile and what happens to it:

| Tag | Meaning |
|-----|---------|
| **Update** | The profile is in both: the file's identity, AI and picture replace yours, and its servers are added to yours |
| **New** | Only the file has it: added after yours |
| **Keeps** | Only this computer has it: left exactly as it is |

Two profiles are "the same" when they share an id — the first profile on every
install does. When no id matches, the name does (ignoring case and surrounding
spaces), and the profile keeps **this computer's id**: the repositories bound
to it, the active profile, its saved credentials and its picture all stay
attached. Which profile is active does not change, and neither does the
**general AI**: the engine and model this computer answers with stay its own.

**Replace all** is still there, for a backup you want back exactly as it was:
only the file's profiles remain, and the ones only this computer has are listed
struck through as **Removed**. Pressing **Import** then asks once more, naming
them — they go with their saved credentials and picture, and that cannot be
undone. With **Replace all** the file's active profile becomes the active one,
and the file's general AI replaces this computer's.

Limits: matching is by id or exact name only — a profile renamed on one side
counts as new, and you end up with both. A matched profile takes the file's
fields, with three exceptions so that nothing only this computer has is lost:
its GitHub Enterprise, GitLab and Bitbucket servers are **added** to yours
(the file's entry wins on a server both have); a token the file carries blank
keeps yours — but only for the same instance, so a token is never sent to a
different Forgejo, GitLab issuer or Azure organization; and the logins borrowed
from this machine's credential helper stay this machine's.

**The defaults are a guess from your disk.** Before the dialog shows, Gitcito
checks whether the repository folders in the file exist here. If none do, the
file comes from another computer: **Repositories** and **Programs** start
unticked, each with the reason — the programs' paths are listed, so you can see
they belong elsewhere. If they do exist, it is the same computer (a backup
restored, say), everything starts ticked and a green note says so. A file
with no repositories at all is judged by its program paths instead: **Programs**
starts ticked only when every one of them exists here.

When the check itself fails, nothing is guessed: **Repositories** and
**Programs** start unticked with no verdict, a **Check again** button asks the
disk once more, and **Repositories** cannot be imported until a check succeeds.
The other parts can.

**Translating paths.** Tick **Repositories** on a file whose folders are
missing and a **Translate paths** box opens. On the left, the folder the file's
repositories have in common (`/home/you/code`); on the right, where that folder
is on this computer, pre-filled from your home folder (`/Users/you/code`). Both
are editable — the guess can be wrong, and when Gitcito finds no common folder
it leaves both empty for you to type. A bar counts, as you type, how many
repositories now have a folder here, with a few of them listed — green found,
red still missing. The swap carries the repository's nickname, tab picture and
profile with it, and its notes, wikis and vault entries, so nothing has to be
set again by hand.

The footer sums it up — *Import 3 of 4 parts · 31 folders* (scan roots and the
last clone folder count too, so it says folders, not repositories) — and
**Import** stays off until at least one part is ticked.

**Import also stays off when a translation finds nothing.** With
**Repositories** ticked and not one folder found under the new prefix, importing
would leave your repositories empty; fix the paths or untick the part.

Limits of the translation:

- It is **one prefix swapped for another**. Repositories under a different
  folder in the file, or laid out differently here, are not found; there is no
  per-repository mapping.
- With a translation in effect, **only the repositories that then have a folder
  are imported**. The rest are left out — not added as broken tabs — and the
  dialog tells you how many.
- Programs are never translated: `/usr/bin/code` has no reliable counterpart on
  another system. Leave that part unticked and pick them in Settings.
- Clearing either prefix imports the paths as the file has them.

**While it imports** the dialog cannot be dismissed. If a later step fails —
the repository notes, the vault, the profile pictures — the dialog stays open,
names the step, and **Continue import** resumes there without writing the
earlier steps again.

### Credentials in the file

A file exported with the opt-in carries credentials. Merging profiles always
**adds** them: the file's are filed under the matching profile, replacing any
for the same account, and every other saved credential stays — clearing them
would contradict keeping your profiles. With profiles on **Replace all**, such
a file also shows the choice, right under **Profiles and accounts**:

| Choice | Your saved credentials |
|--------|------------------------|
| **Add to mine** | The file's are added, replacing any for the same account; all the others are kept |
| **Replace all** | Become exactly the file's — every saved token and API key the file does not have is deleted |

The choice applies with the profiles: with **Profiles and accounts** unticked,
no credential is imported or removed. A file exported without the opt-in has
none to offer, whatever you tick. **Replace all** asks once more when you press
**Import**, saying that every saved token and API key the file does not have
will be deleted; **Cancel** there leaves the dialog as it was.

**Replace all needs the keychain.** With the keychain off or unavailable, the
old tokens would stay in the encrypted store and come back on the next launch,
so Gitcito refuses instead: it says so, and nothing is imported. The same goes
while the saved tokens cannot be read (see above): they would come back the
moment they could. **Add to mine** still works, keeping the file's tokens for
the session.

**The limit:** credentials belong to a profile. A profile the import removes
takes its saved tokens with it, whichever you choose.

### Protecting an export with a password

An export with the credentials ticked is as good as the tokens themselves to
whoever finds the file — a synced folder, a forgotten USB stick, an attachment.
**Protect with a password**, in the export dialog, encrypts the file with the
same cipher as [Secure share](secure-share.md) (a scrypt-derived key and
AES-256-GCM), so nothing in it — not even whether it carries credentials — can
be read without the password.

It is optional, with or without the credentials tick, and the password has no
minimum length. You type it twice and tick that you understand it cannot be
recovered; importing the file asks for it — in a dialog in Settings, inside the
welcome step on first run — and a wrong one asks again.

![Settings → Data → Export: a file protected with a password, the no-recovery warning acknowledged](../screenshots/settings-export-password.webp)

| | Without a password | With a password |
|---|---|---|
| **Who can read it** | Anyone who has the file | Only someone with the password |
| **A changed byte** | Read as it is | Refused, as a wrong password is |
| **Opens in** | Any version | Versions that know the encrypted format |

**There is no recovery.** The password is not kept anywhere — not in the file,
not on this machine — and there is no server to ask. Forget it and the file is
lost; export again from a machine that still has the settings.

Limits: an older version cannot open an encrypted export, and it does not know
that either — it reports the settings as imported and changes nothing. Import a
protected file with a version that asks for its password. A short password is
still weak against someone who has the file and time to guess; the scrypt key makes each guess slow, not impossible. The
password protects the file, not the running app: the credentials are decrypted
in memory while they are gathered for the export, as they always were.

## The settings file

The settings file and the encrypted token store are written whole: to a new
owner-only file beside them, then swapped in, so a crash or two saves at once
never leave half a file. If the settings file is symlinked elsewhere (a
dotfiles repository), the write goes to the link's target and the link stays.
Gitcito never replaces the link. One pointing at a file that is not there yet is
written through, creating that file — as long as its folder exists. When the
folder is gone too, the save fails instead, with one message saying so: the
link and wherever it points are left untouched, and changes made meanwhile last
only until Gitcito closes. Restore the folder, or point the link somewhere that
exists, and the next save goes through.

Plaintext tokens an older version left in the settings file are never dropped
by a save: they stay in the file until Gitcito loads them into the encrypted
store (opening Settings does), unless you clear one yourself.

Only two things write them: a save of your settings, and Gitcito loading them
(at start-up, or when Settings opens) — which is when an old plaintext token is
moved into the encrypted store, or a server address with a password in it is
cleaned. A lookup nobody asked for — a fetch resolving its token, an AI call
finding its key, a profile picture — only reads, so it can never land on top of
a save. A save is also refused until the settings have been loaded at least
once: before that, the app holds only defaults.

**The cost on an old install** that still has plaintext tokens in its settings
file: until Settings is opened once (or the app restarts and loads them), each
lookup that needs a token decrypts the store again, and profile pictures that
need a stored token wait. Nothing is moved by a lookup, so a token you clear in
the meantime stays cleared.

One that exists but cannot be parsed (a hand edit gone wrong, a damaged disk)
is **never** replaced by the defaults: Gitcito says the file is damaged and
starts no further — no shortcut or menu command can save over it from that
screen.

![The boot screen for a damaged settings file, with Try again and Move the damaged file aside and start fresh](../screenshots/settings-damaged.webp)

You can fix `gitcito-settings.json` in its data folder and press
**Try again**, or press **Move the damaged file aside and start fresh**: the file
is renamed to `gitcito-settings.json.corrupt-<date>` (never deleted, so you
can still recover from it), a copy of the encrypted token store is kept beside
it, and Gitcito starts as on a first run, with a note saying where the file
went. For a symlinked settings file it is the link's target that is renamed, so
the damaged copy stays in your dotfiles, beside the fresh settings file the
first save then writes through the link. The copy is made first: if it cannot
be written, nothing is moved, and the screen says so and shows the data folder
to check, since starting fresh without the copy would let the first token you
save delete the old profiles' tokens. Fix what keeps the folder from being
written to (permissions, a full disk) and press **Try again**.

If the file goes bad while Gitcito is running (edited by hand underneath it),
saves stop and Gitcito says so once: settings cannot be saved until it is
restarted, and changes made in the meantime are lost.

A file that is there but cannot be *read* for a moment — another program, such
as an antivirus scan, holding it — is retried for about two seconds. If it still
fails, or loading fails for any other reason, Gitcito says it could not start,
that the file has not been changed, and offers **Try again**; it does not call
the file damaged.

### Known limits

These need unusual conditions, and are listed so nobody is surprised by them:

- **A very old install with tokens still in the settings file.** If the keychain
  is turned off after the saved tokens were unlocked, or declined while an AI key
  is still stored in the old plaintext format, that plaintext copy can be dropped
  on the next save and the token is gone after a restart. Open Settings once with
  the keychain on after upgrading from such a build, and the tokens move into the
  encrypted store for good.
- **A save and a failed reload crossing in the same window.** A token typed in a
  save that overtakes a reload which then fails cannot be cleared from that
  window until Settings loads again; reopen Settings and clear it.
- **A symlinked settings file whose folder is missing.** The token store is
  written before the settings file fails, so the two are out of step until the
  folder is back. Restore it (mount the drive, clone the dotfiles) and save again.

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
| `.deb` | Installs `/etc/apparmor.d/gitcito`, a profile for `/opt/GitHuttBr/gitcito` that allows user namespaces. The app runs sandboxed. |
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
