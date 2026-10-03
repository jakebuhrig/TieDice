import { useCallback, useEffect, useState } from 'react'
import { MAX_HISTORY, ROLL_HISTORY_KEY } from './constants'
import type { RollRecord } from './dice'
import { obr } from './obr'

// Shared Roll History lives in room metadata — onMetadataChange already pushes
// updates to every connected client, so this alone covers both the live
// "last roll" view and the bounded history (see GLOSSARY.md: Roll History).
export function useRollHistory() {
  const [history, setHistory] = useState<RollRecord[]>([])

  useEffect(() => {
    if (!obr.isAvailable) return

    let unsubscribeMetadata: (() => void) | undefined

    obr.onReady(() => {
      obr.room.getMetadata().then((metadata) => {
        setHistory((metadata[ROLL_HISTORY_KEY] as RollRecord[]) ?? [])
      })

      unsubscribeMetadata = obr.room.onMetadataChange((metadata) => {
        setHistory((metadata[ROLL_HISTORY_KEY] as RollRecord[]) ?? [])
      })
    })

    return () => {
      unsubscribeMetadata?.()
    }
  }, [])

  const appendPublicRoll = useCallback(async (record: RollRecord) => {
    const metadata = await obr.room.getMetadata()
    const current = (metadata[ROLL_HISTORY_KEY] as RollRecord[]) ?? []
    const next = [...current, record].slice(-MAX_HISTORY)
    await obr.room.setMetadata({ [ROLL_HISTORY_KEY]: next })
  }, [])

  return { history, appendPublicRoll }
}
