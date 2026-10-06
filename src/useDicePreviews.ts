import { useEffect, useState } from 'react'

// Still pictures of each die (a d20 showing 20), for the buttons that add them. The 3D code loads in the
// background after the panel has appeared, and the pictures fill in one by one; until a picture is
// ready, its button shows the die's name. Without WebGL the buttons simply keep their names.
const PICTURE_PIXELS = 128

export function useDicePreviews(): Record<number, string> {
  const [previews, setPreviews] = useState<Record<number, string>>({})

  useEffect(() => {
    let cancelled = false
    const start = window.setTimeout(() => {
      import('./dice3d/previews')
        .then(({ renderDicePreviews }) =>
          renderDicePreviews(PICTURE_PIXELS, (size, url) => {
            if (!cancelled) setPreviews((current) => ({ ...current, [size]: url }))
          }),
        )
        .catch(() => undefined)
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(start)
    }
  }, [])

  return previews
}
