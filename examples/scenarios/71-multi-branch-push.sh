# shellcheck shell=bash disable=SC2154
# 71. multi-branch-push — "several agents, one branch each, publish them all"
#
# A local bare remote and a clone with local branches in every state the
# "Push branches…" dialog distinguishes, already fetched so the
# remote-tracking refs are current:
#   • agent/auth-refresh   ahead ↑3      (pre-ticked)
#   • agent/docs-sweep     ahead ↑1      (pre-ticked)
#   • agent/flaky-tests    new           (never pushed — pre-ticked)
#   • agent/perf-cache     new           (pre-ticked)
#   • agent/i18n-pass      up to date    (unticked)
#   • main                 up to date    (current; protected by default)
#   • agent/billing-fix    diverged      (a teammate pushed too — disabled)
#   • release/2.4          behind ↓2     (disabled)
#   • feature/old-name     tracks origin/feature/new-name (another name): new
#                          under its own name, NOT pre-ticked, with a "tracks
#                          origin/feature/new-name — pushes to
#                          origin/feature/old-name" warning and a per-row
#                          "push to feature/new-name instead" (↑1 there)
#
# Verify:
#   • Push ▾ → Push branches… ⇒ the four agent branches with work are ticked,
#     "4 selected"; billing-fix and release/2.4 are greyed out with a tooltip
#     saying why; feature/old-name is unticked and shows the tracks warning.
#   • Push 4 branches ⇒ every one reports pushed or created; the new ones now
#     track origin/<name>.
#   • On feature/old-name, "push to feature/new-name instead", then Push ⇒ a
#     confirmation listing "feature/old-name → origin/feature/new-name"; only
#     after it does feature/new-name move.
#   • Tick "All or nothing" and include a branch made diverged again ⇒ nothing
#     moves on the remote.
R="$ROOT/multi-branch-push"
REMOTE="$ROOT/multi-branch-push-origin.git"
MATE="$ROOT/multi-branch-push-teammate"

rm -rf "$REMOTE" "$MATE"
git init -q --bare -b main "$REMOTE"

new_repo "$R"
mkdir -p "$R/src"
printf '# Billing service\n' > "$R/README.md"
printf 'export const version = 1\n' > "$R/src/index.ts"
git -C "$R" add -A && git -C "$R" commit -qm "init: billing service"
# Relative, so no absolute path of the machine that built it ends up on screen.
git -C "$R" remote add origin ../multi-branch-push-origin.git

for b in agent/auth-refresh agent/docs-sweep agent/i18n-pass agent/billing-fix release/2.4 feature/old-name; do
  git -C "$R" branch "$b"
done
git -C "$R" push -q -u origin main agent/auth-refresh agent/docs-sweep agent/i18n-pass agent/billing-fix release/2.4
git -C "$R" push -q origin feature/old-name:refs/heads/feature/new-name
git -C "$R" branch -q --set-upstream-to=origin/feature/new-name feature/old-name

# A teammate moves billing-fix and release/2.4 on the remote.
git clone -q "$REMOTE" "$MATE"
git -C "$MATE" config user.email "teammate@example.com"
git -C "$MATE" config user.name "Teammate"
git -C "$MATE" checkout -q agent/billing-fix
printf 'export const retry = 3\n' > "$MATE/src/retry.ts"
git -C "$MATE" add -A && git -C "$MATE" commit -qm "billing: retry failed charges"
git -C "$MATE" push -q origin agent/billing-fix
git -C "$MATE" checkout -q release/2.4
git -C "$MATE" commit -q --allow-empty -m "release: bump to 2.4.1"
git -C "$MATE" commit -q --allow-empty -m "release: changelog"
git -C "$MATE" push -q origin release/2.4

c() { # c <branch> <file> <message>
  git -C "$R" checkout -q "$1"
  printf '%s\n' "$3" >> "$R/$2"
  git -C "$R" add -A && git -C "$R" commit -qm "$3"
}
c agent/auth-refresh src/auth.ts "auth: refresh tokens before expiry"
c agent/auth-refresh src/auth.ts "auth: retry once on 401"
c agent/auth-refresh src/auth.ts "auth: tests for refresh"
c agent/docs-sweep README.md "docs: document the retry policy"
c agent/billing-fix src/charge.ts "billing: round half to even"
c feature/old-name src/feature.ts "feature: first cut"
git -C "$R" checkout -q -b agent/flaky-tests main
c agent/flaky-tests src/queue.test.ts "test: stop sleeping in queue tests"
git -C "$R" checkout -q -b agent/perf-cache main
c agent/perf-cache src/cache.ts "perf: cache plan lookups"
c agent/perf-cache src/cache.ts "perf: evict on plan change"

git -C "$R" checkout -q main
git -C "$R" fetch -q origin
rm -rf "$MATE"

summary "multi-branch-push" "local branches ahead / new / up to date / behind / diverged / renamed upstream against a local bare remote — for Push branches…"
