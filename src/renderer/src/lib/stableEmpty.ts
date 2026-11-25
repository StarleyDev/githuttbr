/**
 * The fallback for a store selector whose slice may be missing. Zustand 5 hands
 * selectors straight to React's useSyncExternalStore, which compares results by
 * identity: `s.list ?? []` returns a fresh array on every call and re-renders
 * forever ("Maximum update depth exceeded"). `s.list ?? NO_ITEMS` is the same
 * object each time. Frozen so a caller that pushes into it fails loudly instead
 * of leaking items into every other empty list; typed `never[]` so it fits any
 * array type.
 */
export const NO_ITEMS = Object.freeze([]) as never[]
