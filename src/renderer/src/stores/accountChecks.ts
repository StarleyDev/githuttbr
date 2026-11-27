import { create } from 'zustand'
import type { RepoHost } from '../../../shared/types'
import type { TokenCheckFailureKind } from '../../../shared/tokenCheck'

/**
 * What the last account check in Settings found, per profile and host — so the
 * side menu can flag Connected accounts without asking any host itself. Only
 * the checks Settings already makes write here (the Profile page's summary,
 * the Connected accounts page); nothing polls. Session memory: never saved.
 */
interface AccountChecksState {
  failures: Record<string, Partial<Record<RepoHost, TokenCheckFailureKind>>>
  setAccountCheck: (profileId: string, host: RepoHost, failure: TokenCheckFailureKind | null) => void
}

export const useAccountChecksStore = create<AccountChecksState>((set) => ({
  failures: {},
  setAccountCheck: (profileId, host, failure) =>
    set((s) => {
      const current = s.failures[profileId] ?? {}
      if ((current[host] ?? null) === failure) return s
      const next = { ...current }
      if (failure) next[host] = failure
      else delete next[host]
      return { failures: { ...s.failures, [profileId]: next } }
    })
}))
