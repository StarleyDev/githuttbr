/**
 * How the docs guard reads surfaces out of source — kept apart from
 * `docs-check.mjs`, which runs on import, so the parsing can be tested.
 */

/**
 * Static ids of the command-palette entries in `CommandPalette.tsx`.
 *
 * Any `id: '…'` literal counts, wherever its `title` sits: matching the pair on
 * one line let a formatter-wrapped entry slip past the guard unmapped. Template
 * ids (`branch:${name}`) are generated per item and are not surfaces of their own.
 */
export function paletteCommandIds(src) {
  return [...new Set([...src.matchAll(/\bid:\s*['"]([\w-]+)['"]/g)].map((m) => m[1]))]
}
