import { useCallback, useState } from 'react'

const STORAGE_KEY = 'tiedice/gradientPaused'

// An explicit choice wins; otherwise people who prefer reduced motion start paused.
function readInitial(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) return stored === '1'
  } catch {
    // Storage can be unavailable (private windows, blocked site data); fall through to the default.
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useGradientPaused(): [paused: boolean, toggle: () => void] {
  const [paused, setPaused] = useState(readInitial)

  const toggle = useCallback(() => {
    const next = !paused
    setPaused(next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {
      // Not persisted this time; the choice still applies for the current session.
    }
  }, [paused])

  return [paused, toggle]
}
