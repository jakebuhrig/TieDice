import { useCallback, useState } from 'react'

// A boolean remembered in localStorage. `getDefault` only runs when nothing is stored yet.
export function usePersistedBoolean(
  storageKey: string,
  getDefault: () => boolean,
): [value: boolean, toggle: () => void] {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored !== null) return stored === '1'
    } catch {
      // Storage can be unavailable (private windows, blocked site data); fall through to the default.
    }
    return getDefault()
  })

  const toggle = useCallback(() => {
    const next = !value
    setValue(next)
    try {
      localStorage.setItem(storageKey, next ? '1' : '0')
    } catch {
      // Not persisted this time; the choice still applies for the current session.
    }
  }, [storageKey, value])

  return [value, toggle]
}
