import type { CiJob, CiState, CiStatus } from '../shared/types'

/**
 * A head commit's checks as the PR list's one-line summary — "3 passed · 1 failing".
 * One function for every host, so GitHub and Bitbucket Data Center rows read alike.
 */
export function summariseChecks(status: CiStatus): string {
  const count = (state: CiState): number => status.jobs.filter((j) => j.state === state).length
  const parts: string[] = []
  if (count('success')) parts.push(`${count('success')} passed`)
  if (count('failure')) parts.push(`${count('failure')} failing`)
  if (count('pending')) parts.push(`${count('pending')} running`)
  const neutral = (as: CiJob['neutralAs']): number => status.jobs.filter((j) => j.state === 'neutral' && j.neutralAs === as).length
  if (neutral(undefined)) parts.push(`${neutral(undefined)} skipped`)
  if (neutral('cancelled')) parts.push(`${neutral('cancelled')} cancelled`)
  if (neutral('unknown')) parts.push(`${neutral('unknown')} unknown`)
  return parts.join(' · ')
}
