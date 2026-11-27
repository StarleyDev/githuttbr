---
title: First run
category: Start here
order: 2
summary: The setup wizard on first launch — Git identity, hosting accounts, AI, appearance — and what each step saves.
keywords: onboarding first launch first run setup wizard welcome import settings git identity accounts ai subscription api key ollama lm studio claude code codex skip
---

# First run

The first time GitHuttBr opens, a short wizard asks for the few things that
change how it behaves from the first commit: who you are in Git, where your
repositories are hosted, whether to use AI, and how it should look. Every step
can be left empty, and everything it sets can be changed later in **Settings**.

![The AI step: a subscription CLI found on this computer and tested](../screenshots/onboarding-ai.webp)

## The welcome screen

Before the steps, the welcome screen offers to **import a settings file** from
another computer. A file that carries keys and tokens has them stripped unless
you tick the box to keep them, and a password-protected export asks for its
password right there. Importing applies the file and closes the wizard — see
[Security & secrets](security.md) for what an export holds.

## The steps

The left column lists the steps. A green check marks a step you filled in, a
dash one you passed without filling in, and the highlighted row is where you
are.

| Step | What it sets | Where to change it later |
|---|---|---|
| Git identity | The profile's name, and the name and email on your commits | Settings → Profile & identity |
| Accounts | Tokens for GitHub, GitLab, Azure DevOps, Bitbucket, Forgejo and self-hosted servers, and the app for **Open with…** | Settings → Connected accounts; the app in Settings → Git & sync |
| Artificial intelligence | One AI account, put in use | Settings → AI |
| Appearance | Theme and light, dark or automatic mode | Settings → Themes |
| Done | Nothing new — a summary of what was set up | — |

**Skip for now** closes the wizard on any step and keeps what you entered so far.

## The AI step

AI is optional. Pick one of three cards, or **Skip, no AI**, which turns AI off
until you set it up in [Settings → AI](ai.md):

| Card | What it uses | What it needs |
|---|---|---|
| My subscription | Claude Code or Codex, signed in with your plan | The CLI installed and signed in |
| API key | OpenAI, Anthropic, Gemini, Groq, OpenRouter or Mistral | A key from the provider |
| On my computer | Ollama or LM Studio, running locally — nothing leaves the machine | The server started |

When Claude Code or Codex is found on this computer, the subscription card says
which one and its version, and choosing the card tests it: one short prompt,
then **Tested: answered in N s. Ready to use.** If neither is found, or the CLI
is not signed in, the card shows the same connection setup as
[Settings → AI](ai.md#using-a-subscription-instead-of-an-api-key).

For an API key or a local server, **Continue** tests the connection by listing
the provider's models and only saves an account that answered.

What the step saves is an ordinary AI account, written the way Settings writes
one and put **In use**: open Settings → AI and it is there, ready to rename, use
for some features only, or delete. Several accounts, a model per feature and how
the AI writes are set there, not in the wizard.

## Limits

- **The subscription test costs a prompt.** It counts toward your plan's usage,
  like any request. It runs only when you choose the card or press **Test again**.
- **Only Claude Code and Codex are detected.** Gemini CLI and Devin answer as
  plain CLI accounts, which you add in Settings → AI.
- **A local server must already be running.** The wizard does not start Ollama
  or LM Studio, and does not download models.
- **The wizard runs once.** After it closes, everything it set lives in
  Settings; there is no way to open the wizard again.
