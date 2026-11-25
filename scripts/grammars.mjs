/**
 * Where each tree-sitter grammar the semantic diff ships comes from.
 *
 * Read by sync-grammars.mjs (copies the .wasm files into resources/tree-sitter)
 * and gen-licenses.mjs (the grammars ship inside the app, so their licences do
 * too, although npm files them under devDependencies).
 *
 * `language` is the output name — resources/tree-sitter/tree-sitter-<language>.wasm
 * — and must match a `grammar` in src/main/semantic.ts. A grammar comes from
 * its own npm package when the published tarball carries a prebuilt .wasm;
 * otherwise it is built once and committed under vendor/ (`vendored`), with a
 * README saying how. Every .wasm here must load in the installed
 * web-tree-sitter: see the ABI note in .github/dependabot.yml.
 */

/** @type {{ language: string, package?: string, vendored?: string, file: string }[]} */
export const GRAMMARS = [
  { language: 'bash', package: 'tree-sitter-bash', file: 'tree-sitter-bash.wasm' },
  { language: 'c', package: 'tree-sitter-c', file: 'tree-sitter-c.wasm' },
  { language: 'c_sharp', package: 'tree-sitter-c-sharp', file: 'tree-sitter-c_sharp.wasm' },
  { language: 'cpp', package: 'tree-sitter-cpp', file: 'tree-sitter-cpp.wasm' },
  { language: 'go', package: 'tree-sitter-go', file: 'tree-sitter-go.wasm' },
  { language: 'java', package: 'tree-sitter-java', file: 'tree-sitter-java.wasm' },
  { language: 'javascript', package: 'tree-sitter-javascript', file: 'tree-sitter-javascript.wasm' },
  { language: 'kotlin', package: '@tree-sitter-grammars/tree-sitter-kotlin', file: 'tree-sitter-kotlin.wasm' },
  { language: 'lua', package: '@tree-sitter-grammars/tree-sitter-lua', file: 'tree-sitter-lua.wasm' },
  { language: 'php', package: 'tree-sitter-php', file: 'tree-sitter-php.wasm' },
  { language: 'python', package: 'tree-sitter-python', file: 'tree-sitter-python.wasm' },
  { language: 'ruby', package: 'tree-sitter-ruby', file: 'tree-sitter-ruby.wasm' },
  { language: 'rust', package: 'tree-sitter-rust', file: 'tree-sitter-rust.wasm' },
  { language: 'scala', package: 'tree-sitter-scala', file: 'tree-sitter-scala.wasm' },
  // tree-sitter-swift publishes no .wasm; see vendor/tree-sitter-swift/README.md.
  { language: 'swift', vendored: 'vendor/tree-sitter-swift', file: 'tree-sitter-swift.wasm' },
  { language: 'tsx', package: 'tree-sitter-typescript', file: 'tree-sitter-tsx.wasm' },
  { language: 'typescript', package: 'tree-sitter-typescript', file: 'tree-sitter-typescript.wasm' },
  { language: 'zig', package: '@tree-sitter-grammars/tree-sitter-zig', file: 'tree-sitter-zig.wasm' }
]

/** Directory, relative to the project root, a grammar's .wasm and licence live in. */
export function grammarSource(g) {
  return g.vendored ?? `node_modules/${g.package}`
}
