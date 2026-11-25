# tree-sitter-swift.wasm (vendored)

The semantic diff's Swift grammar. Every other grammar comes from its npm
package through `scripts/sync-grammars.mjs`; Swift is the one whose published
package ships no `.wasm`, so the built file is committed here instead. That
keeps contributors and CI free of a WASM toolchain.

| | |
|---|---|
| Source | npm `tree-sitter-swift@0.7.1` (its tarball carries the generated `src/parser.c`) |
| Tarball integrity | `sha512-pneKVTuGamaBsqqqfB9BvNQjktzh/0IVPR54jLB5Fq/JTDQwYHd0Wo6pVyZ5jAYpbztzq+rJ/rpL9ruxTmSoKw==` |
| Built with | `tree-sitter-cli@0.27.2` (`tree-sitter build --wasm`, wasi-sdk 34, binaryen 132) |
| Loaded by | `web-tree-sitter` 0.27 — grammar ABI 14 |
| Size | 3.3 MB |
| SHA-256 | `24a6afb13db61ffd7d53dd848bbf684ec1c3aacea685a0857dcd1db673d28c7e` |
| Licence | MIT, `LICENSE` beside this file; `package.json` here is provenance for `gen-licenses` |

## Rebuild

Needs network on first run: the CLI downloads wasi-sdk and binaryen into
`~/.cache/tree-sitter`. No Docker, no emscripten. The build is reproducible —
the same inputs give the same SHA-256.

```bash
tmp=$(mktemp -d) && cd "$tmp"
npm pack tree-sitter-swift@0.7.1
# Must print the tarball integrity above; anything else is not the audited source.
echo "sha512-$(openssl dgst -sha512 -binary tree-sitter-swift-0.7.1.tgz | base64 | tr -d '\n')"
tar xzf tree-sitter-swift-0.7.1.tgz
npx --yes tree-sitter-cli@0.27.2 build --wasm -o tree-sitter-swift.wasm package
cp tree-sitter-swift.wasm <repo>/vendor/tree-sitter-swift/
```

Then update the table above and run `npm run postinstall` (or
`node scripts/sync-grammars.mjs`) and `npm test`.

## When to rebuild

- **A `web-tree-sitter` minor or major bump.** The runtime and the grammars
  share an ABI: 0.25 changed the WASM module format and stranded every older
  grammar. Dependabot moves the npm grammars together with the runtime; this
  file does not move on its own, so the semantic-diff tests are what catch it.
- A new `tree-sitter-swift` release worth having. Bump the version in
  `package.json` here as well, so the licence list stays honest.
