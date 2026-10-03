import OBR, { type Metadata, type Player } from '@owlbear-rodeo/sdk'
import { createMockObr } from './mockObr'

// The slice of the OBR SDK this extension uses, so a mock can stand in during local dev.
export interface ObrClient {
  isAvailable: boolean
  onReady(callback: () => void): void
  player: {
    id: string
    getRole(): Promise<Player['role']>
    getName(): Promise<string>
    getColor(): Promise<string>
    onChange(callback: (player: Player) => void): () => void
  }
  room: {
    getMetadata(): Promise<Metadata>
    setMetadata(update: Partial<Metadata>): Promise<void>
    onMetadataChange(callback: (metadata: Metadata) => void): () => void
  }
}

// Outside Owlbear Rodeo, `npm run dev` renders against an in-memory mock. Never in production builds.
export const isMock = import.meta.env.DEV && !OBR.isAvailable
export const obr: ObrClient = isMock ? createMockObr() : OBR
