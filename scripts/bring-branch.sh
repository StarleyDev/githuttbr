#!/usr/bin/env bash
# Bring a feature branch into GitHuttBr's main — only the commits whose change
# main does not already have.
#
#   scripts/bring-branch.sh <branch> [<branch>…]
#
# Branches for upstream PRs are cut from upstream's main and stacked on each
# other, so a branch carries copies of commits main already holds under another
# hash (a PR branch rebuilt, a stack's lower PRs). `git merge` would bring those
# copies too, and the next CHANGELOG would list the same feature twice.
# `git cherry` compares commits by patch-id — the change itself, not the hash —
# so only the genuinely new ones are cherry-picked, oldest first.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

if [ "$(git rev-parse --abbrev-ref HEAD)" != main ]; then
  echo "Switch to main first (git checkout main)." >&2
  exit 1
fi
[ $# -gt 0 ] || { echo "usage: scripts/bring-branch.sh <branch> [<branch>…]" >&2; exit 2; }

# Subjects already on main: a PR branch rebuilt through a conflict has a
# different patch-id, but keeps its message. Shown when skipped, never silent.
mapfile -t main_subjects < <(git log main --format=%s)
on_main() { local s="$1"; for m in "${main_subjects[@]}"; do [ "$m" = "$s" ] && return 0; done; return 1; }

for branch in "$@"; do
  # '+' = no equivalent change on main yet; '-' = main already has it.
  mapfile -t candidates < <(git cherry main "$branch" | sed -n 's/^+ //p')
  same_patch=$(git cherry main "$branch" | grep -c '^-' || true)
  new=()
  for sha in "${candidates[@]}"; do
    subject="$(git log -1 --format=%s "$sha")"
    if on_main "$subject"; then
      echo "  skip $(git log -1 --format=%h "$sha") — main already has \"$subject\" (rebuilt copy)"
    else
      new+=("$sha")
    fi
  done
  if [ ${#new[@]} -eq 0 ]; then
    echo "$branch: nothing new ($same_patch with the same patch already on main)"
    continue
  fi
  echo "$branch: ${#new[@]} new"
  for sha in "${new[@]}"; do
    echo "  pick $(git log -1 --format='%h %s' "$sha")"
  done
  git cherry-pick "${new[@]}"
  mapfile -t main_subjects < <(git log main --format=%s)
done
