import { ShieldAlert } from 'lucide-react'
import { vaultApi } from '../infrastructure/api'
import { useUIStore } from '../stores/ui'
import { useSettingsStore } from '../stores/settings'
import { t as tNow, useT, interp } from '../i18n'
import { withoutIpcPrefix } from '../lib/gitErrorHint'
import { vaultRefusalKey, vaultRefusalOf, vaultWriteRefusal, type VaultRefusal } from '../lib/vaultRefusal'

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
          .then(
            (replaced) => {
              const ui = useUIStore.getState()
              // False is main declining: no keychain, or the vault reads after all.
              if (replaced) ui.toast('success', tNow('vault.replaced'))
              else ui.toast('error', tNow('vault.replaceFailed'))
            },
            // A rejection is the disk — the backup copy or the new file — not the keychain.
            (err: unknown) =>
              useUIStore
                .getState()
                .toast(
                  'error',
                  interp(tNow('vault.replaceError'), { error: withoutIpcPrefix(err instanceof Error ? err.message : String(err)) })
                )
          )
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

/**
 * After a write: nothing was saved — the vault could not be read, or the
 * keychain would not open it (`vaultWriteRefusal`). Says why; the caller keeps
 * what was typed on screen.
 */
export function vaultWriteRefused(result: { available: boolean; unreadable?: boolean } | null | undefined): boolean {
  const reason = vaultWriteRefusal(result)
  if (!reason) return false
  useUIStore.getState().toast('error', vaultRefusalText(reason))
  return true
}

export { vaultRefusalOf, type VaultRefusal }

/** The message for a refusal: unreadable is the file, unavailable the keychain. */
export function vaultRefusalText(reason: VaultRefusal): string {
  return tNow(vaultRefusalKey(reason))
}

/**
 * From a flow outside the Vault page (an import, an export): the vault took no
 * part. Says why, and offers the page where it can be retried or replaced.
 */
export function toastVaultRefused(reason: VaultRefusal): void {
  const ui = useUIStore.getState()
  ui.toast('error', vaultRefusalText(reason), {
    action: {
      label: tNow('cmd.vault'),
      run: () => {
        ui.closeModal()
        useSettingsStore.getState().openPageTab({ type: 'vault' })
      }
    }
  })
}
