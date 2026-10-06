// Die shape definitions, ported from threejs-dice by Michael Wolf (MIT; see third_party/threejs-dice).
// A die is a convex polyhedron described by its vertices and its faces; everything else (the
// chamfered mesh, UVs and the physics shape) is generated from this data.

// Width and height of the square texture each face's number is drawn on.
export const TEXTURE_SIZE = 256

// The default look of a die: pale blue-white, with dark navy numbers.
export const DIE_COLOR = '#dcecf8'
export const DIE_NUMBER_COLOR = '#12263a'

// How tall a number is on a die with a numberScale of 1, as a fraction of the requested die size: the
// height of a digit, bottom to top. Digits are about the same physical height on every die, as on real
// dice, with a little give per die (DieShape.numberScale) for faces that are roomy or tight.
export const NUMBER_HEIGHT = 0.44
// A digit's height as a fraction of the font size, measured for Space Grotesk.
export const DIGIT_HEIGHT_RATIO = 0.72

// The font the numbers are drawn in: Space Grotesk, the app's own font, at the weight it loads.
export const DIE_FONT_FAMILY = '"Space Grotesk", Arial, sans-serif'
export const DIE_FONT_WEIGHT = 600

export interface DieShape {
  name: string
  // How many values the die has. Faces are labelled 1..sides (some shapes repeat labels).
  sides: number
  vertices: number[][]
  // Each face is its corner indices in counter-clockwise order seen from outside, followed by its
  // label (1..sides), or -1 for an unlabelled face.
  faces: number[][]
  // Texture mapping tuning: `tab` pads the label's UV rectangle, `af` rotates the label.
  tab: number
  af: number
  // How far each face is pulled in to round the edges (1 = sharp, smaller = rounder).
  chamfer: number
  // Scales the die relative to the requested size so the different shapes look about equally big.
  scale: number
  // How much taller than the standard (NUMBER_HEIGHT) this die's numbers are; 1 if left out. Dice
  // with roomy faces (the d6, d3) can carry bigger numbers than the d24's small faces allow.
  numberScale?: number
  mass: number
  // Padding around the label inside its face texture.
  textMargin: number
  // The d4 shows its number at the top corner, so the value is read from the face on the bottom.
  readsBottom?: boolean
  // d4 only: the three numbers printed on a face, per label offset then per face label.
  cornerLabels?: number[][][]
  // Faces whose numbers may only trade places with each other when a throw is rigged, as lists of
  // base labels. The d5 has one group for its sides and one for its ends, so its ends always show 1
  // and 5. Without this, one group holds every face and the numbers cycle around the whole die.
  groups?: number[][]
  // The number printed on each face before any rigging, by base label (index 0 is label 1).
  // Defaults to 1, 2, 3 ...
  numbers?: number[]
  // How hard the die is thrown compared with the others (1 is normal). More spin and a harder toss
  // for a die that tends to slide and flop instead of rolling.
  throwPower?: number
  // Lets the numbers move between any faces when a throw is rigged (the die is reprinted so the
  // landing face shows the rolled number). Most dice keep their numbers fixed and are thrown until
  // they land right; this is for a die that cannot be steered to every face, like the d7.
  freeNumbers?: boolean
  // How a number is printed (the percentile die prints 10, 20 ... 90 and 00; the units die 0-9).
  labelText?: (value: number) => string
  // Draws a face's texture itself, for dice whose numbers depend on the other faces (the prisms). The
  // context is already filled with the die colour and set up for centred text in the label colour;
  // `shown(label)` is the number currently printed on the face with that base label.
  // `fontPixels` is the font size that makes a digit the standard height on this face.
  drawFace?: (
    context: CanvasRenderingContext2D,
    size: number,
    label: number,
    shown: (label: number) => number,
    fontPixels: number,
  ) => void
}

const PHI = (1 + Math.sqrt(5)) / 2

export const d4: DieShape = {
  name: 'd4',
  sides: 4,
  vertices: [
    [1, 1, 1],
    [-1, -1, 1],
    [-1, 1, -1],
    [1, -1, -1],
  ],
  faces: [
    [1, 0, 2, 1],
    [0, 1, 3, 2],
    [0, 3, 2, 3],
    [1, 2, 3, 4],
  ],
  tab: -0.1,
  af: (Math.PI * 7) / 6,
  chamfer: 0.96,
  // A regular tetrahedron is far taller and broader than other dice of the same radius, so it is
  // scaled down to sit between the d6 and the d20 when it lands.
  scale: 0.95,
  mass: 300,
  textMargin: 1,
  readsBottom: true,
  cornerLabels: [
    [[], [2, 4, 3], [1, 3, 4], [2, 1, 4], [1, 2, 3]],
    [[], [2, 3, 4], [3, 1, 4], [2, 4, 1], [3, 2, 1]],
    [[], [4, 3, 2], [3, 4, 1], [4, 2, 1], [3, 1, 2]],
    [[], [4, 2, 3], [1, 4, 3], [4, 1, 2], [1, 3, 2]],
  ],
}

export const d6: DieShape = {
  name: 'd6',
  sides: 6,
  vertices: [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ],
  faces: [
    [0, 3, 2, 1, 1],
    [1, 2, 6, 5, 2],
    [0, 1, 5, 4, 3],
    [3, 7, 6, 2, 4],
    [0, 4, 7, 3, 5],
    [4, 5, 6, 7, 6],
  ],
  tab: 0.1,
  af: Math.PI / 4,
  chamfer: 0.96,
  scale: 0.9,
  mass: 300,
  textMargin: 1,
}

export const d8: DieShape = {
  name: 'd8',
  sides: 8,
  vertices: [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ],
  faces: [
    [0, 2, 4, 1],
    [0, 4, 3, 2],
    [0, 3, 5, 3],
    [0, 5, 2, 4],
    [1, 3, 4, 5],
    [1, 4, 2, 6],
    [1, 2, 5, 7],
    [1, 5, 3, 8],
  ],
  tab: 0,
  af: -Math.PI / 4 / 2,
  chamfer: 0.965,
  scale: 1,
  mass: 340,
  textMargin: 1.2,
}

const q = 1 / PHI

export const d12: DieShape = {
  name: 'd12',
  sides: 12,
  vertices: [
    [0, q, PHI],
    [0, q, -PHI],
    [0, -q, PHI],
    [0, -q, -PHI],
    [PHI, 0, q],
    [PHI, 0, -q],
    [-PHI, 0, q],
    [-PHI, 0, -q],
    [q, PHI, 0],
    [q, -PHI, 0],
    [-q, PHI, 0],
    [-q, -PHI, 0],
    [1, 1, 1],
    [1, 1, -1],
    [1, -1, 1],
    [1, -1, -1],
    [-1, 1, 1],
    [-1, 1, -1],
    [-1, -1, 1],
    [-1, -1, -1],
  ],
  faces: [
    [2, 14, 4, 12, 0, 1],
    [15, 9, 11, 19, 3, 2],
    [16, 10, 17, 7, 6, 3],
    [6, 7, 19, 11, 18, 4],
    [6, 18, 2, 0, 16, 5],
    [18, 11, 9, 14, 2, 6],
    [1, 17, 10, 8, 13, 7],
    [1, 13, 5, 15, 3, 8],
    [13, 8, 12, 4, 5, 9],
    [5, 4, 14, 9, 15, 10],
    [0, 12, 8, 10, 16, 11],
    [3, 19, 7, 17, 1, 12],
  ],
  tab: 0.2,
  af: -Math.PI / 4 / 2,
  chamfer: 0.968,
  scale: 0.9,
  mass: 350,
  textMargin: 1,
}

export const d20: DieShape = {
  name: 'd20',
  sides: 20,
  vertices: [
    [-1, PHI, 0],
    [1, PHI, 0],
    [-1, -PHI, 0],
    [1, -PHI, 0],
    [0, -1, PHI],
    [0, 1, PHI],
    [0, -1, -PHI],
    [0, 1, -PHI],
    [PHI, 0, -1],
    [PHI, 0, 1],
    [-PHI, 0, -1],
    [-PHI, 0, 1],
  ],
  faces: [
    [0, 11, 5, 1],
    [0, 5, 1, 2],
    [0, 1, 7, 3],
    [0, 7, 10, 4],
    [0, 10, 11, 5],
    [1, 5, 9, 6],
    [5, 11, 4, 7],
    [11, 10, 2, 8],
    [10, 7, 6, 9],
    [7, 1, 8, 10],
    [3, 9, 4, 11],
    [3, 4, 2, 12],
    [3, 2, 6, 13],
    [3, 6, 8, 14],
    [3, 8, 9, 15],
    [4, 9, 5, 16],
    [2, 4, 11, 17],
    [6, 2, 10, 18],
    [8, 6, 7, 19],
    [9, 8, 1, 20],
  ],
  tab: -0.2,
  af: -Math.PI / 4 / 2,
  chamfer: 0.955,
  scale: 1,
  mass: 400,
  textMargin: 1,
}
