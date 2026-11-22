import { AnimatePresence, motion } from 'framer-motion'
import { FolderGit2, Loader2, X } from 'lucide-react'
import { useClonesStore, type CloneTask } from '../stores/clones'
import { useT, interp } from '../i18n'

function CloneRow({ task }: { task: CloneTask }): React.JSX.Element {
  const t = useT()
  const cancel = useClonesStore((s) => s.cancel)
  const p = task.progress
  // Null while git has no total for the stage: the bar goes indeterminate, not fake.
  const pct = p && p.total > 0 ? Math.round(p.progress) : null
  return (
    <motion.div
      className="clone-tray-item"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      role="status"
    >
      <div className="clone-tray-head">
        <FolderGit2 size={14} />
        <span className="clone-tray-name" title={task.url}>
          {interp(t('clone.trayTitle'), { name: task.name })}
        </span>
        <button
          className="clone-tray-cancel"
          onClick={() => cancel(task.id)}
          disabled={task.cancelling}
          title={t('clone.cancel')}
          aria-label={t('clone.cancel')}
        >
          {task.cancelling ? <Loader2 size={13} className="spin" /> : <X size={13} />}
        </button>
      </div>
      <div className="clone-progress-head">
        <span>
          {task.cancelling
            ? t('clone.cancelling')
            : task.queued
              ? t('clone.queued')
              : p
                ? `${p.stage}…`
                : t('clone.starting')}
        </span>
        {pct !== null && <span className="clone-progress-pct">{pct}%</span>}
      </div>
      <div
        className="clone-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
      >
        <div
          className={`clone-progress-bar ${pct !== null ? '' : 'indeterminate'}`}
          style={pct !== null ? { width: `${pct}%` } : undefined}
        />
      </div>
    </motion.div>
  )
}

/** Clones that left their dialog — the dialog closing hides a clone, it does not stop it. */
export function CloneTray(): React.JSX.Element | null {
  const tasks = useClonesStore((s) => s.tasks)
  const detached = tasks.filter((x) => !x.attached)
  if (!detached.length) return null
  return (
    <div className="clone-tray">
      <AnimatePresence>
        {detached.map((task) => (
          <CloneRow key={task.id} task={task} />
        ))}
      </AnimatePresence>
    </div>
  )
}
