/**
 * Whether a file's bytes are text, and the text when they are — decided here,
 * on the bytes, for every pull request diff the app computes itself (a host's
 * file read, a blob git called binary). A host's own "is binary" flag is not
 * trusted: Azure DevOps has been seen to set it on plain text that is not
 * ASCII, and on UTF-16 files, which then showed no diff at all.
 *
 * The rules, in order:
 * - a byte-order mark settles the encoding (UTF-8, UTF-16 LE/BE);
 * - a NUL byte means binary — unless the bytes read as BOM-less UTF-16 (every
 *   other byte NUL, the shape of mostly-ASCII UTF-16);
 * - valid UTF-8 is text;
 * - invalid UTF-8 is text in a single-byte encoding (Windows-1252, Latin-1)
 *   when control bytes are rare — a legacy file — and binary when they are not.
 */

export type FileBytesVerdict = { kind: 'text'; text: string } | { kind: 'binary' }

/** How far into a file the NUL and control-byte checks look — git's own window. */
const SNIFF_BYTES = 8000

/** Above this share of control bytes, a file that is not UTF-8 is taken for binary. */
const CONTROL_SHARE = 0.1

function decodeUtf16(bytes: Uint8Array, littleEndian: boolean, skip: number): string {
  const units = Math.floor((bytes.length - skip) / 2)
  let out = ''
  const CHUNK = 8192
  for (let i = 0; i < units; i += CHUNK) {
    const n = Math.min(CHUNK, units - i)
    const part = new Array<number>(n)
    for (let j = 0; j < n; j++) {
      const at = skip + (i + j) * 2
      part[j] = littleEndian ? bytes[at] | (bytes[at + 1] << 8) : (bytes[at] << 8) | bytes[at + 1]
    }
    out += String.fromCharCode(...part)
  }
  return out
}

/** BOM-less UTF-16: in the sniffed window, one byte of each pair is nearly always NUL. */
function sniffUtf16(bytes: Uint8Array): 'le' | 'be' | null {
  const n = Math.min(bytes.length, SNIFF_BYTES) & ~1
  if (n < 4) return null
  let evenZero = 0
  let oddZero = 0
  for (let i = 0; i < n; i += 2) {
    if (bytes[i] === 0) evenZero++
    if (bytes[i + 1] === 0) oddZero++
  }
  const pairs = n / 2
  // ASCII text in UTF-16 LE is `x 00 x 00`; a few non-Latin characters are allowed.
  if (oddZero / pairs > 0.7 && evenZero / pairs < 0.1) return 'le'
  if (evenZero / pairs > 0.7 && oddZero / pairs < 0.1) return 'be'
  return null
}

function isControlByte(b: number): boolean {
  // Tab, newline, vertical tab, form feed, carriage return and escape appear in text.
  return b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0b && b !== 0x0c && b !== 0x0d && b !== 0x1b
}

export function decodeFileBytes(bytes: Uint8Array): FileBytesVerdict {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { kind: 'text', text: new TextDecoder('utf-8').decode(bytes.subarray(3)) }
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return { kind: 'text', text: decodeUtf16(bytes, true, 2) }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return { kind: 'text', text: decodeUtf16(bytes, false, 2) }
  const window = bytes.subarray(0, SNIFF_BYTES)
  if (window.includes(0)) {
    const utf16 = sniffUtf16(bytes)
    return utf16 ? { kind: 'text', text: decodeUtf16(bytes, utf16 === 'le', 0) } : { kind: 'binary' }
  }
  try {
    return { kind: 'text', text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  } catch {
    // Not UTF-8. A legacy single-byte file has few control bytes; binary data has many.
  }
  let controls = 0
  for (const b of window) if (isControlByte(b)) controls++
  if (window.length && controls / window.length > CONTROL_SHARE) return { kind: 'binary' }
  return { kind: 'text', text: new TextDecoder('windows-1252').decode(bytes) }
}

