import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PrFile } from '../../../shared/types'
import {
  getLegacyViewedKey,
  getViewedMarksKey,
  getViewedState,
  migrateLegacyViewed,
  parseViewedMarks,
  setViewedMarks,
  type ViewedMarks,
  type ViewedState
} from '../lib/prViewed'

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function saveViewedMarks(key: string, marks: ViewedMarks): void {
  try {
    localStorage.setItem(key, JSON.stringify(marks))
  } catch {
    // Storage full or blocked: the ticks still show for this session.
  }
}

export interface PrViewed extends ViewedState {
  /** Tick or untick files by name. Stable, so a memoized list can hold it. */
  setFilesViewed: (filenames: string[], viewed: boolean) => void
}

/**
 * The Files tab's "viewed" ticks. Local and kept per repo + PR — GitHub's own
 * viewed state has no simple REST call — and tied to each file's version, so a
 * push that changes a ticked file un-ticks it, as on GitHub.
 */
export function usePrViewed(remoteUrl: string, number: number, files: PrFile[] | null): PrViewed {
  const key = getViewedMarksKey(remoteUrl, number)
  const [marks, setMarks] = useState<ViewedMarks>(() => parseViewedMarks(readStorage(key)))
  const filesRef = useRef(files)
  filesRef.current = files

  // The older path-only ticks become marks once the files are known — they are
  // what a version is read from — and the old key goes away. An empty list (a
  // failed load reads as one) waits for a real one rather than drop them.
  useEffect(() => {
    if (!files?.length) return
    const legacyKey = getLegacyViewedKey(remoteUrl, number)
    const legacy = readStorage(legacyKey)
    if (legacy === null) return
    setMarks((cur) => {
      const next = migrateLegacyViewed(legacy, files, cur)
      saveViewedMarks(key, next)
      return next
    })
    try {
      localStorage.removeItem(legacyKey)
    } catch {
      // Blocked storage: the migration runs again next time, to the same result.
    }
  }, [files, key, remoteUrl, number])

  const setFilesViewed = useCallback(
    (filenames: string[], on: boolean): void => {
      const wanted = new Set(filenames)
      const targets = (filesRef.current ?? []).filter((f) => wanted.has(f.filename))
      setMarks((cur) => {
        const next = setViewedMarks(cur, targets, on)
        saveViewedMarks(key, next)
        return next
      })
    },
    [key]
  )

  const state = useMemo(() => getViewedState(marks, files ?? []), [marks, files])
  return useMemo(() => ({ ...state, setFilesViewed }), [state, setFilesViewed])
}
