import { ArrowLeft } from 'lucide-react'
import { useT } from '../i18n'
import { useUIStore, type LauncherBackTarget } from '../stores/ui'

/** The way back to Open repository from a dialog it opened (Clone, Create,
 *  Scanned repositories), for the same group. A mis-click there should not
 *  mean closing the dialog and reopening Open repository. */
export function LauncherBack({ target }: { target: LauncherBackTarget }): React.JSX.Element {
  const t = useT()
  const openModal = useUIStore((s) => s.openModal)
  return (
    <button
      type="button"
      className="icon-btn launcher-back"
      title={t('launcher.back')}
      aria-label={t('launcher.back')}
      onClick={() => openModal({ kind: 'launcher', groupId: target.groupId })}
    >
      <ArrowLeft size={16} />
    </button>
  )
}
