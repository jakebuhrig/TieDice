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

// Uniform integer in [0, max) from the browser's cryptographic random source. Values from the
// uneven tail of the 32-bit range are rejected and redrawn so no face is ever favored.
function randomInt(max: number): number {
  const limit = 2 ** 32 - (2 ** 32 % max)
  const buffer = new Uint32Array(1)
  do {
    crypto.getRandomValues(buffer)
  } while (buffer[0] >= limit)
  return buffer[0] % max
}

export function rollDie(size: DieSize): number {
  return randomInt(size) + 1
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

// Lowest and highest totals this roll could have produced; the reveal animation flickers within it.
export function totalRange(dice: DieResult[]): { min: number; max: number } {
  return { min: dice.length, max: dice.reduce((sum, die) => sum + die.size, 0) }
}
