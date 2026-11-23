// The follow-up to a pull request the Create PR dialog just made: list it,
// say so, and open the browser only when the user asked for that.
import { shellApi } from '../infrastructure/api'
import { interp, t, type TranslationKey } from '../i18n'
import { planPrCreated } from '../lib/prCreated'
import type { CreatePrResult, PrMetaField } from '../../../shared/types'
import { useRepoStore } from './repo'
import { useSettingsStore } from './settings'
import { useUIStore } from './ui'

const FIELD_LABEL: Record<PrMetaField, TranslationKey> = {
  reviewers: 'createPR.reviewersLabel',
  assignees: 'createPR.assigneesLabel',
  labels: 'createPR.labelsLabel'
}

export interface PrCreatedContext {
  repoPath: string
  remoteUrl: string
  title: string
  openInBrowser: boolean
}

export async function announcePrCreated(res: CreatePrResult, ctx: PrCreatedContext): Promise<void> {
  const plan = planPrCreated(res, ctx.openInBrowser)
  const ui = useUIStore.getState()
  const settings = useSettingsStore.getState()
  ui.toast('success', interp(t(plan.notice.key), { ...plan.notice.vars, list: t('sidebar.pullRequests') }), {
    action: {
      label: t('createPR.viewInApp'),
      run: () =>
        useSettingsStore.getState().openPageTab({
          type: 'pr',
          repoPath: ctx.repoPath,
          remoteUrl: ctx.remoteUrl,
          number: res.number,
          title: ctx.title
        })
    }
  })
  // The PR exists either way; a pick the host refused is said, never dropped quietly.
  if (plan.metaFailed.length) {
    const lang = settings.settings.language ?? 'en'
    const parts = new Intl.ListFormat(lang, { type: 'conjunction' }).format(plan.metaFailed.map((f) => t(FIELD_LABEL[f])))
    ui.toast('error', interp(t('createPR.createdMetaFailed'), { n: res.number, parts }))
  }
  if (plan.openUrl) void shellApi.openExternal(plan.openUrl)
  // Without this the sidebar keeps its last list until the next poll, and the
  // notice would point at a list that does not show the PR yet.
  await useRepoStore.getState().refreshPRs(ctx.repoPath, { silent: true })
}
