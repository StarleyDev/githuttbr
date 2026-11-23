#!/usr/bin/env bash
# Bring upstream Gitcito into GitHuttBr's main, then check it.
#
#   scripts/sync-upstream.sh          merge and run the gate
#   scripts/sync-upstream.sh --push   …and push main when the gate is green
#
# Conflicts are expected only where this build differs on purpose: the brand
# (src/shared/brand.ts, src/shared/appRepo.ts, package.json name/author/publish),
# the README's top, LICENSE, and version/CHANGELOG. Keep this repository's side
# for those. test/appRepo.test.ts fails if the updater would point upstream.
set -euo pipefail

UPSTREAM_URL=https://github.com/MyAppDesk/gitcito.git
cd "$(git rev-parse --show-toplevel)"

if [ "$(git rev-parse --abbrev-ref HEAD)" != main ]; then
  echo "Switch to main first (git checkout main)." >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "The working tree has changes; commit or stash them first." >&2
  exit 1
fi

git remote get-url myappdesk >/dev/null 2>&1 || git remote add myappdesk "$UPSTREAM_URL"
# No tags: upstream's ~150 release tags would ride along on the next push and
# GitHub fires no tag event when more than three arrive together.
git fetch myappdesk main --no-tags
git pull --ff-only origin main

behind=$(git rev-list --count HEAD..myappdesk/main)
if [ "$behind" = 0 ]; then
  echo "Already up to date with upstream."
  exit 0
fi
echo "Merging ${behind} upstream commit(s)…"

if ! git merge --no-edit myappdesk/main; then
  echo
  echo "Conflicts in:"
  git diff --name-only --diff-filter=U | sed 's/^/  /'
  echo
  echo "For brand files (brand.ts, appRepo.ts, package.json name/author/publish, README top, LICENSE)"
  echo "and version/CHANGELOG, keep this repository's side:  git checkout --ours <file>"
  echo "Resolve the rest, then: git add -A && git commit --no-edit && scripts/sync-upstream.sh"
  exit 1
fi

npm ci
npm run typecheck
npm run lint:i18n
npm run lint:docs
npm test
npm run build
echo "Upstream merged and the gate is green."

if [ "${1:-}" = --push ]; then
  git push origin main
  echo "Pushed. Cut a release with: npx release-it patch --ci"
else
  echo "Review, then: git push origin main && npx release-it patch --ci"
fi
