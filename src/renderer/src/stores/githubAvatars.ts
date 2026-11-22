import { avatarApi } from '../infrastructure/api'
import { createAvatarBatcher, type AvatarBatchScope } from '../lib/avatarBatch'

/**
 * The one batcher for commit-author pictures from GitHub, and the active
 * profile's own picture. Module state rather than a zustand store: nothing
 * renders from it directly — each `<Avatar>` awaits its own answer.
 */
const batcher = createAvatarBatcher((scope, items) => avatarApi.github(scope.remoteUrl, scope.repoPath, items, scope.size))

export function githubAuthorAvatar(scope: AvatarBatchScope, email: string, sha?: string): Promise<string | null> {
  return batcher.request(scope, email, sha)
}

const profile = new Map<string, Promise<string | null>>()

/**
 * The active profile's GitHub account picture, asked once per profile and size
 * (main caches per token). Main answers for whichever profile is active, so the
 * caller only asks while `profileId` is the active one.
 */
export function githubProfileAvatar(profileId: string, size: number): Promise<string | null> {
  const key = `${profileId}\n${size}`
  let job = profile.get(key)
  if (!job) {
    job = avatarApi.profileGithub(size).catch(() => null)
    profile.set(key, job)
    // A miss may be a token not entered yet: ask again on the next mount.
    void job.then((u) => {
      if (!u) profile.delete(key)
    })
  }
  return job
}
