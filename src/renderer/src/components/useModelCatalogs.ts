import { useEffect, useRef, useState } from 'react'
import type { AIConfig, ModelCatalog } from '../../../shared/types'
import { accountConnectionKey, resolveAI } from '../../../shared/aiAccounts'
import { aiApi } from '../infrastructure/api'

/** Settings edits arrive keystroke by keystroke: wait for the field to settle. */
const RELOAD_DELAY_MS = 400

/**
 * Live model lists for every configured account, keyed by account id.
 *
 * The main process caches each list on disk for a day, so mounting a surface
 * that shows a model picker costs a cheap IPC round-trip rather than a request
 * per provider. An account is asked again only when its connection changes —
 * another provider, endpoint or CLI, or a key added — never because `ai`
 * changed identity on a keystroke elsewhere in Settings.
 *
 * Returns the raw catalogues so a caller can tell a live list from the bundled
 * fallback; `refresh` bypasses the cache for one account.
 */
export function useModelCatalogs(ai: AIConfig): {
  catalogs: Record<string, ModelCatalog>
  loading: string[]
  /** Accounts whose list request has finished, answered or failed. A picker
   *  waits for this before judging a saved model against the list. */
  settled: string[]
  refresh: (accountId: string) => Promise<ModelCatalog | null>
} {
  const [catalogs, setCatalogs] = useState<Record<string, ModelCatalog>>({})
  const [loading, setLoading] = useState<string[]>([])
  const [settled, setSettled] = useState<string[]>([])
  /** The connection each account's list was last requested for. */
  const requested = useRef<Map<string, string>>(new Map())
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const latest = useRef(ai)
  latest.current = ai

  const load = async (accountId: string, force: boolean): Promise<ModelCatalog | null> => {
    const connection = requested.current.get(accountId)
    setLoading((ids) => (ids.includes(accountId) ? ids : [...ids, accountId]))
    try {
      const cfg = resolveAI({ ...latest.current, defaultAccountId: accountId })
      const catalog = await aiApi.listModels(cfg, force)
      // A list for a connection that has since changed belongs to nobody.
      if (requested.current.get(accountId) === connection) {
        setCatalogs((prev) => ({ ...prev, [accountId]: catalog }))
      }
      return catalog
    } finally {
      setLoading((ids) => ids.filter((id) => id !== accountId))
      setSettled((ids) => (ids.includes(accountId) ? ids : [...ids, accountId]))
    }
  }

  const connections = (ai.accounts ?? []).map(accountConnectionKey).join('\n')
  useEffect(() => {
    for (const account of latest.current.accounts ?? []) {
      const key = accountConnectionKey(account)
      const before = requested.current.get(account.id)
      if (before === key) continue
      requested.current.set(account.id, key)
      if (before === undefined) {
        void load(account.id, false)
        continue
      }
      // The connection changed: the old list is wrong now, not merely stale.
      setCatalogs(({ [account.id]: _dropped, ...rest }) => rest)
      setSettled((ids) => ids.filter((id) => id !== account.id))
      const pending = timers.current.get(account.id)
      if (pending) clearTimeout(pending)
      timers.current.set(
        account.id,
        setTimeout(() => {
          timers.current.delete(account.id)
          void load(account.id, false)
        }, RELOAD_DELAY_MS)
      )
    }
    // Keyed on the connections alone: the config object itself changes far more
    // often than any account's connection does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections])

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending.values()) clearTimeout(timer)
    }
  }, [])

  return { catalogs, loading, settled, refresh: (accountId) => load(accountId, true) }
}
