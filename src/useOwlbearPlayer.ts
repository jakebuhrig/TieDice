import { useEffect, useState } from 'react'
import type { Player } from '@owlbear-rodeo/sdk'
import { obr } from './obr'

export interface OwlbearPlayer {
  ready: boolean
  role: Player['role'] | null
  playerId: string
  playerName: string
  playerColor: string
}

export function useOwlbearPlayer(): OwlbearPlayer {
  const [state, setState] = useState<OwlbearPlayer>({
    ready: false,
    role: null,
    playerId: '',
    playerName: '',
    playerColor: '#000000',
  })

  useEffect(() => {
    if (!obr.isAvailable) return

    let unsubscribeChange: (() => void) | undefined

    obr.onReady(async () => {
      const [role, playerName, playerColor] = await Promise.all([
        obr.player.getRole(),
        obr.player.getName(),
        obr.player.getColor(),
      ])
      setState({ ready: true, role, playerId: obr.player.id, playerName, playerColor })

      unsubscribeChange = obr.player.onChange((player) => {
        setState((prev) => ({
          ...prev,
          role: player.role,
          playerName: player.name,
          playerColor: player.color,
        }))
      })
    })

    return () => {
      unsubscribeChange?.()
    }
  }, [])

  return state
}
