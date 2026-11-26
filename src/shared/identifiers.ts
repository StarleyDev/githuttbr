/**
 * The name this build leaves behind inside a user's repository: the git config
 * section, the ref namespace, the notes ref and the repository's own config file.
 *
 * Only `githuttbr`. The app GitHuttBr was derived from writes the same things
 * under its own name; those belong to that app and are neither read, rewritten
 * nor deleted here (test/upstreamIgnored.test.ts).
 */
export const APP_ID = 'githuttbr'

/** `refs/githuttbr/wip/` — WIP snapshots. */
export const snapshotRefRoot = (): string => `refs/${APP_ID}/wip`

/** `refs/githuttbr/pre-purge/` — the backup a history purge takes first. */
export const prePurgeRefRoot = (): string => `refs/${APP_ID}/pre-purge`

/** The notes ref local-CI verdicts are pinned under (`refs/notes/githuttbr-ci`). */
export const ciNotesRef = (): string => `${APP_ID}-ci`

/** A purge-backup prefix this build may restore or drop: `refs/githuttbr/pre-purge/<seconds>`
 *  and nothing else. */
export function isPrePurgePrefix(prefix: string): boolean {
  return new RegExp(`^${prePurgeRefRoot()}/\\d+$`).test(prefix)
}
