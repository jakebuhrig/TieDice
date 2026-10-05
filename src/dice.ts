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

// How low and how high a modifier can go. DCC bonuses and penalties are small (ability modifiers
// run -3 to +3), so the penalty side stops at -20, while the bonus side leaves room for big
// stacked bonuses such as burned Luck.
export const MIN_MODIFIER = -20
export const MAX_MODIFIER = 99

export interface RollRecord {
  id: string
  playerId: string
  playerName: string
  playerColor: string
  dice: DieResult[]
  // Flat amount added to (or, when negative, taken from) the dice total. Absent on rolls saved
  // before modifiers existed, which count as 0.
  modifier?: number
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

export function rollTotal(dice: DieResult[], modifier = 0): number {
  // Not floored: 1d6 (3) with a -7 modifier really is -4.
  return dice.reduce((sum, die) => sum + die.value, 0) + modifier
}

// "+3", "-3", or "0": how the modifier control shows its value.
export function formatModifier(modifier: number): string {
  return modifier > 0 ? `+${modifier}` : String(modifier)
}

// "1d6 (6) - 3": the dice grouped by size, then the modifier when there is one.
export function formatRoll(dice: DieResult[], modifier = 0): string {
  const bySize = new Map<DieSize, number[]>()
  for (const die of dice) {
    const values = bySize.get(die.size) ?? []
    values.push(die.value)
    bySize.set(die.size, values)
  }
  const diceText = Array.from(bySize.entries())
    .map(([size, values]) => `${values.length}d${size} (${values.join(', ')})`)
    .join(' + ')
  if (modifier === 0) return diceText
  return `${diceText} ${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)}`
}

// Lowest and highest totals this roll could have produced; the reveal animation flickers within it.
export function totalRange(dice: DieResult[], modifier = 0): { min: number; max: number } {
  return {
    min: dice.length + modifier,
    max: dice.reduce((sum, die) => sum + die.size, 0) + modifier,
  }
}
