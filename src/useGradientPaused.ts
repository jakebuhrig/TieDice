import { usePersistedBoolean } from './usePersistedBoolean'

// An explicit choice wins; otherwise people who prefer reduced motion start paused.
export function useGradientPaused() {
  return usePersistedBoolean('tiedice/gradientPaused', () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
}
