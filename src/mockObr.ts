import type { Metadata, Player } from '@owlbear-rodeo/sdk'
import { MAX_HISTORY, ROLL_HISTORY_KEY } from './constants'
import { rollTray, type RollRecord } from './dice'
import type { ObrClient } from './obr'

// Dev-only stand-in for the Owlbear Rodeo SDK so the UI can be previewed outside OBR.
type Role = Player['role']

const params = new URLSearchParams(window.location.search)
let role: Role = params.get('role')?.toUpperCase() === 'PLAYER' ? 'PLAYER' : 'GM'
const name = params.get('name') ?? 'You'
const color = '#7ab8ff'

let metadata: Metadata = {}
const playerListeners = new Set<(player: Player) => void>()
const metadataListeners = new Set<(metadata: Metadata) => void>()

function currentPlayer(): Player {
  return { id: 'mock-me', role, name, color } as unknown as Player
}

export const mockControls = {
  getRole: (): Role => role,
  setRole(next: Role) {
    role = next
    playerListeners.forEach((listener) => listener(currentPlayer()))
  },
  simulateOtherPlayerRoll() {
    const dice = rollTray([
      { size: 20, count: 1 },
      { size: 8, count: 1 },
    ])
    const record: RollRecord = {
      id: crypto.randomUUID(),
      playerId: 'mock-alice',
      playerName: 'Alice',
      playerColor: '#ff8a7a',
      dice,
      total: dice.reduce((sum, d) => sum + d.value, 0),
      hidden: false,
      rolledAt: Date.now(),
    }
    const current = (metadata[ROLL_HISTORY_KEY] as RollRecord[] | undefined) ?? []
    metadata = { ...metadata, [ROLL_HISTORY_KEY]: [...current, record].slice(-MAX_HISTORY) }
    metadataListeners.forEach((listener) => listener(metadata))
  },
}

export function createMockObr(): ObrClient {
  return {
    isAvailable: true,
    onReady: (callback) => {
      queueMicrotask(callback)
    },
    player: {
      id: 'mock-me',
      getRole: async () => role,
      getName: async () => name,
      getColor: async () => color,
      onChange: (callback) => {
        playerListeners.add(callback)
        return () => playerListeners.delete(callback)
      },
    },
    room: {
      getMetadata: async () => ({ ...metadata }),
      setMetadata: async (update) => {
        metadata = { ...metadata, ...update }
        metadataListeners.forEach((listener) => listener(metadata))
      },
      onMetadataChange: (callback) => {
        metadataListeners.add(callback)
        return () => metadataListeners.delete(callback)
      },
    },
  }
}
