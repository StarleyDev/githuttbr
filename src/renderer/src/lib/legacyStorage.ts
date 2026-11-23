// Renderer preferences kept in localStorage — panel layout, diff toggles, zoom,
// recent commands — were written under `gitcito-*` / `gitcito.*` keys before
// the rename. They are carried over once, at startup, so nobody loses their
// layout for the sake of a prefix.

/** The slice of the Storage API the migration needs, so tests can pass a Map. */
export interface KeyValueStore {
  readonly length: number
  key(index: number): string | null
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const LEGACY = /^gitcito([-.])/

/** The new name of a legacy key, or null when the key is not one of ours. */
export function migratedStorageKey(key: string): string | null {
  return LEGACY.test(key) ? key.replace(LEGACY, 'githuttbr$1') : null
}

/**
 * Copy every `gitcito-*` / `gitcito.*` value to its `githuttbr` name, unless
 * the new key already holds something — a value written after the rename is
 * newer than any legacy one. The old keys stay: an older build sharing the
 * profile still finds its own. Returns how many keys were copied.
 */
export function migrateLegacyStorageKeys(store: KeyValueStore): number {
  // Collect first: setItem while walking key(i) shifts the indices.
  const keys: string[] = []
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i)
    if (key !== null) keys.push(key)
  }
  let copied = 0
  for (const key of keys) {
    const next = migratedStorageKey(key)
    if (!next || store.getItem(next) !== null) continue
    const value = store.getItem(key)
    if (value === null) continue
    store.setItem(next, value)
    copied++
  }
  return copied
}
