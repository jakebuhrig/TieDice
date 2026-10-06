import * as THREE from 'three'
import { ConvexHull } from 'three/examples/jsm/math/ConvexHull.js'

// Works out a convex polyhedron's faces from nothing but its vertices, so a new die only needs its
// corner coordinates. The hull is made of triangles; triangles lying in the same plane are merged
// back into one polygon (a kite or rhombus is two triangles, for example).

export function hullPolygons(points: THREE.Vector3[]): number[][] {
  const hull = new ConvexHull().setFromPoints(points)
  const groups: { normal: THREE.Vector3; constant: number; corners: Set<number> }[] = []

  for (const face of hull.faces) {
    let group = groups.find(
      (g) => g.normal.dot(face.normal) > 1 - 1e-6 && Math.abs(g.constant - face.constant) < 1e-4,
    )
    if (!group) {
      group = { normal: face.normal.clone(), constant: face.constant, corners: new Set() }
      groups.push(group)
    }
    let edge = face.edge
    do {
      group.corners.add(points.indexOf(edge.head().point))
      edge = edge.next
    } while (edge !== face.edge)
  }

  // Put each polygon's corners in order around its outline.
  return groups.map(({ normal, corners }) => {
    const centre = new THREE.Vector3()
    corners.forEach((c) => centre.add(points[c]))
    centre.divideScalar(corners.size)
    const helper = Math.abs(normal.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
    const u = helper.clone().cross(normal).normalize()
    const w = normal.clone().cross(u)
    const angle = (c: number) => {
      const d = points[c].clone().sub(centre)
      return Math.atan2(d.dot(w), d.dot(u))
    }
    return [...corners].sort((a, b) => angle(a) - angle(b))
  })
}
