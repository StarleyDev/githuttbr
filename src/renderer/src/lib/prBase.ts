// Which ref the pull-request dialog measures a new PR against, and what it says
// when that ref is not the one the host will use. Pure, so it is tested against
// stable keys; CreatePRModal does the IPC.
import type { TranslationKey } from '../i18n'
import type { RemoteInfo } from '../../../shared/types'

/**
 * The remote the PR is being opened on: the one whose URL the dialog targets,
 * else the remote of the source branch's upstream, else `origin`. Remote names
 * may contain `/`, so the upstream is matched against the known names (longest
 * first) instead of being split at the first slash.
 */
export function prBaseRemote(remotes: RemoteInfo[], remoteUrl: string, upstream: string | null | undefined): string {
  const byUrl = remoteUrl ? remotes.find((r) => r.url === remoteUrl) : undefined
  if (byUrl) return byUrl.name
  if (upstream) {
    const named = [...remotes]
      .sort((a, b) => b.name.length - a.name.length)
      .find((r) => upstream.startsWith(`${r.name}/`))
    if (named) return named.name
  }
  return 'origin'
}

/**
 * The hint under the branch pickers, or null when the prefill was measured
 * against a freshly fetched remote base — the normal case, which says nothing.
 */
export function prBaseHint(baseIsRemote: boolean, refreshed: boolean): TranslationKey | null {
  if (!baseIsRemote) return 'createPR.baseLocal'
  if (!refreshed) return 'createPR.baseStale'
  return null
}
