# shellcheck shell=bash disable=SC2154
# 72. branch-cleanup — "the PRs merged, the server deleted their branches, mine stayed"
#
# A local bare remote and a clone whose local branches are in every state the
# "Clean up local branches…" dialog tells apart, fetched with prune so the
# gone upstreams already read `[gone]`:
#   • pr/1412-login-timeout   gone + merged (merge commit)   pre-ticked
#   • pr/1420-retry-banner    gone + merged (merge commit)   pre-ticked
#   • pr/1398-dark-mode       gone, squash-merged            NOT ticked:
#                             its 2 commits exist only here (git cannot see a squash)
#   • wip/export-csv          gone, 2 commits only here (1 never pushed)  NOT ticked
#   • feature/local-merge     merged locally, main pushed     pre-ticked
#   • spike/graphql-idea      local only, last commit 2024    stale, 1 unique commit
#   • release/1.0             merged, but protected           never listed
#   • feature/active-work     pushed, not merged              never listed
#   • main                    current, default                never listed
#
# Verify:
#   • Tools → Clean up local branches… ⇒ three rows ticked (the two merged PRs
#     and feature/local-merge); pr/1398-dark-mode and wip/export-csv carry an
#     "N commits exist only here" chip and are unticked; "Delete 3 branches".
#   • Tick "Also list stale branches" ⇒ spike/graphql-idea appears, unticked.
#   • Delete ⇒ one confirm, then the branches are gone; Undo brings each back
#     at the same sha, and the PR ones track origin/<name> again (gone).
R="$ROOT/branch-cleanup"
REMOTE="$ROOT/branch-cleanup-origin.git"

rm -rf "$REMOTE"
git init -q --bare -b main "$REMOTE"

new_repo "$R"
mkdir -p "$R/src"
printf '# Ticket desk\n' > "$R/README.md"
printf 'export const version = 1\n' > "$R/src/index.ts"
git -C "$R" add -A && git -C "$R" commit -qm "init: ticket desk"
# Relative, so no absolute path of the machine that built it ends up on screen.
git -C "$R" remote add origin ../branch-cleanup-origin.git
git -C "$R" push -q -u origin main

c() { # c <branch> <file> <message>
  git -C "$R" checkout -q "$1"
  printf '%s\n' "$3" >> "$R/$2"
  git -C "$R" add -A && git -C "$R" commit -qm "$3"
}
pr() { # pr <branch> — a branch as "Go to source branch" leaves it: tracking origin/<branch>
  git -C "$R" checkout -q -b "$1" main
}

pr pr/1412-login-timeout
c pr/1412-login-timeout src/auth.ts "auth: extend the login timeout"
pr pr/1420-retry-banner
c pr/1420-retry-banner src/banner.ts "ui: show a retry banner"
c pr/1420-retry-banner src/banner.ts "ui: dismiss the banner on success"
pr pr/1398-dark-mode
c pr/1398-dark-mode src/theme.ts "theme: dark palette"
c pr/1398-dark-mode src/theme.ts "theme: follow the system setting"
pr wip/export-csv
c wip/export-csv src/export.ts "export: csv writer"
pr feature/active-work
c feature/active-work src/search.ts "search: fuzzy ticket titles"
git -C "$R" push -q -u origin pr/1412-login-timeout pr/1420-retry-banner pr/1398-dark-mode wip/export-csv \
  feature/active-work
# One more commit on the export branch that never left this machine.
c wip/export-csv src/export.ts "export: quote fields with commas"

# The server side: two PRs merged with a merge commit, one squash-merged, the
# branches deleted afterwards — what a hosting service does on merge.
git -C "$R" checkout -q main
git -C "$R" merge -q --no-ff -m "Merge pull request #1412 from pr/1412-login-timeout" pr/1412-login-timeout
git -C "$R" merge -q --no-ff -m "Merge pull request #1420 from pr/1420-retry-banner" pr/1420-retry-banner
git -C "$R" merge -q --squash pr/1398-dark-mode >/dev/null
git -C "$R" commit -qm "theme: dark mode (#1398)"

# A branch merged here, and a release branch protected by the repository.
git -C "$R" checkout -q -b feature/local-merge
c feature/local-merge src/index.ts "chore: tidy the entry point"
git -C "$R" checkout -q main
git -C "$R" merge -q --no-ff -m "Merge branch 'feature/local-merge'" feature/local-merge
git -C "$R" branch release/1.0 main~1
git -C "$R" config githuttbr.protectedbranches 'main,master,release/*'
git -C "$R" push -q origin main release/1.0
git -C "$R" push -q origin --delete pr/1412-login-timeout pr/1420-retry-banner pr/1398-dark-mode wip/export-csv

# An old experiment nobody touched since 2024.
git -C "$R" checkout -q -b spike/graphql-idea main~3
printf 'type Ticket { id: ID! }\n' > "$R/src/schema.graphql"
git -C "$R" add -A
GIT_AUTHOR_DATE='2024-03-04T10:00:00Z' GIT_COMMITTER_DATE='2024-03-04T10:00:00Z' \
  git -C "$R" commit -qm "spike: graphql schema"

git -C "$R" checkout -q main
git -C "$R" fetch -q --prune origin

summary "branch-cleanup" "local branches gone / merged / squash-merged / unpushed / stale / protected against a local bare remote — for Clean up local branches…"
