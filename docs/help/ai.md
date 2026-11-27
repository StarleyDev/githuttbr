---
title: AI features
category: AI
order: 80
summary: Optional, provider-agnostic, and grounded in your actual code.
keywords: ai draft unsaved changes test and save status ready no key not checked not responding openai anthropic gemini google ollama local llm accounts api key subscription cli claude codex devin commit message explain review wiki grounded model picker slow timeout taking longer keep waiting cancel not responding ollama closed switch account fallback writing preferences commit style extra rules for commits custom instructions preview co-author hover explain own ai general ai bar in use popover profile follows
---

# AI features

Every AI feature is **optional** and off until you configure an account.
Nothing is sent anywhere until you ask for something specific.

![AI settings](../screenshots/settings-ai.webp)

## One AI for every profile

The AI is set up once, in **Settings → AI**, and every [profile](profiles.md)
uses it: a profile you create later already has the AI, with no account to add
again. The page lists each profile and whether it follows this **general AI**.

A profile can use **its own AI** instead — a work profile that must go through
the company's account, for cost or data policy, or that writes its commits
another way. On that profile's **Profile** page, under *AI of this profile*,
switch **General** to **Own**: it starts as a copy of the whole general AI —
accounts, keys and preferences — and from then on all of it is its alone.
Switching back to **General** removes it, after a confirmation, and leaves the
general AI as it was.

A profile uses one AI **whole**: the general one, or its own, never a mix. The
accounts and models *and* how the AI writes and what the chat may do come from
the same place, so changing the commit style on the general AI changes it for
every profile that follows it.

Every AI is set up on this one page. The **Editing** bar at the top picks whose:
the general AI, or a profile's own (*Own AI of Work*). **Set up its own AI** on
the Profile & identity page, or **Edit its own AI** in the list of profiles, opens the page
on that one. The Profile & identity page itself only shows which AI the profile uses and
what answers — it never hosts the editor, and holds no AI option of its own.

![A profile's AI on its Profile & identity page: General or Own, what answers, and the way to set it up](../screenshots/settings-profile-ai.webp)

Below the accounts, the same page holds how that AI **writes** and what it may
do, in sections:

| Section | Holds |
|---|---|
| **Commit messages** | The commit style — Conventional, Gitmoji and Ticket as cards with a sample line, the rest under *More styles* — *Generate commit description*, the co-author line, **Extra rules for commits**, and a preview |
| **Explain & hover** | The explanation style, one button per tone, and *Explain on hover while holding* a key you pick |
| **Conflicts & branches** | Conflict resolution style and branch naming style, each with an example of the result |
| **Repository chat** | Whether chat is on, what it may do, how its proposals run, what it reads — see [Repository chat](repo-chat.md#settings) |

A line above the sections says whose AI you are editing and who it reaches:
*General AI · applies to Work and Personal*, or one profile's own.

**Extra rules for commits** — *Custom instructions* until 4.60 — are added to
commit message generation only. Chat, explanations, reviews and branch names do
not read them, so a rule like "write in Spanish" there changes commits and
nothing else. The setting search still finds it by its old name.

**The preview is a fixed sample**, not a model call: it shows the shape of the
chosen style, with a body when *Generate commit description* is on and the
co-author line when that is on. What the AI writes for your change depends on
the diff and on your extra rules, which the preview does not apply.

![Commit messages: style cards, extra rules and the preview](../screenshots/settings-ai-commits.webp)

The composer's style switch and the chat's model and approval pickers write to
the same AI the profile reads: the general one, or the profile's own.

Upgrading from a version where each profile had its own AI loses nothing: the
AI of the profile in use becomes the general AI, and any other profile whose AI
was different keeps it as its own.

**Upgrading from 4.59 or earlier**, where the writing preferences lived on each
profile: once, the preferences of the profile in use (or, if that one has its
own AI, of the first profile on the general AI) move onto the general AI.
Profiles with their own AI keep theirs. **The limit:** if two profiles on the
general AI wrote differently — a `ticket` work profile and a `conventional`
personal one — both now write like the one that was moved. To keep the
difference, give one of them its own AI and set its style again there.

## Providers

An **account** is one way of reaching a model: a provider, where to reach it,
and how it authenticates. You can configure several and they coexist — a work
key, a personal key, a local model, a CLI you are already signed into.

Presets cover **OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, Mistral**
and **Ollama** (entirely local), plus any OpenAI-compatible endpoint.

**A key never travels unencrypted off this machine.** An account with a key
reaches its endpoint over `https://`, or over plain `http://` only on this
computer (`localhost`, `127.x`, `::1`). A call that would send the key over
`http://` to another host is refused before anything leaves, and says so. An
endpoint without a key — Ollama on another machine of your network — keeps
working over `http://`.

Anthropic uses its own `/v1/messages` API rather than an OpenAI-shaped call, so
Claude models work directly instead of only appearing to. Gemini is reached
through Google's OpenAI-compatible endpoint.

### Adding and editing a provider

A provider that was saved half-filled used to be a quiet trap: an empty key
could end up in use, and nothing answered. So nothing on this card is
saved as you type.

**Add provider** opens a card marked **Draft · not saved**, with a dashed edge.
Fill in the provider, key, endpoint and model, then choose **Test and save**.
GitHuttBr first lists the provider's models with that key — the same request
**Fetch models** makes — and only saves when it answers. You see
**Connected · N models**, and the provider joins the list as **Ready**.

When the test fails, the card says **Could not connect** with the provider's
reason (a refused key, `401`; a server that is not running) and **Nothing was
saved.** Fix the field and test again, choose **Save anyway** to keep it as it
is — it then shows as **Not responding** — or **Cancel**, which leaves no trace.

Editing a saved provider works the same way. A banner says **Unsaved changes —
nothing changes until you save**, and each field you touched is marked
**· changed**. **Discard** puts the saved values back; **Test and save** tests
and saves. Picking another provider, adding one or opening **Use my
subscription** with changes pending asks **Save changes to …?** — **Save**,
**Discard** or **Keep editing**. Closing Settings keeps the draft in memory, so
it is still there when you come back; it is never written to disk.

Keys are saved exactly as before, to your keychain, and only at save time. A
provider's error is shown with the key and anything shaped like a token
masked.

![Adding and editing a provider](../screenshots/ai-provider-draft.webp)

| Provider type | What **Test and save** checks |
| --- | --- |
| API key or local server (Ollama, custom endpoint) | Lists the models; success means the endpoint answered with this key |
| Subscription (Codex, Claude Code) | Sends the short test prompt described below, from your plan allowance |
| Local CLI | Looks for the command on your `PATH`; a typed path is saved without a check |

### Status badges

Every provider in the list carries one badge, worked out from what the page
already knows — the last test, or the model list it fetched anyway. Nothing is
polled in the background.

| Badge | Meaning |
| --- | --- |
| **Ready** | The last test or model listing succeeded |
| **Not responding** | The last attempt failed; the reason is on the line below, with **Test again** |
| **No key** | The provider needs an API key and has none |
| **Not checked** | Nothing has asked it yet — a subscription until it is tested, or a list not fetched |

**The limit:** a badge is only as fresh as its last check. A provider that
stopped answering an hour ago still reads **Ready** until something asks it
again — choose **Test connection** on its card to be sure. A **Local CLI**
with a typed path stays **Not checked**, since proving it works would cost a
prompt.

### The provider in use

One provider answers every task that has no provider of its own under
**Model per task**. Its row is marked **In use** — a filled pill and an accent
edge — and stays where it is in the list. The general AI and a profile with its
own AI each have their own provider in use; the list changes the one you are
editing.

Every other saved provider has a **Use** button at the right of its row, next
to its badge. One click puts it in use and saves at once: which provider
answers is a choice, not an edit, so it never waits for **Test and save**. It
does not open that provider's card, and a card with unsaved changes keeps them.

**The limit:** **Use** tests nothing. A provider marked **No key** or **Not
responding** can be put in use — on purpose, before fixing its key — and its
badge keeps saying so; the next AI task fails with that provider's reason. A
draft has no **Use**: it is not a provider until it is saved.

### The AI in use, from the status bar

A profile with its own AI ignores the general AI's provider in use: putting
another provider in use on the general AI changes nothing for that profile, and
outside Settings nothing said so. The status bar at the bottom of a repository
now does. Its **AI:** _provider_ button names the provider that answers for
the profile in use, with a dot for its status — green **Ready**, red **Not
responding**, amber **No key**, grey **Not checked**.

Clicking it opens a small panel:

| Part | What it shows |
| --- | --- |
| Header | The profile in use, and whether it **follows the general AI** or **has its own AI** |
| One row per provider | Every saved provider of that AI, with its model and status; a provider that is not responding shows why on a second line |
| **In use** / **Use** | The provider answering now, and a one-click switch on every other one |
| **Configure AI** | Opens **Settings → AI** |
| **Usage and cost** | Opens the *Analytics* tab of the repository settings |

**Use** writes where the profile reads its AI. On a profile that follows the
general AI it changes the general AI — and so every profile that follows it; on
a profile with its own AI it changes that one only. Tasks that have a provider of
their own keep it. **Esc** closes the panel, and the
button is hidden while AI is turned off.

![The AI in use from the status bar: the profile, its AI, and every provider with its status](../screenshots/statusbar-ai.webp)

**The limits:** the dot is worked out from the model list the app fetched
anyway (kept for up to a day) and never tests anything, so a provider that
stopped answering can still read **Ready** — testing the connection in Settings
is the way to be sure. Until Settings has been opened, the window does not hold
the keys themselves, so a provider with no key can read **Not checked** or **Not
responding** there instead of **No key**. Like **Use** in Settings, the switch
does not test the provider it puts in use.

### Using a subscription instead of an API key

In onboarding’s AI step or **Settings → AI**, choose **Use my subscription**.
Select the plan you use, then open **Documentation** for the provider's installation instructions.
Once installed, choose **Connect ChatGPT (Codex)** or **Connect Claude (Claude Code)**.
The provider's CLI opens its sign-in page in your browser and stores its own session.
An existing subscription session is reused. **Cancel** stops a pending connection.
A sign-in that takes more than three minutes stops and can be retried.

| Plan | Required CLI | Sign in from a terminal |
| --- | --- | --- |
| ChatGPT with Codex access | Codex CLI | `codex login` and choose ChatGPT |
| Claude with Claude Code access | Claude Code | `claude auth login` and choose your subscription account |

Connecting also tests the session. If you signed in from a terminal, choose **Test connection**. GitHuttBr checks the CLI’s sign-in method and sends a short test
prompt from an empty temporary directory. The request counts toward your provider’s allowance.
After **Connected**, choose **Add account**. The first account of the general AI is put **In use**.
For an existing setup, choose **Use** on its row or assign individual features below.
To skip setup, continue onboarding and return to Settings when ready.

If GitHuttBr cannot find the CLI, install it or enter its full executable path and test again.
If sign-in has expired or the CLI is using an API key, sign in with the subscription account.
If you reach a usage limit, wait for the provider’s quota to reset.

![Connecting a subscription from AI settings](../screenshots/ai-subscription.webp)

For manual setup, pick the **Local CLI** provider to answer with an agent CLI already installed
and signed in on this machine — `claude`, `gemini`, `codex` or `devin`. GitHuttBr runs the
binary with your prompt and reads its reply; there is no API key to paste and no
token is stored.

GitHuttBr only ever runs a command you configured as an account, always with an
argument list rather than a shell, so nothing in a diff or a branch name can be
interpreted as a command.

Each call starts the CLI with the repository as its working directory, so
agent CLIs like Devin can open the files you are asking about instead of
answering blind. Features that have no repository (theme generation) run it from the app's own directory.

> **This is not more private than an API key.** Your prompts still reach the
> same vendor, under your own account, exactly as they would with a key. What
> changes is billing and setup, not where the text goes.

If the command is not on your `PATH`, type its full path on the account.

### Model per task

Under **Model per task**, each feature — commit messages, chat,
explain, PR review, conflict resolution, wiki, themes — can point at its own
account and model. Leave a row on **Provider in use** to follow the provider
marked **In use**.
Cheap model for commit messages, strong one for chat, is the common setup.

### Upgrade notice

Upgrading from a version before accounts shows this once. The provider and key you had become the first account; nothing is reconfigured by hand.

![Upgrade notice](../screenshots/ai-accounts-notice.webp)

## Models

Model lists come from the provider itself and are cached for a day; **Fetch
models** refreshes one immediately. Under the list GitHuttBr says where it came
from — live, cached (with when), or the built-in fallback and why.

The list is filtered to models that can answer a chat request, so embeddings,
speech and image models stay out of it. Every model box also accepts free text,
so a preview model, a private deployment or a freshly pulled Ollama tag is
always usable even when the provider does not list it.

A provider you have not given a key to yet, or one that is unreachable, falls
back to a small built-in list rather than an empty dropdown.

No provider publishes a ranked or curated list, so the shaping is GitHuttBr's: dated snapshots collapse into the model they are a snapshot of (`gpt-4o` covers `gpt-4o-2024-08-06`), and what remains is ordered newest first rather than alphabetically. **Show all models** at the bottom of the list brings back everything the provider returned.

## What it can do

| Feature | What you get |
|---|---|
| **Commit message** | Summary (and optional body) from your staged diff, in your chosen style |
| **Explain this file** | Plain-language explanation in a side panel — Normal, Concise, ELI5… even Pirate |
| **Hover to explain** | Hold <kbd>⇧</kbd> and point at an identifier for a one-line explanation, plus the lines it drew on |
| **AI edit selection** | Select lines in a file, describe the change, and the model rewrites just those lines into the editor draft |
| **Conflict resolution** | Proposes a merge into the editable output — never auto-applies |
| **PR review** | Summarises a diff and flags risks, each anchored to a real `path:line` |
| **PR description** · **branch names** | Drafted from the branch's commits and diff |
| **Themes** · **graph palettes** | Generated from a prompt |
| **Smart staging** | Suggestions for what belongs in this commit |
| **[Repository chat](repo-chat.md)** | Grounded questions plus reviewed file changes followed by validated Git actions |
| **AI config wizard** | Generates assistant configuration files (instructions, agents, hooks) for the repository — the wand button in the chat panel header |

### Edit just the lines you select

In the file view, drag across the lines you want changed and press **AI edit…**
(or right-click a line and pick it from the menu). A bar at the bottom shows the
selected range and takes your instruction — "rename this variable", "add null
checks", "translate these strings". The model sees the selected lines plus a
little surrounding context and returns only the replacement for that range,
which lands in the **editor draft** rather than on disk. You review it there and
save or discard through the normal editing flow, so nothing is written until you
say so. It works on every configured backend, not just agent CLIs, because the
answer is text, not a tool call. The limits: it rewrites one contiguous range at
a time, it cannot create or delete whole files, and a selection that crosses
diff hunks is refused — select inside the file view instead.

## Grounded, not guessing

The review sees the diff as **labelled hunks** and may only cite those labels;
GitHuttBr then resolves each label to a real file and line. A model that invents a
location is **rejected and asked again**, so findings always point at code that
exists.

Hover-to-explain reads only a numbered window around the token — in a diff, only
the hunks visible on screen — so when a definition lives elsewhere it says so
instead of inventing it. Answers are cached per file version.

[Repository chat](repo-chat.md) works the same way: it may cite only the
excerpts it was handed, and the two-pass request picks those from Git's own
tracked-file list rather than from anything the model writes. When it proposes
a change, GitHuttBr validates exact file actions, computes their diffs locally,
then runs any following Git actions under the configured approval policy.

**Masked secret files are never sent.** Neither are files the secret-masking
rules cover — including a file you pin to chat by hand, which is refused with a
reason rather than read.

## When a model is slow, or stops answering

A local model on a laptop can take a minute for a commit message, and a model
that "thinks" before it answers takes longer still — but a server that was
closed mid-request should not leave you staring at a spinner.

| What happens | What you see |
|--------------|--------------|
| No answer after 30 seconds | *"{account} is taking longer than expected"*, with **Keep waiting**, **Use {another account}** and **Cancel**. Keep waiting asks again a minute later if it is still running |
| A local server (Ollama, LM Studio, llama.cpp…) is closed while it works | Within a few seconds: *"{account} is not responding"*, with a button for each other account that is ready to use, and **Cancel** |
| The server was already closed when you asked | The same, straight away |

**Use {another account}** cancels the request and sends the same one to that
account, with its default model — the commit message, the review or the chat
answer arrives as if you had asked it there. It does not change your settings:
the next request goes to the account you chose for that task again.

This covers every AI feature — commit messages, chat, review, explain,
conflicts, themes, the wiki — because they all go through the same call.

## Limits

- **Only local servers are watched for being closed.** A cloud provider that
  goes down fails with its own error; a cloud call that is merely slow gets the
  *taking longer* prompt like any other. A local server that is busy rather
  than closed counts as alive: only a refused or dropped connection ends the
  call early.

- The bundled fallback model lists go stale between releases. That is what the
  live fetch is for; the fallback only covers the case where fetching cannot
  happen.
- Filtering a provider's list to chat-capable models is done by name, so an
  unusually named chat model can be filtered out. Type it in instead.
- A CLI account cannot report token usage unless the CLI does, so the usage and
  cost figures under Settings will under-count those calls.
- CLI replies are slower than a direct API call: the binary starts a whole
  session per request.
- Keys are stored per account in your OS keychain. Deleting an account deletes
  its key — it asks first, and there is no undo.
- Going back to a version from before the general AI loses the general AI's keys:
  that version does not know where they are kept and drops them when it saves.
  The accounts stay; type the keys again. A profile's own AI is not affected.

**See also:** [Repository chat](repo-chat.md) · [Repo wiki](repo-wiki.md) ·
[Security & secrets](security.md)
