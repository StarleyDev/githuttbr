import type { CiJob, CiState } from '../shared/types'

/**
 * A commit's overall badge from its jobs, the same rule the GitHub lookup uses:
 * any failure wins, then anything still running, then "all neutral", else green.
 */
export function aggregateCiState(jobs: readonly CiJob[]): CiState {
  if (jobs.some((j) => j.state === 'failure')) return 'failure'
  if (jobs.some((j) => j.state === 'pending')) return 'pending'
  if (jobs.every((j) => j.state === 'neutral')) return 'neutral'
  return 'success'
}
