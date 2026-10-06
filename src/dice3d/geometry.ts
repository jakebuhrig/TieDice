import * as THREE from 'three'
import { TEXTURE_SIZE, type DieShape } from './shapes'

// Geometry generation, ported from threejs-dice by Michael Wolf (MIT; see third_party/threejs-dice).
// The chamfer step is rewritten so it works for any convex polyhedron centred on the origin: edge and
// corner pieces are ordered by geometry instead of by tracing face adjacency, which the original
// only got right for corners of three to five faces.

export interface FaceInfo {
  label: number
  // Outward unit normal, before any rotation.
  normal: THREE.Vector3
  // The face's corners (on the unit sphere), in order.
  corners: THREE.Vector3[]
}

export interface DieGeometry {
  geometry: THREE.BufferGeometry
  // One entry per labelled face of the physics shape, used to read which face is up.
  faces: FaceInfo[]
  // The die's vertices scaled onto the unit sphere.
  unitVertices: THREE.Vector3[]
  // For each face label, how much of the die's surface one pixel of the face's texture covers, in
  // world units. Lets numbers be drawn at the same physical size on every face of every die.
  texelByLabel: Map<number, number>
  // Unit-sphere vertices and face loops (labels stripped) for the physics shape.
  physicsVertices: THREE.Vector3[]
  physicsFaces: number[][]
}

interface Polygon {
  corners: number[]
  label: number
}

// Reverses the corner order if the polygon winds clockwise seen from outside (the polyhedron is
// centred on the origin, so "outside" is the direction of the polygon's centre).
function windOutward(points: THREE.Vector3[], corners: number[]): number[] {
  const centre = new THREE.Vector3()
  corners.forEach((c) => centre.add(points[c]))
  centre.divideScalar(corners.length)
  const normal = new THREE.Vector3()
    .subVectors(points[corners[1]], points[corners[0]])
    .cross(new THREE.Vector3().subVectors(points[corners[2]], points[corners[0]]))
  return normal.dot(centre) < 0 ? [...corners].reverse() : corners
}

function chamfered(points: THREE.Vector3[], faces: Polygon[], chamfer: number) {
  const vectors: THREE.Vector3[] = []
  const polygons: Polygon[] = []
  // For each original vertex, the chamfered vertices that were created for it (one per face).
  const cornerVertices: number[][] = points.map(() => [])
  // For each face, original vertex index -> chamfered vertex index.
  const faceLookup: Map<number, number>[] = []

  faces.forEach((face) => {
    const centre = new THREE.Vector3()
    face.corners.forEach((c) => centre.add(points[c]))
    centre.divideScalar(face.corners.length)

    const lookup = new Map<number, number>()
    const corners = face.corners.map((c) => {
      // Pull each corner toward the face centre, which shrinks the face and opens room for the bevel.
      const v = points[c].clone().sub(centre).multiplyScalar(chamfer).add(centre)
      const index = vectors.push(v) - 1
      cornerVertices[c].push(index)
      lookup.set(c, index)
      return index
    })
    faceLookup.push(lookup)
    polygons.push({ corners, label: face.label })
  })

  // Edge pieces: a quad bridging each pair of faces that share an edge.
  for (let i = 0; i < faces.length - 1; i++) {
    for (let j = i + 1; j < faces.length; j++) {
      const shared = faces[i].corners.filter((c) => faces[j].corners.includes(c))
      if (shared.length !== 2) continue
      const [a, b] = shared
      const quad = [
        faceLookup[i].get(a)!,
        faceLookup[i].get(b)!,
        faceLookup[j].get(b)!,
        faceLookup[j].get(a)!,
      ]
      polygons.push({ corners: windOutward(vectors, quad), label: -1 })
    }
  }

  // Corner pieces: the small polygon filling the gap around each original vertex.
  points.forEach((point, v) => {
    const around = cornerVertices[v]
    if (around.length < 3) return
    const axis = point.clone().normalize()
    const helper = Math.abs(axis.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
    const u = helper.clone().cross(axis).normalize()
    const w = axis.clone().cross(u)
    const angle = (index: number) => {
      const d = vectors[index].clone().sub(point)
      return Math.atan2(d.dot(w), d.dot(u))
    }
    const ordered = [...around].sort((p, r) => angle(p) - angle(r))
    polygons.push({ corners: windOutward(vectors, ordered), label: -1 })
  })

  return { vectors, polygons }
}

// Turns a point on a face into texture coordinates, with the middle of the face at the middle of the
// texture. The face's first corner sits at angle `af` and the farthest corner at the texture's edge.
function faceProjector(corners: THREE.Vector3[], shape: DieShape) {
  const centre = new THREE.Vector3()
  corners.forEach((c) => centre.add(c))
  centre.divideScalar(corners.length)
  const normal = new THREE.Vector3()
    .subVectors(corners[1], corners[0])
    .cross(new THREE.Vector3().subVectors(corners[2], corners[0]))
    .normalize()
  const along = new THREE.Vector3().subVectors(corners[0], centre).normalize()
  const across = new THREE.Vector3().crossVectors(normal, along)
  const reach = Math.max(...corners.map((c) => c.distanceTo(centre)))
  const cos = Math.cos(shape.af)
  const sin = Math.sin(shape.af)

  return (point: THREE.Vector3): number[] => {
    const d = new THREE.Vector3().subVectors(point, centre)
    const x = d.dot(along) / reach
    const y = d.dot(across) / reach
    const rx = x * cos - y * sin
    const ry = x * sin + y * cos
    return [(rx + 1 + shape.tab) / 2 / (1 + shape.tab), (ry + 1 + shape.tab) / 2 / (1 + shape.tab)]
  }
}

export function buildDieGeometry(shape: DieShape, radius: number): DieGeometry {
  // Scale so the farthest vertex sits on the unit sphere. (Upstream normalised every vertex, which
  // bends faces that are only planar in the original coordinates.)
  const raw = shape.vertices.map((v) => new THREE.Vector3(v[0], v[1], v[2]))
  const farthest = Math.max(...raw.map((v) => v.length()))
  const points = raw.map((v) => v.clone().divideScalar(farthest))

  const faces: Polygon[] = shape.faces.map((f) => ({
    corners: windOutward(points, f.slice(0, -1)),
    label: f[f.length - 1],
  }))

  const { vectors, polygons } = chamfered(points, faces, shape.chamfer)

  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const geometry = new THREE.BufferGeometry()
  const ab = new THREE.Vector3()
  const cb = new THREE.Vector3()
  const scaled = vectors.map((v) => v.clone().multiplyScalar(radius))
  const texelByLabel = new Map<number, number>()
  let triangleStart = 0

  polygons.forEach((polygon) => {
    const { corners, label } = polygon
    const n = corners.length
    const step = (Math.PI * 2) / n
    const fromAngle = (angle: number) => [
      (Math.cos(angle) + 1 + shape.tab) / 2 / (1 + shape.tab),
      (Math.sin(angle) + 1 + shape.tab) / 2 / (1 + shape.tab),
    ]
    // Faces that carry a number are mapped from their real outline, so the middle of the texture is
    // the middle of the face even for kites and rhombi. (The prisms draw their own faces for a
    // regular-polygon mapping.) Everything else keeps the original regular-polygon mapping.
    const project = label > 0 && !shape.drawFace ? faceProjector(corners.map((c) => scaled[c]), shape) : null

    if (label > 0 && !texelByLabel.has(label)) {
      // World distance between two corners of the face, over the distance between where those corners
      // land in the texture: the size of one texture pixel on the die.
      const first = scaled[corners[0]]
      const second = scaled[corners[1]]
      const [u0, v0] = project ? project(first) : fromAngle(shape.af)
      const [u1, v1] = project ? project(second) : fromAngle(step + shape.af)
      texelByLabel.set(label, first.distanceTo(second) / (TEXTURE_SIZE * Math.hypot(u1 - u0, v1 - v0)))
    }

    for (let j = 0; j < n - 2; j++) {
      const a = scaled[corners[0]]
      const b = scaled[corners[j + 1]]
      const c = scaled[corners[j + 2]]
      positions.push(...a.toArray(), ...b.toArray(), ...c.toArray())

      // Flat normal for the triangle (counter-clockwise from outside).
      cb.subVectors(c, b)
      ab.subVectors(a, b)
      cb.cross(ab).normalize()
      normals.push(...cb.toArray(), ...cb.toArray(), ...cb.toArray())

      if (project) {
        uvs.push(...project(a), ...project(b), ...project(c))
      } else {
        uvs.push(
          ...fromAngle(shape.af),
          ...fromAngle(step * (j + 1) + shape.af),
          ...fromAngle(step * (j + 2) + shape.af),
        )
      }
    }

    // One material group per polygon: unlabelled pieces use material 0, labelled faces their label.
    const vertexCount = (n - 2) * 3
    geometry.addGroup(triangleStart, vertexCount, label > 0 ? label : 0)
    triangleStart += vertexCount
  })

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius)

  const faceInfo: FaceInfo[] = faces
    .filter((f) => f.label > 0)
    .map((f) => {
      const normal = new THREE.Vector3()
        .subVectors(points[f.corners[1]], points[f.corners[0]])
        .cross(new THREE.Vector3().subVectors(points[f.corners[2]], points[f.corners[0]]))
        .normalize()
      return { label: f.label, normal, corners: f.corners.map((c) => points[c].clone()) }
    })

  return {
    geometry,
    faces: faceInfo,
    unitVertices: points,
    texelByLabel,
    physicsVertices: points.map((p) => p.clone().multiplyScalar(radius)),
    physicsFaces: faces.map((f) => f.corners),
  }
}
