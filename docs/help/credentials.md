---
title: Credential helper
category: Security
order: 73
summary: Git's own password store — the third one — and why https keeps asking you again.
keywords: credential helper password https asks again osxkeychain wincred manager libsecret store cache git-credentials plaintext forget revoked token 401 token in remote url embedded password invalid username or token authentication failed set-url
---

# Credential helper

GitHuttBr holds three different kinds of secret, and people reasonably assume they
are one thing:

| | Held by |
|---|---|
| Host API tokens — PRs, issues, CI checks | GitHuttBr, in your [OS keychain](security.md) |
| `git@…` transport | Your [SSH key](ssh-keys.md), via the system ssh agent |
| **`https://` transport** | **Git's own credential helper** |

The third one is nobody's idea of a feature until it goes wrong, and then it
produces the two most common complaints in git: *why is it asking me again?* and
*why is it still sending the token I revoked?*

`⌘K` → **Credential helper**.

![The configured helper, per-host rules, and the plaintext-file warning](../screenshots/credentials.webp)

## What you are looking at

Every configured `credential.helper`, in the scope it comes from — `system`,
`global`, then this repository. **Helpers stack**: git asks each in turn, and a
repository-level one does not replace a global one.

Each is checked against your machine:

| Flag | Means |
|------|-------|
| **ready** | The helper program exists and will run |
| **not installed** | Configured, but the program is missing — every prompt falls through to typing it again |
| **passwords in a plain file** | The `store` helper (see below) |

**Rules for specific hosts** lists `credential.<url>.*` sections. These beat the
plain setting for the URLs they match, and are usually the answer to "why does
this one host behave differently".

## Choosing one

| Helper | Where the password goes |
|--------|------------------------|
| `osxkeychain` | macOS Keychain — encrypted, per-user |
| `manager` | Git Credential Manager (Windows, cross-platform) |
| `wincred` | Windows Credential Manager |
| `libsecret` | The Linux secret service (GNOME Keyring, KWallet) |
| `cache` | Memory, for 15 minutes. Nothing on disk |
| `store` | **A plain file in your home directory. Unencrypted** |

GitHuttBr offers what is actually installed on this machine, marks the one that
fits your OS, and greys out the rest.

**Scope matters.** *For every repository* writes to your global config, which is
what you almost always want; *for this repository only* is for the odd repo that
authenticates against something else.

## The `store` helper, and `~/.git-credentials`

`store` writes `https://user:password@host` lines to `~/.git-credentials`, in
plain text, with no encryption of any kind. Anything that runs as you can read
it: a script, a dependency's postinstall, anything.

If that file exists, this page says so and counts the entries. It never shows
them — the count is the whole point, and reading the contents to display them
would be the same mistake.

If you find one and did not mean to: pick a real helper here, then delete the
file and re-authenticate once.

## Forgetting a stored credential

When a token is revoked or rotated, the helper keeps handing over the old one
and every push fails with a 401 that names nothing. **Forget** asks the
configured helper to erase its entry for that host — `git credential reject`,
which is git's own documented route.

Nothing is read on the way: GitHuttBr never calls `git credential fill`, the
command that would print a live password to standard output.

The next push asks you once, and the helper stores the new answer.

## Which account a push uses

Each push URL is checked separately. A write scope is only a token capability. Repository membership, branch rules, and permission to update a particular file are not tested. Public reads can succeed without a credential.

![Remote sign-in check](../screenshots/remote-sign-in.webp)

A push can sign in in several ways: a profile's token, a GitHub CLI login linked
to a profile, git's own helper, a password left in the remote URL, or an SSH
key. When it is refused, you first need to know which of these it used. Right-click
a remote in the sidebar and choose **Check sign-in…** (or *Check remote sign-in*
in the command palette). The check resolves the credential the same way a push
does, then asks the host about it:

| It shows | Where it comes from |
|----------|--------------------|
| The source, and the [profile](profiles.md) behind it | The same precedence a push applies — the repository's bound profile, else the active one, else git's helper |
| The account | The host's own answer (`/user`), not what was typed into Settings |
| The scopes | GitHub's `X-OAuth-Scopes` header; GitLab's description of its own token |
| What they allow | Write-related token scopes (`repo` on GitHub, `write_repository` on GitLab), and on GitHub whether `.github/workflows` can change |

It also flags a credential the host refuses (expired or revoked), a linked
account that is no longer signed in, and a password stored in plain text in the
remote URL.

**Limits.** A fine-grained GitHub token does not list its permissions, so
whether it can push shows as unknown until a push tries. Forgejo reports the
account but not the token's permissions. Azure DevOps and Bitbucket are shown by
source and profile only. SSH remotes are not tested, but
[SSH keys](ssh-keys.md) lists what the agent holds. The check asks git's helper
silently: a helper that needs a login window counts as having nothing.

## A password saved in the remote URL

An old clone, or a URL pasted from a wiki, can carry its credential inside the
address: `https://user:token@git.example.test/team/app.git`. **A password in the
URL always takes priority:** git sends it and asks no helper at all — not the
token of the repository's [profile](profiles.md), not the GitHub CLI, not git's
own store. While the token works, that is fine, and GitHuttBr leaves it alone:
**it never removes a password from a URL without asking you.** Once the token is
revoked or expires, every fetch, pull and push of that one repository fails with
*Invalid username or token* or *Authentication failed*, while the other
repositories on the same profile work. And the token sits in plain text in the
repository's `.git/config`.

![Removing a saved token from a remote URL](../screenshots/remote-url-token.webp)

GitHuttBr reads every remote's fetch and push URLs and says so in three places:

| Where | What you see |
|-------|--------------|
| A failed fetch, pull or push | The error explains that the remote's URL holds a saved password, with **Remove it from the URL…** |
| The sidebar | A quiet key icon on the remote's row: its URL holds a password that takes priority over the profile's token. The same action is in its right-click menu |
| **Check sign-in…** | The remote shows the password as its source, with the same button |

The action asks first. It takes the password out of every URL of that remote —
the fetch URL and each push URL holding one — and writes nothing but
`.git/config`. What happens next depends on what else can sign in:

| After removal | What fetch and push use |
|---------------|-------------------------|
| The repository's profile has a token or linked account for that host | That token — the confirmation says nothing more |
| No profile token, but git's own helper has a login for the host | The helper's login |
| Neither | Nothing: fetch and push fail until you add a token. The confirmation says so first and offers **Add a token first**, which opens Settings → Connected accounts |

When it started from a failed operation, it offers **Try again**.

**There is no undo, on purpose.** Undoing would write the secret back into the
file in plain text, which is what the action exists to stop. If the old token
might still work, revoke it on the server: it has been readable by anything that
could read the repository folder.

**Limits.**

- The user name goes too (`https://git.example.test/…`), as when you run
  `git remote set-url` by hand; the confirmation says so. A server that needs it
  in the URL — a Bitbucket Data Center token with no user name in the profile —
  needs it added back with **Edit remote…**.
- A user name alone (`https://user@host/…`) is not flagged: git still asks the
  helper for that user's password, so nothing secret is stored.
- SSH URLs are left alone: `git@host:…` and `ssh://git@host/…` name the login
  ssh uses, not a credential.
- A remote helper's prefix (`persistent-https::https://…`, `gcrypt::…`) is kept;
  the URL after it is read and cleaned like any other.
- **Ambiguous URLs are not offered for removal.** When readers disagree on where
  the host starts — an `@` after a `?` or `#` in the address, or a password
  holding an unencoded `/` — cutting at the wrong `@` would point the remote at
  another server. Such a URL is only shown redacted, and the key icon opens
  **Edit remote…** so you fix it by hand.
- Only `.git/config` is read and changed. A URL rewritten by a
  `url.<base>.insteadOf` rule, or a remote defined in your global config, is not
  inspected — and renaming a remote never copies a password an `insteadOf` rule
  adds into the repository's config.
- The password never leaves the main process: remote URLs reach the window, the
  copy-URL menu and the edit dialog without it. Saving the edit dialog with the
  URL it showed changes nothing and keeps the password; **changing the host or
  the path drops it**, since the URL you typed is written as it is. Only this
  action removes a password while keeping the address.

## Limits worth knowing

- **This is git's store, not GitHuttBr's.** Changing it changes what your terminal
  does too — which is the point, and worth knowing before you change it.
- **System-level helpers are shown, not editable.** They live in a config only
  an administrator can write.
- **GitHuttBr cannot list what a helper holds.** No credential API exposes that
  without handing over the secrets, so the dialog reports configuration and
  erases on request, and nothing else.
- **A token you gave GitHuttBr is separate.** Revoking one does not touch the
  other; see [security](security.md) for the keychain side.
- **A profile's token stays out of the repository's hooks' environment.** A
  hook sees only a code for a private endpoint, valid while that git
  command runs — enough for a hook that deliberately asks, as git-lfs does. See
  [a profile's token while git runs](security.md#a-profiles-token-while-git-runs).

See also: [Security](security.md) · [SSH keys](ssh-keys.md) ·
[Syncing](syncing.md)
