import { describe, expect, it } from 'vitest'
import { modelPickerView, type ModelPickerInput } from '../src/renderer/src/lib/modelPicker'

// Settings → AI → the model picker: list or typed field, decided only once the
// provider's list is in. Deciding earlier made Settings jump to a typed field.

const bundled = ['gpt-4o-mini', 'gpt-4o']
const base: ModelPickerInput = { value: '', models: bundled, showAll: false, mode: 'auto', settled: false }

describe('modelPickerView', () => {
  it('waits for the provider list before judging a newer model, keeping it on screen', () => {
    const view = modelPickerView({ ...base, value: 'gpt-5' })
    expect(view.next).toBe('auto')
    expect(view.options).toEqual([...bundled, 'gpt-5'])
  })

  it('shows a model the provider lists in the list, not as typed', () => {
    const view = modelPickerView({ ...base, value: 'gpt-5', models: ['gpt-5', ...bundled], settled: true })
    expect(view.next).toBe('list')
    expect(view.options).not.toContain(undefined)
  })

  it('falls back to the typed field once the list is in and lacks the model', () => {
    expect(modelPickerView({ ...base, value: 'my-finetune', settled: true }).next).toBe('custom')
  })

  it('treats a failed list request as settled, against the bundled list', () => {
    expect(modelPickerView({ ...base, value: 'gpt-4o', settled: true }).next).toBe('list')
  })

  it('holds a decision: typing a listed name does not swap the field away', () => {
    expect(modelPickerView({ ...base, value: 'gpt-4o', mode: 'custom', settled: true }).next).toBe('custom')
  })

  it('opens the full list when the saved model is only there', () => {
    const view = modelPickerView({ ...base, value: 'o3', allModels: [...bundled, 'o3'], settled: true })
    expect(view.shown).toContain('o3')
    expect(view.next).toBe('list')
    expect(view.hasMore).toBe(true)
  })
})
