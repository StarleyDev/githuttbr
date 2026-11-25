// What the AI model picker shows, as pure logic.
//
// The picker is a list of models, or a typed field for a model the provider
// does not list. Which one is decided once, and only against the provider's
// own list: deciding on first render, when only the bundled list exists,
// turned every newer or subscription model into a typed field — and that
// field, focusing itself, scrolled Settings to it on every open.

export type ModelPickerMode = 'auto' | 'list' | 'custom'

export interface ModelPickerInput {
  /** The saved model; '' when the account default applies. */
  value: string
  /** The models offered first (the provider's chat models, or the bundled list). */
  models: string[]
  /** Everything the provider listed, behind "show all". */
  allModels?: string[]
  showAll: boolean
  mode: ModelPickerMode
  /** The provider's list request has finished, answered or failed. */
  settled: boolean
}

export interface ModelPickerView {
  /** The models in the select, before any placeholder for the saved one. */
  shown: string[]
  /** What the select renders: `shown`, plus the saved model while waiting. */
  options: string[]
  /** The saved model is in the list (or none is saved). */
  known: boolean
  /** The mode to be in: `auto` resolves to list or typed once settled, then holds. */
  next: ModelPickerMode
  /** There are models behind "show all". */
  hasMore: boolean
}

export function modelPickerView(input: ModelPickerInput): ModelPickerView {
  const { value, models, showAll, mode, settled } = input
  const full = input.allModels ?? models
  // A value only in the full list expands it rather than looking forgotten.
  const shown = showAll || (value !== '' && !models.includes(value) && full.includes(value)) ? full : models
  const known = value === '' || shown.includes(value)
  const next: ModelPickerMode = mode === 'auto' && settled ? (known ? 'list' : 'custom') : mode
  // Waiting for the list: the saved model stays on screen as an option, so the
  // select neither shows another row nor drops it.
  const options = !known && value !== '' && mode === 'auto' ? [...shown, value] : shown
  return { shown, options, known, next, hasMore: full.length > models.length }
}
