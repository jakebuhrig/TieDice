// DCC's full dice set, surfaced as a flat list — no chain-shift logic (see GLOSSARY.md).
export const SUPPORTED_DICE = [3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 30, 100] as const

export type DieSize = (typeof SUPPORTED_DICE)[number]

export interface TrayEntry {
  size: DieSize
  count: number
}

// Ordered by the first click of each die size, e.g. [d20 x1, d3 x1] if d20 was tapped first.
export type Tray = TrayEntry[]

export interface DieResult {
  size: DieSize
  value: number
}

export interface RollRecord {
  id: string
  playerId: string
  playerName: string
  playerColor: string
  dice: DieResult[]
  total: number
  hidden: boolean
  rolledAt: number
}

export function rollDie(size: DieSize): number {
  return Math.floor(Math.random() * size) + 1
}

export function rollTray(tray: Tray): DieResult[] {
  return tray.flatMap(({ size, count }) =>
    Array.from({ length: count }, () => ({ size, value: rollDie(size) })),
  )
}

export function formatRoll(dice: DieResult[]): string {
  const bySize = new Map<DieSize, number[]>()
  for (const die of dice) {
    const values = bySize.get(die.size) ?? []
    values.push(die.value)
    bySize.set(die.size, values)
  }
  return Array.from(bySize.entries())
    .map(([size, values]) => `${values.length}d${size} (${values.join(', ')})`)
    .join(' + ')
}
