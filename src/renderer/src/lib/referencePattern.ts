/**
 * Where a `#12` or `!12` in free text is a reference, shared by autolink and
 * the reference extraction so both agree on what counts.
 *
 * Not one when glued to something before it — `org/repo#12` (another
 * repository), `page#12`, `&#39;` (an HTML entity), `a.b#12` — or after it —
 * `#12ab`, `#123abc` (a colour), `#12-x`. A URL fragment like
 * `#issuecomment-12` has no digit after the `#`, so it never matches.
 */
export const HASH_REF = String.raw`(?<![\w/&.-])#(\d+)(?![\w-])`
export const BANG_REF = String.raw`(?<![\w/&.-])!(\d+)(?![\w-])`
/** `AB#12`, Azure Boards' own mention, as a word of its own. */
export const AB_REF = String.raw`(?<![\w/&.-])AB#(\d+)(?![\w-])`
