// Avatar helpers: Gravatar lookup (SHA-256 email hash) + a deterministic
// generated fallback so we never fall back to a bare letter.

import { blobatarUri } from 'blobatar/uri'

// Distinct authors bound these caches, so they are usually tiny — but a
// session across huge multi-author repos would grow them forever. Reset at a
// generous cap instead: refilling is cheap, unbounded growth is not.
const CACHE_CAP = 4000
function capped<K, V>(cache: Map<K, V>, key: K, value: V): V {
  if (cache.size >= CACHE_CAP) cache.clear()
  cache.set(key, value)
  return value
}

const genCache = new Map<string, string>()

/**
 * The generated fallback: a deterministic blobatar derived from the seed,
 * as an SVG data-URI usable as <img> src or CSS background.
 *
 * `background: 'circle'` because `.ava` already clips to a disc — the default
 * transparent backdrop would let the row show through around the figure, so
 * gravatar photos and fallbacks would not read as the same shape. Cached per
 * seed: the graph re-renders the same authors on every scroll, and each URI is
 * ~1 KB of markup to rebuild.
 */
export function generatedAvatar(seed: string): string {
  const key = seed || '?'
  const cached = genCache.get(key)
  if (cached) return cached
  return capped(genCache, key, blobatarUri(key, { background: 'circle' }))
}

const hexCache = new Map<string, string>()

async function sha256Hex(input: string): Promise<string> {
  const cached = hexCache.get(input)
  if (cached) return cached
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return capped(hexCache, input, hex)
}

const urlCache = new Map<string, string>()

/**
 * Gravatar URL for an email (Gravatar accepts SHA-256 hashes). Uses `d=404`
 * so a missing avatar 404s and the caller can fall back to the generated one.
 */
export async function gravatarUrl(email: string, size: number): Promise<string> {
  const norm = email.trim().toLowerCase()
  const key = `${norm}@${size}`
  const cached = urlCache.get(key)
  if (cached) return cached
  const hash = await sha256Hex(norm)
  return capped(urlCache, key, `https://gravatar.com/avatar/${hash}?s=${size}&d=404`)
}

/** Where a picture may come from, in the order they are tried. The generated avatar always follows. */
export type AvatarSource = 'gravatar' | 'github'

/**
 * The photo sources for an author, in order.
 *
 * Gravatar first: it costs no API quota, and an address someone registered
 * there carries a picture they chose for exactly this. GitHub second, and only
 * where it can answer: a noreply address (no API, only the image), a
 * repository on a GitHub the API can be asked, or the active profile's own
 * account.
 *
 * A github.com noreply address skips Gravatar: it is GitHub's own address,
 * nobody registers it with Gravatar, and the lookup would only tell a third
 * party which account was looked at.
 */
export function avatarSources(o: {
  email?: string
  /** The master switch, Settings → Themes → Graph → Show avatars. */
  lookups: boolean
  /** Use GitHub profile pictures. */
  github: boolean
  /** A repository remote or a profile account the API can be asked about. */
  githubLookup: boolean
  noreply: boolean
}): AvatarSource[] {
  if (!o.lookups || !o.email) return []
  if (o.noreply && o.github) return ['github']
  return o.github && o.githubLookup ? ['gravatar', 'github'] : ['gravatar']
}
