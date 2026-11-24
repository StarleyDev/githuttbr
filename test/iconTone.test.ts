import { describe, expect, it } from 'vitest'
import { withTone, type IconTone } from '../src/renderer/src/lib/iconTone'
import { ICON_COLOR_MODES, defaultSettings } from '../src/shared/types'

type Item = { label?: string; tone?: IconTone; submenu?: Item[] }

describe('icon colours', () => {
  it('starts on the soft tint', () => {
    expect(defaultSettings().iconColors).toBe('soft')
    expect(ICON_COLOR_MODES).toEqual(['mono', 'soft', 'full'])
  })

  it('gives a menu group its tone, submenus included', () => {
    const items: Item[] = [{ label: 'a' }, { label: 'b', submenu: [{ label: 'b1' }, { label: 'b2', submenu: [{ label: 'deep' }] }] }]
    const toned = withTone<Item>('ref', items)
    expect(toned.map((i) => i.tone)).toEqual(['ref', 'ref'])
    expect(toned[1].submenu?.map((i) => i.tone)).toEqual(['ref', 'ref'])
    expect(toned[1].submenu?.[1].submenu?.[0].tone).toBe('ref')
  })

  it('keeps a tone an entry already names, without changing the input', () => {
    const items: Item[] = [{ label: 'own', tone: 'guard' }, {}]
    const toned = withTone<Item>('shelf', items)
    expect(toned[0].tone).toBe('guard')
    expect(toned[1].tone).toBe('shelf')
    expect(items[1].tone).toBeUndefined()
  })
})
