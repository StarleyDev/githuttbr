import { useSyncExternalStore } from 'react'
import { avatarApi, keychainApi } from '../infrastructure/api'
import { createAvatarBatcher, createProfileAvatarCache, type AvatarBatchScope } from '../lib/avatarBatch'

/**
 * The one batcher for commit-author pictures from GitHub, and the active
 * profile's own picture. Module state rather than a zustand store: nothing
 * renders from it directly — each `<Avatar>` awaits its own answer.
 */
const batcher = createAvatarBatcher((scope, items) =>
  avatarApi.github(scope.remoteUrl, scope.repoPath, items, scope.size)
)

export function githubAuthorAvatar(
  scope: AvatarBatchScope,
  email: string,
  sha?: string
): Promise<string | null> {
  return batcher.request(scope, email, sha)
}

const profile = createProfileAvatarCache((size) => avatarApi.profileGithub(size), () => batcher.generation())

/**
 * The active profile's GitHub account picture, asked once per profile, account,
 * size and unlock generation (main caches per token). `account` is
 * `githubAccountFingerprint` of the profile: a different account, or tokens
 * that were still locked the last time, is a different key. Main answers for
 * whichever profile is active, so the caller only asks while `profileId` is the
 * active one.
 */
export function githubProfileAvatar(profileId: string, account: string, size: number): Promise<string | null> {
  return profile(profileId, account, size)
}

/**
 * How many times the stored tokens have been unlocked this session (0 or 1 in
 * practice). An `<Avatar>` that fell past GitHub while they were still
 * encrypted watches it and asks once more; the batcher forgets its held-back
 * "unknown" answers first, so that ask reaches main. Subscribed on first use,
 * not on import, so nothing here needs a window to load.
 */
let unlocks = 0
const unlockListeners = new Set<() => void>()
let listening = false

function subscribeUnlocks(cb: () => void): () => void {
  if (!listening) {
    listening = true
    keychainApi.onUnlocked(() => {
      unlocks++
      batcher.forgetUnknown()
      for (const l of unlockListeners) l()
    })
  }
  unlockListeners.add(cb)
  return () => unlockListeners.delete(cb)
}

/**
 * The batcher's unlock generation, read at request time: a null answer that
 * comes back under a newer one was asked while the tokens were still locked.
 */
export function secretsUnlockGeneration(): number {
  return batcher.generation()
}

export function useSecretsUnlocks(): number {
  return useSyncExternalStore(subscribeUnlocks, () => unlocks)
}
