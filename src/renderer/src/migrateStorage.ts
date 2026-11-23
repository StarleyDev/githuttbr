// Imported first by main.tsx, for its side effect alone: stores read their
// persisted layout while their modules evaluate, so the legacy keys have to be
// copied before any of them is imported.
import { migrateLegacyStorageKeys } from './lib/legacyStorage'

try {
  migrateLegacyStorageKeys(localStorage)
} catch {
  // Storage blocked or full: start from defaults rather than not start.
}
