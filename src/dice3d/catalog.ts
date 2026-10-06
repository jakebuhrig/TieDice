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
// full DCC set. `scale` sizes the die (1 is the d20); the d24 and d30 run bigger, as on real dice, and
// the cubes (d3, d6) are sized up to match the d20 because a cube looks small at the same width.
// `numberScale` adjusts a die's digit height from the standard (NUMBER_HEIGHT).
const LOOK: Record<string, { scale: number; numberScale: number }> = {
  d3: { scale: 1.1, numberScale: 1.25 },
  d4: { scale: 1.19, numberScale: 1 },
  d5: { scale: 1.12, numberScale: 1 },
  d6: { scale: 1.1, numberScale: 1.25 },
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

// The colour of each kind of die and of its numbers, like an old-school set where every die in the
// bag is a different colour. The d20 keeps the pale blue-white the dice started with. Dark numbers go
// on light dice and white numbers on dark ones.
export const DIE_COLORS: Record<string, { backColor: string; fontColor: string }> = {
  d3: { backColor: '#e5484d', fontColor: '#ffffff' },
  d4: { backColor: '#ff9f43', fontColor: '#2b1700' },
  d5: { backColor: '#ffd84a', fontColor: '#2b2300' },
  d6: { backColor: '#8ddf5c', fontColor: '#0f2a05' },
  d7: { backColor: '#1fb5a3', fontColor: '#ffffff' },
  d8: { backColor: '#58b4ff', fontColor: '#06233f' },
  d10: { backColor: '#3d5bdb', fontColor: '#ffffff' },
  d12: { backColor: '#8f5cf5', fontColor: '#ffffff' },
  d14: { backColor: '#d946ef', fontColor: '#ffffff' },
  d16: { backColor: '#ff7eb0', fontColor: '#3a0820' },
  d20: { backColor: '#dcecf8', fontColor: '#12263a' },
  d24: { backColor: '#ff6b4a', fontColor: '#ffffff' },
  d30: { backColor: '#e0b73a', fontColor: '#2b2200' },
  d100: { backColor: '#2dd4bf', fontColor: '#04302a' },
}

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
