/** The slice of settings that decides which profile a repository acts as. */
export interface RepoProfileSettings {
  activeProfileId: string
  profiles: ReadonlyArray<{ id: string }>
  repoProfiles?: Readonly<Record<string, string>>
}

/**
 * The profile a repository's hosting actions run as: the one it is bound to,
 * else the active one — the same rule main applies (`boundProfileAuth`). A
 * binding to a deleted profile counts as none.
 */
export function effectiveProfileId(s: RepoProfileSettings, repoPath: string): string {
  const bound = s.repoProfiles?.[repoPath]
  return bound && s.profiles.some((p) => p.id === bound) ? bound : s.activeProfileId
}

/**
 * After Add remote: the profile to bind the repository to so creating the
 * remote, the push that follows and every later hosting call are one account —
 * the picked one when it differs from the one the repository already acts as,
 * else null (nothing to change). An unknown pick binds nothing.
 */
export function bindingAfterAddRemote(s: RepoProfileSettings, repoPath: string, picked: string): string | null {
  if (!s.profiles.some((p) => p.id === picked)) return null
  return picked === effectiveProfileId(s, repoPath) ? null : picked
}
