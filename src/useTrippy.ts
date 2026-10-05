import { usePersistedBoolean } from './usePersistedBoolean'

// Trippy (bright, colorful) is the default view; off switches to the calm dark-grey view.
export function useTrippy() {
  return usePersistedBoolean('tiedice/trippy', () => true)
}
