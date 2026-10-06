import * as THREE from 'three'
import { hullPolygons } from './hull'
import { d6, DIE_FONT_FAMILY, DIE_FONT_WEIGHT, type DieShape } from './shapes'
import { fillTextCentered } from './text'

// The dice the original library does not have. Four are built from vertex coordinates alone (the
// faces come from a convex hull). The d3 and d7 reuse another die's shape with repeated numbers, as
// they are often rolled at the table (a d6 for a d3, a d14 for a d7), and the d5 is a triangular prism.

const PHI = (1 + Math.sqrt(5)) / 2
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

interface PolyhedronOptions {
  name: string
  vertices: THREE.Vector3[]
  // Which corner a face's label points toward; the highest score becomes the face's first corner.
  startScore?: (v: THREE.Vector3) => number
  // Shift the shape so its centre of mass is at the origin. Needed for shapes that are not
  // symmetric about their middle, so the die tumbles about the right point.
  centre?: boolean
  tab: number
  af: number
  chamfer: number
  scale: number
  mass: number
  textMargin: number
}

// Moves the points so the centre of mass of the solid they enclose (even density) is the origin.
function centredOnMass(points: THREE.Vector3[]): THREE.Vector3[] {
  const reference = points.reduce((sum, v) => sum.add(v), V(0, 0, 0)).divideScalar(points.length)
  const mass = V(0, 0, 0)
  let volume = 0
  for (const corners of hullPolygons(points)) {
    // Split each face into triangles and each triangle with the reference point into a tetrahedron.
    for (let k = 1; k < corners.length - 1; k++) {
      const a = points[corners[0]].clone().sub(reference)
      const b = points[corners[k]].clone().sub(reference)
      const c = points[corners[k + 1]].clone().sub(reference)
      const v = Math.abs(a.dot(b.clone().cross(c))) / 6
      volume += v
      mass.addScaledVector(a.clone().add(b).add(c).divideScalar(4).add(reference), v)
    }
  }
  const centre = mass.divideScalar(volume)
  return points.map((v) => v.clone().sub(centre))
}

// Builds a die whose faces are numbered 1..n so that opposite faces add up to n + 1, like a real die.
function polyhedron(options: PolyhedronOptions): DieShape {
  const { startScore = (v) => v.length() } = options
  const vertices = options.centre ? centredOnMass(options.vertices) : options.vertices
  const polygons = hullPolygons(vertices).map((corners) => {
    const first = corners.reduce((best, c) => (startScore(vertices[c]) > startScore(vertices[best]) ? c : best))
    const at = corners.indexOf(first)
    return [...corners.slice(at), ...corners.slice(0, at)]
  })
  const sides = polygons.length

  const centres = polygons.map((corners) => {
    const centre = V(0, 0, 0)
    corners.forEach((c) => centre.add(vertices[c]))
    return centre.divideScalar(corners.length)
  })

  // Number the faces from the top down, and give each face's opposite its complement.
  const order = centres
    .map((centre, i) => ({ i, centre }))
    .sort((a, b) => b.centre.z - a.centre.z || Math.atan2(a.centre.y, a.centre.x) - Math.atan2(b.centre.y, b.centre.x))
  const labels = new Array<number>(sides).fill(0)
  let next = 1
  for (const { i, centre } of order) {
    if (labels[i]) continue
    labels[i] = next
    const opposite = centres.findIndex((c) => c.distanceTo(centre.clone().negate()) < 1e-4)
    if (opposite >= 0) labels[opposite] = sides + 1 - next
    next++
  }

  return {
    name: options.name,
    sides,
    vertices: vertices.map((v) => v.toArray()),
    faces: polygons.map((corners, i) => [...corners, labels[i]]),
    tab: options.tab,
    af: options.af,
    chamfer: options.chamfer,
    scale: options.scale,
    mass: options.mass,
    textMargin: options.textMargin,
  }
}

// A trapezohedron with n kites on each half: the d10 (n = 5) and d14 (n = 7) family. The ring of
// corners has radius 1 and the two points sit at +/- `pointHeight`; a taller point makes a longer,
// pointier die. The zigzag height around the middle is the one that makes every kite flat.
function trapezohedronVertices(n: number, pointHeight = 1): THREE.Vector3[] {
  const step = Math.PI / n
  const zig = (pointHeight * (1 - Math.cos(step))) / (1 + Math.cos(step))
  const points: THREE.Vector3[] = []
  for (let k = 0; k < 2 * n; k++) {
    points.push(V(Math.cos(k * step), Math.sin(k * step), (k % 2 ? 1 : -1) * zig))
  }
  points.push(V(0, 0, -pointHeight), V(0, 0, pointHeight))
  return points
}

// The d16: sixteen pentagons of exactly equal area, with the four-fold symmetry of a squashed
// antiprism. The solid is everything on the inner side of 16 planes: two rings of eight, A at a
// support distance of 1 and B at `ringBDistance`. Each ring has four faces tilted a fixed angle from
// the top and four from the bottom, the bottom ones turned an eighth of a turn. Found by searching
// every combination of the two tilts for the equal-area solid with the roundest shape (a sphericity
// of 0.93; a sphere is 1): tilts of 38 and 78 degrees, with ring B at 0.9876.
//
// No face has an exact opposite, so a die resting on a face has a ridge (two faces tied) on top;
// Die.upFace settles such ties by handedness so every face can be the one that is read.
function d16Vertices(): THREE.Vector3[] {
  const tiltA = (38 * Math.PI) / 180
  const tiltB = (78 * Math.PI) / 180
  const ringBDistance = 0.9876

  const normals: THREE.Vector3[] = []
  const distances: number[] = []
  const ring = (tilt: number, turn: number, distance: number, bottom: boolean) => {
    for (let k = 0; k < 4; k++) {
      const azimuth = turn + (k * Math.PI) / 2
      normals.push(
        V(Math.sin(tilt) * Math.cos(azimuth), Math.sin(tilt) * Math.sin(azimuth), (bottom ? -1 : 1) * Math.cos(tilt)),
      )
      distances.push(distance)
    }
  }
  ring(tiltA, 0, 1, false)
  ring(tiltA, Math.PI / 4, 1, true)
  ring(tiltB, Math.PI / 4, ringBDistance, false)
  ring(tiltB, 0, ringBDistance, true)

  // Each vertex is where three planes meet and every other plane is on the same side.
  const vertices: THREE.Vector3[] = []
  for (let i = 0; i < normals.length; i++) {
    for (let j = i + 1; j < normals.length; j++) {
      for (let k = j + 1; k < normals.length; k++) {
        const bc = normals[j].clone().cross(normals[k])
        const determinant = normals[i].dot(bc)
        if (Math.abs(determinant) < 1e-9) continue
        const ca = normals[k].clone().cross(normals[i])
        const ab = normals[i].clone().cross(normals[j])
        const point = bc
          .multiplyScalar(distances[i])
          .addScaledVector(ca, distances[j])
          .addScaledVector(ab, distances[k])
          .divideScalar(determinant)
        const inside = normals.every((n, m) => n.dot(point) <= distances[m] + 1e-7)
        if (inside && !vertices.some((v) => v.distanceTo(point) < 1e-6)) vertices.push(point)
      }
    }
  }
  return vertices
}

// Deltoidal icositetrahedron: 6 axis points, 12 edge-midpoint points and 8 cube corners. The edge
// points sit at sqrt(2) and the corners at `corner` (1 for the classic shape, with its sharp axis
// points). The axis distance that keeps every kite flat follows from those two (1 + sqrt(2) for the
// classic shape); a bigger corner pulls the axis points in, which gives a rounder die with blunter
// points. At 1.13 the axis points, edge points and corners are all about the same distance from the
// centre, so the die is close to a ball.
function d24Vertices(corner: number): THREE.Vector3[] {
  const edge = Math.SQRT2
  const ratio = (2 * corner - edge) / (edge - corner)
  const axis = ((ratio + 1) * edge) / ratio
  const points: THREE.Vector3[] = []
  for (const s of [-1, 1]) points.push(V(s * axis, 0, 0), V(0, s * axis, 0), V(0, 0, s * axis))
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) points.push(V(x * corner, y * corner, z * corner))
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) points.push(V(a * edge, b * edge, 0), V(a * edge, 0, b * edge), V(0, a * edge, b * edge))
  }
  return points
}

// The d7 is a Chestahedron: seven faces on seven vertices, four equilateral triangles and three kites,
// all with exactly the same area. One triangle is the base; three more rise from its edges to a ring
// of three vertices; and the three kites meet at a point above.
//
// Take the base side as 1 and put its three corners at distance R from the axis. The ring sits at
// height h with radius r, and the apex at height a. Three conditions fix r, h and a:
//   - the kites are flat:      r = 2R (1 - h / a)
//   - the kites have the same area as an equilateral triangle of side 1, (sqrt(3) / 4):
//                              r * sqrt(R^2 + a^2) = 1 / 2
//   - the three rising triangles are equilateral: each ring vertex is 1 from the two base corners it
//     sits over:               r^2 - r R + R^2 + h^2 = 1
// Substituting the first two leaves one equation in r, solved here by bisection.
function d7Vertices(): THREE.Vector3[] {
  const R = 1 / Math.sqrt(3)
  const at = (r: number) => {
    const apex = Math.sqrt(1 / (4 * r * r) - R * R)
    const ringHeight = apex * (1 - r / (2 * R))
    return { apex, ringHeight, miss: r * r - r * R + R * R + ringHeight * ringHeight - 1 }
  }

  let low = 0.3
  let high = 0.4
  const lowSign = Math.sign(at(low).miss)
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2
    if (Math.sign(at(mid).miss) === lowSign) low = mid
    else high = mid
  }
  const ringRadius = (low + high) / 2
  const { apex, ringHeight } = at(ringRadius)

  const ring = (radius: number, height: number, degrees: number[]) =>
    degrees.map((d) => {
      const angle = (d * Math.PI) / 180
      return V(radius * Math.cos(angle), radius * Math.sin(angle), height)
    })
  return [
    V(0, 0, apex),
    ...ring(R, 0, [90, 210, 330]),
    ...ring(ringRadius, ringHeight, [150, 270, 30]),
  ]
}

// Rhombic triacontahedron: the 20 corners of a dodecahedron plus the 12 of an icosahedron.
function d30Vertices(): THREE.Vector3[] {
  const points: THREE.Vector3[] = []
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) points.push(V(x, y, z))
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) {
      points.push(V(0, a / PHI, b * PHI), V(a / PHI, b * PHI, 0), V(a * PHI, 0, b / PHI))
      points.push(V(0, a * PHI, b), V(a * PHI, b, 0), V(a, 0, b * PHI))
    }
  }
  return points
}

// Ten kites (a pentagonal trapezohedron), numbered 1-10 with opposite faces adding up to 11.
export const d10 = polyhedron({
  name: 'd10',
  vertices: trapezohedronVertices(5),
  startScore: (v) => Math.abs(v.z),
  tab: 0,
  af: Math.PI / 2,
  chamfer: 0.945,
  scale: 0.9,
  mass: 350,
  textMargin: 1,
})

// Fourteen kites (a heptagonal trapezohedron), numbered 1-14 with opposite faces adding up to 15.
// `pointHeight` is how far the two points are from the middle, compared with the radius of the ring.
export function d14WithPointHeight(pointHeight: number, scale = 0.9): DieShape {
  return polyhedron({
    name: 'd14',
    vertices: trapezohedronVertices(7, pointHeight),
    startScore: (v) => Math.abs(v.z),
    tab: 0,
    af: Math.PI / 2,
    chamfer: 0.95,
    scale,
    mass: 350,
    textMargin: 1,
  })
}

// Scaled so the ring around its middle is as wide as it was when the points were shorter.
export const d14 = d14WithPointHeight(1.2, 1.08)

export const d16 = polyhedron({
  name: 'd16',
  vertices: d16Vertices(),
  tab: 0,
  af: Math.PI / 2,
  chamfer: 0.95,
  scale: 0.9,
  mass: 350,
  textMargin: 1,
})

export const d24 = polyhedron({
  name: 'd24',
  vertices: d24Vertices(1.13),
  tab: 0,
  af: Math.PI / 2,
  // Soft, rounded edges and a size close to the d20, like the dice people actually buy.
  chamfer: 0.88,
  scale: 0.95,
  mass: 380,
  textMargin: 1,
})


export const d30 = polyhedron({
  name: 'd30',
  vertices: d30Vertices(),
  tab: 0,
  af: Math.PI / 2,
  chamfer: 0.95,
  scale: 0.85,
  mass: 400,
  textMargin: 1,
})

// The same shape and layout as `base`, with every number replaced by its place in a shorter
// cycle, so each number appears on more than one face.
function repeated(base: DieShape, name: string, sides: number, label = (l: number) => ((l - 1) % sides) + 1): DieShape {
  return {
    ...base,
    name,
    sides,
    faces: base.faces.map((f) => {
      const l = f[f.length - 1]
      return l > 0 ? [...f.slice(0, -1), label(l)] : f
    }),
  }
}

// A cube numbered 1-3, with each number on a pair of opposite faces.
export const d3 = repeated(d6, 'd3', 3, (l) => [1, 2, 3, 3, 2, 1][l - 1])
// A prism: n rectangular faces (base labels 1..n, face m between corners m and m + 1 of the n-gon) and
// two n-gon ends (labels n + 1 and n + 2). A prism lying on a rectangle has a ridge on top, not a
// face, so like a d4 it is read from the face on the bottom: the other faces repeat that number near
// the top, and the end on top repeats the number of the end underneath.
//
// `length` is how long the prism is compared with the width of its rectangles: 1 makes them square and
// less makes a thinner prism with bigger ends. `numbers` is what each face shows, rectangles first then
// the two ends. The numbers never move: the roll throws the die (steering it by symmetry) until it
// lands on the face that carries the rolled number.
function prismShape(
  name: string,
  n: number,
  scale: number,
  length: number,
  numbers: number[],
  throwPower = 1,
): DieShape {
  const radius = 1
  const halfLength = Math.sin(Math.PI / n) * radius * length
  const ring = (z: number) =>
    Array.from({ length: n }, (_, k) => {
      const angle = Math.PI / 2 + (k * 2 * Math.PI) / n
      return [radius * Math.cos(angle), radius * Math.sin(angle), z]
    })

  const rectangles = Array.from({ length: n }, (_, m) => [m, (m + 1) % n, n + ((m + 1) % n), n + m, m + 1])
  // Counter-clockwise seen from outside: the bottom end is seen from below, so its order is reversed.
  const bottom = [0, ...Array.from({ length: n - 1 }, (_, k) => n - 1 - k), n + 1]
  const top = [...Array.from({ length: n }, (_, k) => n + k), n + 2]

  return {
    name,
    sides: n + 2,
    vertices: [...ring(-halfLength), ...ring(halfLength)],
    faces: [...rectangles, bottom, top],
    tab: 0,
    af: Math.PI / 4,
    chamfer: 0.86,
    scale,
    mass: 330,
    textMargin: 1,
    readsBottom: true,
    // The end that prints the biggest number (an end prints the number of the end opposite it).
    previewFace: { label: n + 1 },
    numbers,
    throwPower,
    drawFace: (context, size, label, shown, fontPixels) => {
      if (label > n) {
        // An end repeats the number of the end opposite it, which is the one on the bottom when
        // this end is on top. It is big and centred.
        context.font = `${DIE_FONT_WEIGHT} ${fontPixels}px ${DIE_FONT_FAMILY}`
        fillTextCentered(context, String(shown(label === n + 1 ? n + 2 : n + 1)), size / 2, size / 2)
        return
      }

      // A rectangle shows, along each long edge, the number of the rectangle that makes this edge
      // the top ridge when the die lies on it. The numbers are centred along their edges.
      const i = label - 1
      // The face texture is stretched along the prism, so the drawing is squeezed by the same amount
      // to keep the digits their normal shape.
      context.save()
      context.translate(size / 2, size / 2)
      context.scale(1, 1 / length)
      context.translate(-size / 2, -size / 2)
      const wrapLabel = (offset: number) => ((((i - offset) % n) + n) % n) + 1
      context.font = `${DIE_FONT_WEIGHT} ${fontPixels}px ${DIE_FONT_FAMILY}`
      context.save()
      context.translate(size * 0.33, size / 2)
      context.rotate(-Math.PI / 2)
      fillTextCentered(context, String(shown(wrapLabel((n - 1) / 2))), 0, 0)
      context.restore()
      context.save()
      context.translate(size * 0.67, size / 2)
      context.rotate(Math.PI / 2)
      fillTextCentered(context, String(shown(wrapLabel((n + 1) / 2))), 0, 0)
      context.restore()
      context.restore()
    },
  }
}

// A triangular prism with 1 and 5 on its ends and 2-4 on its sides.
// It is thin, so it tends to slide and flop: it is thrown harder and spun faster than the others.
export const d5 = prismShape('d5', 3, 0.85, 0.5, [2, 3, 4, 1, 5], 1.6)

// The seven-faced die: a Chestahedron numbered 1-7. It stands on a face and the number on top is read;
// when it rests on its triangular base the top is a point shared by three faces, so one of those
// three is the result.
export const d7: DieShape = {
  ...polyhedron({
    name: 'd7',
    vertices: d7Vertices(),
    centre: true,
    tab: 0,
    af: Math.PI / 2,
    chamfer: 0.93,
    scale: 0.85,
    mass: 330,
    textMargin: 1,
  }),
  // Its faces are not interchangeable (three kinds of face, no rotation turns a kite into a triangle),
  // and the base triangle never ends up on top. So no throw can show every number from a fixed
  // layout, and its numbers cycle around to match the roll instead.
  freeNumbers: true,
}

// The d100 is two ten-sided dice: one printed 00-90 and one printed 0-9.
export const d10Percentile: DieShape = {
  ...d10,
  name: 'd10 percentile',
  labelText: (value) => String((value % 10) * 10).padStart(2, '0'),
}
export const d10Units: DieShape = {
  ...d10,
  name: 'd10 units',
  labelText: (value) => String(value % 10),
}
