import { ShieldAlert } from 'lucide-react'
import { vaultApi } from '../infrastructure/api'
import { useUIStore } from '../stores/ui'
import { t as tNow, useT } from '../i18n'

/**
 * The vault file exists but could not be read (`VaultListResult.unreadable`).
 * Shown in place of the entries: nothing can be added until it reads again, so
 * the page offers the two ways out — retry (reopen, after unlocking the
 * keychain) or start a new vault, which keeps the old file as a backup.
 */
export function VaultUnreadableNotice({ onReload }: { onReload: () => void }): React.JSX.Element {
  const t = useT()

  // Asked first, and says what happens to the old file: kept beside the new one.
  const askReplace = (): void =>
    useUIStore.getState().openDialog({
      kind: 'confirm',
      title: t('vault.replaceStoreTitle'),
      message: t('vault.replaceStoreMessage'),
      danger: true,
      confirmLabel: t('vault.replaceStore'),
      onConfirm: () =>
        void vaultApi
          .replaceUnreadable()
          .catch(() => false)
          .finally(onReload)
    })

  return (
    <div className="vault-unavailable">
      <ShieldAlert size={16} />
      <span>{t('vault.unreadable')}</span>
      <button className="btn ghost small" onClick={onReload}>
        {t('modal.retry')}
      </button>
      <button className="btn ghost small" onClick={askReplace}>
        {t('vault.replaceStore')}
      </button>
    </div>
  )
}

/** After a write: the vault turned out unreadable, so nothing was saved — say so. */
export function vaultWriteRefused(result: { unreadable?: boolean } | null | undefined): boolean {
  if (!result?.unreadable) return false
  useUIStore.getState().toast('error', tNow('vault.unreadable'))
  return true
}
