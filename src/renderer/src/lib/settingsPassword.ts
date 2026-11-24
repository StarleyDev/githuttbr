import { isEncryptedSettingsExport, type SettingsDecryptFailure } from '../../../shared/settingsEncryption'
import { settingsApi } from '../infrastructure/api'
import { useUIStore } from '../stores/ui'
import { t, type TranslationKey } from '../i18n'

/** What to tell the user when an encrypted export would not open. */
export function settingsDecryptMessageKey(reason: SettingsDecryptFailure): TranslationKey {
  if (reason === 'bad-password') return 'settings.importPasswordWrong'
  if (reason === 'unsupported-version') return 'settings.importNewerVersion'
  return 'settings.importFailed'
}

/**
 * The contents of a picked export, ready for `parseSettingsImport`: as is when
 * the file is plain, decrypted when it is password-protected. A wrong password
 * asks again; cancelling, or a file that cannot be opened at all, gives null
 * (the latter with a toast). Uses a stacked dialog, so it works over Settings.
 */
export async function unlockSettingsImport(raw: unknown): Promise<unknown | null> {
  if (!isEncryptedSettingsExport(raw)) return raw
  const ask = (error?: string): Promise<unknown | null> =>
    new Promise((resolve) => {
      useUIStore.getState().openDialog({
        kind: 'input',
        title: t('settings.importPasswordTitle'),
        label: t('settings.importPasswordLabel'),
        submitLabel: t('settings.importPasswordUnlock'),
        secret: true,
        error,
        onSubmit: (password) => {
          void settingsApi.decryptImport(raw, password).then(
            (r) => {
              if (r.ok) resolve(r.data)
              else if (r.reason === 'bad-password') resolve(ask(t(settingsDecryptMessageKey(r.reason))))
              else {
                useUIStore.getState().toast('error', t(settingsDecryptMessageKey(r.reason)))
                resolve(null)
              }
            },
            () => {
              useUIStore.getState().toast('error', t('settings.importFailed'))
              resolve(null)
            }
          )
        },
        onCancel: () => resolve(null)
      })
    })
  return ask()
}
