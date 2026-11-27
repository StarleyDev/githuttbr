/**
 * The pure half of Settings → AI's behaviour sections: what each style looks
 * like, what the repository chat may do right now, and whose AI is on screen.
 *
 * The samples here are code samples — a commit message, a branch name, a few
 * merged lines — and stay as they are in every language, like the examples the
 * prompts in `main/ai.ts` give the model. Sentences a user reads come back as
 * dictionary keys (`{ key, vars }`), so this stays testable against stable keys.
 */
import type { TranslationKey } from '../i18n'
import type { AIConfig, BranchNamingStyle, ChatActionApproval, CommitStyle, ConflictStyle, ExplainStyle } from '../../../shared/types'

/** The styles shown as cards; the rest sit behind "More styles". */
export const FEATURED_COMMIT_STYLES: readonly { id: CommitStyle; nameKey: TranslationKey }[] = [
  { id: 'conventional', nameKey: 'commitStyleName.conventional' },
  { id: 'gitmoji', nameKey: 'commitStyleName.gitmoji' },
  { id: 'ticket', nameKey: 'commitStyleName.ticket' }
]

export function isFeaturedCommitStyle(style: CommitStyle): boolean {
  return FEATURED_COMMIT_STYLES.some((s) => s.id === style)
}

/**
 * One summary line in the given style. Matches what `styleGuidance` in
 * `main/ai.ts` asks the model for — gitmoji is the unicode emoji, never a
 * `:shortcode:`, and a ticket prefix ends in a colon.
 */
export function commitStyleExample(style: CommitStyle): string {
  switch (style) {
    case 'ticket':
      return 'GH-42: add review'
    case 'gitmoji':
      return '✨ add review'
    case 'gitmoji-conventional':
      return '✨ feat(chat): add review'
    case 'plain':
      return 'add review'
    case 'caveman':
      return 'ME ADD REVIEW. CODE GOOD.'
    case 'haiku':
      return 'review arrives now / the chat reads each line you changed / merge with a calm mind'
    // Auto falls back to conventional when the branch names no ticket.
    case 'auto':
    case 'conventional':
    default:
      return 'feat(chat): add review'
  }
}

const SAMPLE_BODY = 'Ask the chat to review the staged diff and point at\nproblems before the commit is written.'

/**
 * A whole sample message for the preview: the summary in the chosen style, a
 * body when descriptions are on, the co-author trailer when it is on. Static —
 * the preview never calls a model.
 */
export function commitPreview(
  ai: Pick<AIConfig, 'commitStyle' | 'generateDescription' | 'coAuthor'>,
  coAuthor: string
): string {
  const parts = [commitStyleExample(ai.commitStyle)]
  if (ai.generateDescription !== false) parts.push(SAMPLE_BODY)
  if (ai.coAuthor !== false) parts.push(`Co-authored-by: ${coAuthor}`)
  return parts.join('\n\n')
}

/** The short names the explain pills show; the full label describes the chosen one. */
export const EXPLAIN_STYLE_NAMES: readonly { id: ExplainStyle; nameKey: TranslationKey; key: TranslationKey }[] = [
  { id: 'normal', nameKey: 'explainStyleName.normal', key: 'explainStyle.normal' },
  { id: 'concise', nameKey: 'explainStyleName.concise', key: 'explainStyle.concise' },
  { id: 'detailed', nameKey: 'explainStyleName.detailed', key: 'explainStyle.detailed' },
  { id: 'eli5', nameKey: 'explainStyleName.eli5', key: 'explainStyle.eli5' },
  { id: 'caveman', nameKey: 'explainStyleName.caveman', key: 'explainStyle.caveman' },
  { id: 'pirate', nameKey: 'explainStyleName.pirate', key: 'explainStyle.pirate' },
  { id: 'formal', nameKey: 'explainStyleName.formal', key: 'explainStyle.formal' }
]

/** A branch name in the given style, following `branchStyleGuidance` in `main/ai.ts`. */
export function branchNameExample(style: BranchNamingStyle | undefined): string {
  switch (style) {
    case 'prefix/ticket-description':
      return 'feature/GH-42-add-provider-drafts'
    case 'username/prefix/description':
      return 'you/feature/add-provider-drafts'
    case 'plain':
      return 'add-provider-drafts'
    case 'prefix/description':
    default:
      return 'feature/add-provider-drafts'
  }
}

/** The same two-sided conflict, resolved the way each style asks for. */
export function conflictExample(style: ConflictStyle | undefined): string {
  switch (style) {
    case 'commented':
      return '// merged: kept both limits\nconst limit = options.limit ?? config.limit ?? 50'
    case 'conservative':
      return 'const limit = options.limit ?? 50\nconst configLimit = config.limit ?? 50'
    case 'clean':
    default:
      return 'const limit = options.limit ?? config.limit ?? 50'
  }
}

/**
 * What the repository chat may do, as `main/repoChat.ts` decides it. The
 * defaults matter: actions are on unless turned off, file edits are off unless
 * `repoChatReadOnly` is explicitly `false`, remote actions are off unless
 * explicitly `true` — and neither file nor remote actions exist without
 * actions.
 */
export interface ChatCapabilities {
  chat: boolean
  git: boolean
  files: boolean
  remote: boolean
  approval: ChatActionApproval
}

export function chatCapabilities(ai: AIConfig): ChatCapabilities {
  const git = ai.repoChatActions !== false
  return {
    chat: ai.repoChat !== false,
    git,
    files: git && ai.repoChatReadOnly === false,
    remote: git && ai.repoChatRemoteActions === true,
    approval: ai.repoChatApproval ?? 'ask'
  }
}

/**
 * "Create, edit and delete files" is the positive face of the stored
 * `repoChatReadOnly`: on means read-only is `false`. The stored field and its
 * default (unset = read-only) do not change, so saved settings read the same.
 */
export function fileEditsAllowed(ai: AIConfig): boolean {
  return ai.repoChatReadOnly === false
}

export function withFileEdits(ai: AIConfig, allowed: boolean): AIConfig {
  return { ...ai, repoChatReadOnly: !allowed }
}

const APPROVAL_SUMMARY: Record<ChatActionApproval, TranslationKey> = {
  ask: 'aiBehaviour.approvalAsk',
  'auto-safe': 'aiBehaviour.approvalSafe',
  'auto-all': 'aiBehaviour.approvalAll'
}

/**
 * The banner over the chat permissions. `abilities` are keys of short verb
 * phrases the caller joins as a list in the reader's language; `approval` is
 * the key of how they run. Rendered as
 * `interp(t(key), { abilities: list(abilities.map(t)), approval: t(approval) })`.
 */
export interface ChatSummary {
  key: TranslationKey
  abilities: TranslationKey[]
  approval?: TranslationKey
}

export function chatSummary(ai: AIConfig): ChatSummary {
  const can = chatCapabilities(ai)
  if (!can.chat) return { key: 'aiBehaviour.chatOff', abilities: [] }
  if (!can.git) return { key: 'aiBehaviour.chatCanOnly', abilities: ['aiBehaviour.canRead'] }
  const abilities: TranslationKey[] = ['aiBehaviour.canRead', 'aiBehaviour.canGit']
  if (can.files) abilities.push('aiBehaviour.canFiles')
  if (can.remote) abilities.push('aiBehaviour.canRemote')
  return { key: 'aiBehaviour.chatCan', abilities, approval: APPROVAL_SUMMARY[can.approval] }
}

/**
 * The line over the behaviour sections: whose AI this is and who it reaches.
 * `profiles` is filled with the names of the profiles following the general AI
 * — the caller joins them as a list.
 */
export interface ScopeLine {
  key: TranslationKey
  profile?: string
  profiles: string[]
}

export function behaviourScopeLine(
  scope: string | undefined,
  profiles: readonly { id: string; name: string; ownAI?: boolean }[]
): ScopeLine | null {
  if (!scope) return null
  if (scope.startsWith('profile:')) {
    const own = profiles.find((p) => p.id === scope.slice('profile:'.length))
    return own ? { key: 'settings.aiBehaviourScopeOwn', profile: own.name, profiles: [own.name] } : null
  }
  const followers = profiles.filter((p) => p.ownAI !== true).map((p) => p.name)
  return followers.length
    ? { key: 'settings.aiBehaviourScopeGeneral', profiles: followers }
    : { key: 'settings.aiBehaviourScopeGeneralNobody', profiles: [] }
}
