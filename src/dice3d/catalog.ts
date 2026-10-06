import { d10, d10Percentile, d10Units, d14, d16, d24, d3, d30, d5, d7 } from './extraShapes'
import { d12, d20, d4, d6, d8, type DieShape } from './shapes'

const BASE_SHAPES: Record<string, DieShape> = {
  d3,
  d4,
  d5,
  d6,
  d7,
  d8,
  d10,
  d12,
  d14,
  d16,
  d20,
  d24,
  d30,
  'd10 percentile': d10Percentile,
  'd10 units': d10Units,
}

// How big each die is next to the others, and how big its numbers are, set by eye against a photo of a
// full DCC set. `scale` sizes the die (1 is the d20; the d24 and d30 run bigger and the d3 and d6
// smaller, as on real dice); `numberScale` adjusts its digit height from the standard (NUMBER_HEIGHT).
const LOOK: Record<string, { scale: number; numberScale: number }> = {
  d3: { scale: 0.83, numberScale: 1.25 },
  d4: { scale: 1.19, numberScale: 1 },
  d5: { scale: 1.12, numberScale: 1 },
  d6: { scale: 0.95, numberScale: 1.25 },
  d7: { scale: 1.32, numberScale: 1 },
  d8: { scale: 1.17, numberScale: 1.05 },
  d10: { scale: 1.19, numberScale: 1.1 },
  d12: { scale: 1.03, numberScale: 1.25 },
  d14: { scale: 1.25, numberScale: 0.85 },
  d16: { scale: 1, numberScale: 0.88 },
  d20: { scale: 1, numberScale: 0.85 },
  d24: { scale: 1.33, numberScale: 0.85 },
  d30: { scale: 1.53, numberScale: 0.85 },
}
// The d100's two dice are d10s, so they are exactly the d10's size; their numbers (two digits on the
// percentile die) are the same size as the d20's.
LOOK['d10 percentile'] = { ...LOOK.d10, numberScale: LOOK.d20.numberScale }
LOOK['d10 units'] = LOOK['d10 percentile']

// Every shape the 3D roller can draw, by name.
export const SHAPES: Record<string, DieShape> = Object.fromEntries(
  Object.entries(BASE_SHAPES).map(([name, shape]) => [
    name,
    { ...shape, ...LOOK[name] },
  ]),
)

// Something that can be rolled for a result between 1 and `sides`. Most are one die; the d100 is two.
export interface Rollable {
  sides: number
  // Which shapes make it up.
  shapes: string[]
  // The value each die must show for a given result.
  split: (result: number) => number[]
  // The result a set of resting dice shows.
  join: (values: number[]) => number
}

const single = (name: string): Rollable => ({
  sides: SHAPES[name].sides,
  shapes: [name],
  split: (result) => [result],
  join: (values) => values[0],
})

// Percentile dice read as tens plus units, with 00 and 0 together meaning 100. On the dice, a value
// of 10 stands for 0, so the tens die shows 00 and the units die shows 0.
const d100: Rollable = {
  sides: 100,
  shapes: ['d10 percentile', 'd10 units'],
  split: (result) => {
    const tens = Math.floor(result / 10) % 10
    const units = result % 10
    return [tens === 0 ? 10 : tens, units === 0 ? 10 : units]
  },
  join: ([tens, units]) => {
    const total = (tens % 10) * 10 + (units % 10)
    return total === 0 ? 100 : total
  },
}

export const ROLLABLES: Record<string, Rollable> = {
  d3: single('d3'),
  d4: single('d4'),
  d5: single('d5'),
  d6: single('d6'),
  d7: single('d7'),
  d8: single('d8'),
  d10: single('d10'),
  d12: single('d12'),
  d14: single('d14'),
  d16: single('d16'),
  d20: single('d20'),
  d24: single('d24'),
  d30: single('d30'),
  d100,
}
