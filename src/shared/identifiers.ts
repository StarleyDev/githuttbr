/**
 * The name this build leaves behind inside a user's repository: the git config
 * section, the ref namespace, the notes ref and the repository's own config file.
 *
 * GitHuttBr is built from Gitcito, which wrote all of these under `gitcito`.
 * They live in the user's repositories, not in this app, so renaming them is
 * a promise to keep reading the old ones: everything here is written under
 * `APP_ID` and read under `APP_ID` first, then `LEGACY_APP_ID`. Nothing written
 * by an older build is deleted or rewritten behind the user's back.
 */
export const APP_ID = 'githuttbr'
export const LEGACY_APP_ID = 'gitcito'

/** Every namespace that is read, the current one first so it wins a tie. */
export const APP_IDS: readonly string[] = [APP_ID, LEGACY_APP_ID]

/** `refs/<ns>/wip/` — WIP snapshots. */
export const snapshotRefRoot = (ns: string = APP_ID): string => `refs/${ns}/wip`

/** `refs/<ns>/pre-purge/` — the backup a history purge takes first. */
export const prePurgeRefRoot = (ns: string = APP_ID): string => `refs/${ns}/pre-purge`

/** The notes ref local-CI verdicts are pinned under (`refs/notes/<ns>-ci`). */
export const ciNotesRef = (ns: string = APP_ID): string => `${ns}-ci`

/** A purge-backup prefix this build may restore or drop: `refs/<ns>/pre-purge/<seconds>`,
 *  under either namespace and nothing else. */
export function isPrePurgePrefix(prefix: string): boolean {
  return APP_IDS.some((ns) => new RegExp(`^${prePurgeRefRoot(ns)}/\\d+$`).test(prefix))
}
