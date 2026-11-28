---
title: CI runs
category: Sync & many repos
order: 59
summary: Follow GitHub Actions, GitLab pipelines, Azure Pipelines and Forgejo Actions from the app — each job, its steps and its log, with re-run and cancel.
keywords: ci runs actions workflow pipeline build github actions gitlab pipelines azure pipelines forgejo actions jobs steps logs rerun re-run cancel dispatch workflow_dispatch badge status graph
---

# CI runs

You pushed, and now you wait: switch to the browser, find the repository, open
Actions, find your run, open the job that went red, scroll to the end of the
log. **CI runs** puts that loop next to the code. One page tells you how each
workflow has been doing lately, lists the remote's runs newest first, and opens
a failed run straight on the test that broke — with the file and line, one
click from your editor. The buttons to run it again or stop it are on the card.

It talks to the host's own API with the token you already gave GitHuttBr. Nothing
runs on your machine — for that, see [Local CI](local-ci.md).

![The CI runs page: a card per workflow with its last runs, the Failed and Running filters, a running run's progress, and a failed run opened on the test that broke and its jobs](../screenshots/ci-runs.webp)

## Opening it

**Tools → CI runs…**, or *CI runs* in the command palette (⌘K). The page rides
on the repository's tab, like the wiki and insights, and reads the remote
called `origin` — or the first remote, when there is no `origin`.

## What the page shows

| Part | What it is |
|---|---|
| **Workflow cards** | One card per workflow: what triggers it, its pass rate over its last 10 finished runs (green from 90 %, amber from 70 %, red below), those runs as coloured squares — oldest on the left, so the newest sits next to "now" — its average time, and either its slowest job or how its last run went. Click a card to list only that workflow's runs; click it again to show them all |
| **All branches / current branch** | Every run on the remote, or only the branch you have checked out |
| **Failed / Running** | Quick filters with the number of runs each would leave. They count what the other filters leave, so the number is what a click shows |
| **Filter** | Narrows the loaded runs by title, workflow, branch, author, commit or event |
| **A run card** | The commit's title (or the workflow's name), then the branch, the workflow and run number, what started it (push, pull request, schedule, manual…), who started it and the commit — click the commit to copy it. When the run belongs to a pull request, **PR #n** opens that pull request's page. On the right: where it stands, how long it took and how long ago |
| **A running run** | *Running · step 3 of 5*, a progress bar and the time so far. The step is the running job's; on a host without steps (GitLab, Forgejo) it counts jobs instead |
| **The failed test** | A failed run opens on its own, newest first, with the test its log names: the job, the test, the first line of the error and **path:line** — click it, or *Open in editor*, to land on that line. The same reading as a pull request's [Checks tab](hosting.md#the-checks-tab) |
| **Jobs** | Under it, each job with its state and duration, grouped by stage where the host has stages (GitLab, Azure). *View steps and log* opens a job's steps and the end of its log — on a failed job it is always there, on the others it appears when you point at the job |
| **Steps** | Each step of a job, with its state and duration — GitHub, Azure and Forgejo report them; GitLab has no steps |
| **Log** | The end of a finished job's log, colours kept. Only the last 512 KB are fetched — where a failure is — and the page says when the start was left out |

While anything on the page is queued or running, the list asks the host again
every 15 seconds, and the jobs of the open run and of every running run with
it — that is where the step count comes from; durations tick every second.
When two minutes of answers bring nothing new — a run waiting for a deployment
approval, say — it slows to once a minute, and speeds up again as soon as
something moves. A list where everything has finished asks nothing until you
press refresh, and nothing is asked while the window is hidden.

A run the host sends without a title — every GitLab pipeline, a scheduled Azure
build — is named after its commit's subject when the commit is in the graph,
read from your local repository at no cost; otherwise after its number.

## Re-running, cancelling, starting

| Button | Shows when | What happens |
|---|---|---|
| **Re-run failed** | The run failed or was cancelled | Only the jobs that did not pass run again |
| **Re-run** (↻) | The run finished, on GitHub — on the card when you point at it | Every job runs again |
| **Open in browser** | Pointing at a card | The run on the host's site |
| **Cancel** | The run is queued or running | Asks first: the jobs in progress are interrupted and their work is lost |
| **Run workflow** | The host can start one by hand | Pick the workflow and a branch; it starts as if that branch had been pushed, and shows up in the list a few seconds later |

What each host allows:

| Host | List & jobs | Steps | Log | Re-run all | Re-run failed | Cancel | Start by hand |
|---|---|---|---|---|---|---|---|
| **GitHub** (and Enterprise Server) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ — the workflow needs a `workflow_dispatch` trigger |
| **GitLab** (and self-managed) | ✓ — pipelines, jobs by stage | — | ✓ | — | ✓ (*Retry*) | ✓ | ✓ — runs `.gitlab-ci.yml` on the branch |
| **Azure DevOps** | ✓ — builds, jobs by stage | ✓ (tasks) | ✓ | — | ✓ | ✓ | ✓ — any build definition of the repository |
| **Forgejo / Gitea** | ✓ on servers with the Actions runs API | ✓ | ✓ when the server serves it to a token | — | — | — | — |
| **Bitbucket** | — | | | | | | |

## Badges in the graph

The same CI shows up as a small badge beside each commit in the graph: green,
red or a clock while it runs. Hover it for the jobs; click it for the host's
page. The badges come from:

| Host | Source |
|---|---|
| GitHub | The commit's check runs — any CI that reports to GitHub, not only Actions |
| GitLab | The commit's statuses, which include every pipeline job. A manual job (a deploy, say) does not leave the badge stuck on the clock |
| Azure DevOps | The repository's 100 most recent builds, matched by commit |
| Forgejo / Gitea | The commit's combined status — Forgejo Actions and any external CI |
| Bitbucket Data Center | The commit's build statuses |

Every answer is remembered — including "no CI here" — and a commit is asked
about again only when its answer may have changed: every 45 seconds while it
runs, every 10 minutes once it finished, and less and less often for a commit
that never had CI. That keeps a busy graph inside the host's hourly allowance.

## Limits

- **The cards only know the runs the page listed.** That is the last 50 runs
  of the branch filter in force — a workflow that ran rarely may show fewer
  than ten squares, and switching to the current branch recomputes every card.
  The slowest job appears once the page has read some finished run's jobs (the
  failed run it opens is enough); until then the card says how the last run went.
- **The failed test is read from the log's text.** Vitest, Jest and pytest are
  recognised; any other runner, a build error or a log cut short shows the job
  list alone. A path the runner wrote outside the checkout cannot be opened.
- **PR #n depends on what the host says.** GitHub lists the pull request only
  for runs from the same repository, not from a fork; GitLab says it for merge
  request pipelines and Azure for PR builds. Forgejo runs carry no link.
- **The log is the end, and only once a job finishes.** GitHub and Forgejo
  hand out a job's log after it is done; while it runs, the page shows its
  steps moving, not its output. GitLab and Azure serve a running job's log so
  far — reopen it to read more.
- **The token needs CI access.** A GitHub fine-grained token needs *Actions:
  read* to list and *Actions: write* to re-run, cancel or start; a classic one
  needs `repo`. A GitLab token needs `read_api` to list and `api` for the
  buttons. An Azure token needs *Build: read* (and *Build: read & execute* for
  the buttons); without it the page and the badges stay empty rather than
  failing.
- **Azure badges only reach back 100 builds.** An older commit has no badge,
  though the CI runs page still lists its build.
- **Azure's re-run is "retry failed".** It works on YAML pipelines with stages;
  a classic pipeline may refuse it, and the page shows the host's answer.
- **Starting a workflow does not ask for its inputs.** A GitHub workflow or a
  GitLab pipeline with required inputs without a default is refused by the host,
  with its own message.
- **Forgejo is read-only, and only on recent servers.** Older Forgejo and Gitea
  servers have no API to list runs; the page says the host is not supported,
  and the graph badges still work through commit statuses. A repository the
  token cannot see shows as an access error, not as "not supported".
- **Bitbucket has no runs page.** On Data Center, CI is an outside system
  (Jenkins, Bamboo…) that only reports a status — that status is the graph
  badge. bitbucket.org Pipelines is not supported.
- **One remote.** The page reads `origin`; runs on a fork's other remote are
  not listed.

**See also:** [Local CI](local-ci.md) · [Hosting & pull requests](hosting.md)
