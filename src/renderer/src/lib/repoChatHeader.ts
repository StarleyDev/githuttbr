/**
 * The pure half of the repository chat's header pills and empty state: which
 * account and model answer, what the chat may do, how its proposals run, and
 * the starter requests. Sentences come back as dictionary keys so the panel
 * renders them and the tests check stable keys.
 */
import type { TranslationKey } from '../i18n'
import type { AIConfig, ChatActionApproval, ModelCatalog } from '../../../shared/types'
import { accountFor, accountLabel, findAccount, modelFor } from '../../../shared/aiAccounts'
import { accountStatus, type AccountStatus } from './aiAccountDraft'
import { chatCapabilities } from './aiBehaviour'
import { chatModelGroups, type ChatModelGroup } from './repoChatContext'
import { defaultBranchName } from './graphFocus'

/** The model pill: the account and model that would answer the next message. */
export interface ChatModelPill {
  account: string
  model: string
  status: AccountStatus
  /** No chat assignment — the chat follows the profile's model. */
  followsDefault: boolean
}

export function chatModelPill(ai: AIConfig, catalogs: Record<string, ModelCatalog>): ChatModelPill {
  const account = accountFor(ai, 'chat')
  const assigned = ai.assignments?.chat
  return {
    account: account ? accountLabel(account) : '',
    model: modelFor(ai, 'chat'),
    // Derived from the model list the panel already fetched — never a request of its own.
    status: account ? accountStatus(account, catalogs[account.id], undefined).status : 'unchecked',
    followsDefault: !assigned || !findAccount(ai, assigned.accountId)
  }
}

export interface ChatModelMenuGroup extends ChatModelGroup {
  status: AccountStatus
}

/** The model menu: every account's models, each group with its status dot. */
export function chatModelMenu(ai: AIConfig, catalogs: Record<string, ModelCatalog>): ChatModelMenuGroup[] {
  const models = Object.fromEntries(Object.entries(catalogs).map(([id, c]) => [id, c.models]))
  return chatModelGroups(ai, models).map((group) => {
    const account = findAccount(ai, group.accountId)
    const status = account ? accountStatus(account, catalogs[group.accountId], undefined).status : 'unchecked'
    return { ...group, status }
  })
}

/** Whether a menu row is the chat's current choice; the default row is `accountId === ''`. */
export function isChatModelChosen(ai: AIConfig, accountId: string, model: string): boolean {
  const assigned = ai.assignments?.chat
  if (!accountId) return !assigned
  return assigned?.accountId === accountId && assigned.model === model
}

/**
 * The assignments after picking a menu row — the same write the old select
 * made: an empty account id drops the chat's own choice.
 */
export function withChatModel(ai: AIConfig, accountId: string, model: string): NonNullable<AIConfig['assignments']> {
  const assignments = { ...(ai.assignments ?? {}) }
  if (!accountId) delete assignments.chat
  else assignments.chat = { accountId, model }
  return assignments
}

/** The capabilities pill, as short tags: "Can: read · Git · files". */
export function chatCapabilityTags(ai: AIConfig): TranslationKey[] {
  const can = chatCapabilities(ai)
  const tags: TranslationKey[] = ['chat.canRead']
  if (can.git) tags.push('chat.canGit')
  if (can.files) tags.push('chat.canFiles')
  if (can.remote) tags.push('chat.canRemote')
  return tags
}

/** The approval modes in menu order: the pill's wording, the option's name and its hint. */
export const CHAT_APPROVALS: readonly {
  id: ChatActionApproval
  pillKey: TranslationKey
  key: TranslationKey
  hint: TranslationKey
}[] = [
  { id: 'ask', pillKey: 'chat.approvalPillAsk', key: 'chat.approvalAsk', hint: 'settings.approvalAskHint' },
  { id: 'auto-safe', pillKey: 'chat.approvalPillSafe', key: 'chat.approvalSafe', hint: 'settings.approvalSafeHint' },
  { id: 'auto-all', pillKey: 'chat.approvalPillAll', key: 'chat.approvalAll', hint: 'settings.approvalAllHint' }
]

export function approvalPillKey(ai: AIConfig): TranslationKey {
  const id = chatCapabilities(ai).approval
  return (CHAT_APPROVALS.find((a) => a.id === id) ?? CHAT_APPROVALS[0]).pillKey
}

/**
 * The branch "What changed since …?" compares against: the local default by its
 * usual names, else a remote one, else `main`. A guess for a prompt the user
 * edits before sending, not a ref anything resolves.
 */
export function chatBaseBranch(
  branches: { locals: { name: string }[]; remotes: { name: string }[] } | null | undefined
): string {
  if (!branches) return 'main'
  return defaultBranchName(branches.locals) ?? defaultBranchName(branches.remotes) ?? 'main'
}

/** The empty conversation's starter requests; a click fills the draft, never sends. */
export interface ChatStarter {
  key: TranslationKey
  vars?: Record<string, string>
}

export function chatStarterPrompts(base: string): ChatStarter[] {
  return [
    { key: 'chat.starterReview' },
    { key: 'chat.starterSinceBase', vars: { base } },
    { key: 'chat.starterPrDescription' }
  ]
}
