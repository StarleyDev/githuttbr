# shellcheck shell=bash disable=SC2154
# 73. object-model — one repository with every kind of tree entry, for the Object explorer.
#
# The explorer's tree view names what each mode means, so this repo holds one
# of each under src/:
#   • components/, plugins/   subtrees (040000) — "4 items", "2 items"
#   • app.ts, index.ts        regular files (100644)
#   • build.sh                executable (100755)
#   • config.json             symlink (120000) → ../config.json
#   • ui-kit                  submodule gitlink (160000), declared, never cloned
# History: v1.0.0 (annotated) → v1.1.0 (lightweight) → "chore: release v2.0.0"
# (annotated v2.0.0) → main's "feat: plugin system"; hotfix/security-patch
# branches off v1.1.0.
#
# Verify:
#   • ⌘K → Object explorer ⇒ main's commit: "Points to" the root tree (4 items)
#     and its parent "chore: release v2.0.0"; author and committer the same.
#   • Root tree → src/ ⇒ folders first, then app.ts, index.ts, build.sh
#     (executable), config.json (symlink → ../config.json), ui-kit (submodule).
#   • app.ts ⇒ "Named src/app.ts in commit …, mode 100644 (regular file)".
R="$ROOT/object-model"
new_repo "$R"

at() { GIT_AUTHOR_DATE="$1" GIT_COMMITTER_DATE="$1" git -C "$R" commit -qm "$2"; }

mkdir -p "$R/src/components"
cat > "$R/README.md" <<'EOT'
# Object model
A small app whose tree holds one of every kind of entry.
EOT
printf '{ "theme": "dark" }\n' > "$R/config.json"
cat > "$R/src/app.ts" <<'EOT'
import { render } from './components/render'

export function start(root: HTMLElement): void {
  render(root)
}
EOT
printf "export { start } from './app'\n" > "$R/src/index.ts"
for c in button card render toolbar; do
  printf 'export function %s(): void {}\n' "$c" > "$R/src/components/$c.ts"
done
git -C "$R" add -A
at '2026-09-01T10:00:00-03:00' "feat: app shell and components"
git -C "$R" tag -a v1.0.0 -m "Release v1.0.0"

cat > "$R/src/build.sh" <<'EOT'
#!/usr/bin/env bash
set -euo pipefail
tsc -p .
EOT
chmod +x "$R/src/build.sh"
git -C "$R" add -A
at '2026-10-02T09:30:00-03:00' "build: add the build script"
git -C "$R" tag v1.1.0

ln -s ../config.json "$R/src/config.json"
# A submodule as git stores it: a .gitmodules entry and a gitlink, a commit of
# another repository. Never cloned — the explorer shows what the tree holds —
# so its directory stays empty, which is how git leaves one uninitialised.
mkdir -p "$R/src/ui-kit"
printf '[submodule "src/ui-kit"]\n\tpath = src/ui-kit\n\turl = ../ui-kit.git\n' > "$R/.gitmodules"
git -C "$R" add -A
git -C "$R" update-index --add --cacheinfo "160000,$(git -C "$R" rev-parse v1.0.0^{commit}),src/ui-kit"
at '2026-11-20T16:05:00-03:00' "chore: release v2.0.0"
git -C "$R" tag -a v2.0.0 -m "Release v2.0.0"

git -C "$R" branch hotfix/security-patch v1.1.0

mkdir -p "$R/src/plugins"
printf 'export const plugins: string[] = []\n' > "$R/src/plugins/registry.ts"
printf 'export function loadPlugins(): void {}\n' > "$R/src/plugins/load.ts"
cat > "$R/src/app.ts" <<'EOT'
import { loadPlugins } from './plugins/load'
import { render } from './components/render'

export function start(root: HTMLElement): void {
  loadPlugins()
  render(root)
}
EOT
git -C "$R" add -A
at '2026-11-27T14:21:00-03:00' "feat: plugin system"

summary "object-model" "one tree with a subtree, file, executable, symlink and submodule gitlink; annotated and lightweight tags — for the Object explorer"
