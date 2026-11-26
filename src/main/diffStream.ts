/**
 * A `git diff` read as bytes and cut into one piece per file as it streams in,
 * under a budget — so a pull request of ten thousand files, or one minified
 * file of a hundred megabytes, never sits in memory whole.
 *
 * Each piece starts at a `diff --git ` line. A piece past `fileMaxBytes` keeps
 * only its first `headerBytes` (enough to name the file) and is marked
 * `oversized`. Once the pieces kept add up past `budgetBytes` or `budgetLines`,
 * the splitter says `stop`: the caller ends the read, and every file not seen
 * yet is left to be read on its own, later.
 *
 * Pure byte handling: decoding is the caller's (decodeTextBytes), per file, so
 * one Latin-1 file does not turn the rest into replacement characters.
 */

export interface DiffChunk {
  bytes: Uint8Array
  /** Over fileMaxBytes: `bytes` is only its head. */
  oversized: boolean
}

export interface DiffSplitLimits {
  fileMaxBytes: number
  headerBytes: number
  budgetBytes: number
  budgetLines: number
}

const MARK = Buffer.from('\ndiff --git ')
const NEWLINE = 0x0a

export class DiffChunkSplitter {
  readonly chunks: DiffChunk[] = []
  private carry: Buffer = Buffer.alloc(0)
  private cur: Buffer[] = []
  private curSize = 0
  private curOver = false
  private keptBytes = 0
  private keptLines = 0
  /** The budget ran out: stop reading; the files after the last chunk were not seen. */
  stopped = false

  constructor(private readonly limits: DiffSplitLimits) {}

  /** Feed the next bytes of git's output. False once the budget is spent. */
  push(data: Uint8Array): boolean {
    if (this.stopped) return false
    let buf = this.carry.length ? Buffer.concat([this.carry, data]) : Buffer.from(data)
    let at = buf.indexOf(MARK)
    while (at >= 0) {
      // The newline closes this file; the next one starts at `diff --git`.
      this.append(buf.subarray(0, at + 1))
      this.finish()
      if (this.stopped) return false
      buf = buf.subarray(at + 1)
      at = buf.indexOf(MARK)
    }
    // Keep a tail that could be the start of a split marker; the rest belongs to this file.
    const keep = Math.min(buf.length, MARK.length - 1)
    this.append(buf.subarray(0, buf.length - keep))
    this.carry = Buffer.from(buf.subarray(buf.length - keep))
    return true
  }

  /** git is done: the last file ends here. */
  end(): void {
    if (this.stopped) return
    this.append(this.carry)
    this.carry = Buffer.alloc(0)
    this.finish()
  }

  /**
   * The read was cut by a hard ceiling in the middle of a file: that file ends
   * here as `oversized` (its head kept, `tooLarge` to the caller) rather than
   * never being seen — which would leave it `notLoaded`, read again, cut again.
   */
  endOversized(): void {
    if (this.stopped) return
    this.append(this.carry)
    this.carry = Buffer.alloc(0)
    if (this.curSize) {
      const head = Buffer.concat(this.cur).subarray(0, this.limits.headerBytes)
      this.cur = [head]
      this.curSize = head.length
      this.curOver = true
    }
    this.finish()
    this.stopped = true
  }

  private append(part: Uint8Array): void {
    if (!part.length) return
    if (this.curOver) return
    if (this.curSize + part.length > this.limits.fileMaxBytes) {
      const room = Math.max(0, this.limits.headerBytes - this.curSize)
      if (room) this.cur.push(Buffer.from(part.subarray(0, room)))
      this.curSize += room
      this.curOver = true
      return
    }
    this.cur.push(Buffer.from(part))
    this.curSize += part.length
  }

  private finish(): void {
    if (!this.curSize) return
    const bytes = new Uint8Array(Buffer.concat(this.cur))
    const oversized = this.curOver
    this.cur = []
    this.curSize = 0
    this.curOver = false
    if (!oversized) {
      let lines = 0
      for (const b of bytes) if (b === NEWLINE) lines++
      // The first file always fits: a budget that keeps nothing would loop on-demand reads forever.
      if (this.chunks.length && (this.keptBytes + bytes.length > this.limits.budgetBytes || this.keptLines + lines > this.limits.budgetLines)) {
        this.stopped = true
        return
      }
      this.keptBytes += bytes.length
      this.keptLines += lines
    }
    this.chunks.push({ bytes, oversized })
  }
}
