import * as CANNON from 'cannon-es'
import * as THREE from 'three'
import { buildDieGeometry, type FaceInfo } from './geometry'
import {
  DIE_FONT_FAMILY,
  DIE_FONT_WEIGHT,
  DIE_COLOR,
  DIE_NUMBER_COLOR,
  DIGIT_HEIGHT_RATIO,
  NUMBER_HEIGHT,
  TEXTURE_SIZE,
  type DieShape,
} from './shapes'
import { fillTextCentered } from './text'

// A rolling die: a Three.js mesh plus a cannon-es body, ported from threejs-dice by Michael Wolf
// (MIT; see third_party/threejs-dice).

export interface DieOptions {
  // Overall size in world units.
  size?: number
  // Replaces the shape's own size adjustment (see DieShape.scale); used to tune sizes by eye.
  scale?: number
  fontColor?: string
  backColor?: string
}

export interface BodyState {
  position: CANNON.Vec3
  quaternion: CANNON.Quaternion
  velocity: CANNON.Vec3
  angularVelocity: CANNON.Vec3
}


// Each face keeps its own number (a group of one) unless the shape lets its numbers move around.
function defaultGroups(shape: DieShape): number[][] {
  const all = Array.from({ length: shape.sides }, (_, i) => i + 1)
  return shape.freeNumbers ? [all] : all.map((label) => [label])
}

export class Die {
  readonly shape: DieShape
  readonly mesh: THREE.Mesh
  readonly body: CANNON.Body
  // The die's circumradius in world units.
  readonly radius: number

  private readonly faces: FaceInfo[]
  private readonly unitVertices: THREE.Vector3[]
  // Rotations that turn one face into another and leave the die looking the same, found on demand.
  private readonly symmetries = new Map<string, THREE.Quaternion | null>()
  // The same spin inertia about every axis. A rotated copy of a symmetric die then moves exactly as
  // the original does, which is what lets a throw be steered by rotating the die's starting pose.
  private readonly inertia: number
  private readonly materials: THREE.MeshPhongMaterial[] = []
  private readonly textures = new Map<string, THREE.CanvasTexture>()
  private readonly fontColor: string
  private readonly backColor: string
  // Faces whose numbers trade places only with each other (see DieShape.groups), and the number each
  // face starts with.
  private groups: number[][]
  private readonly numbers: number[]
  // How far each group's numbers are rotated from their starting arrangement; the roll sets these so
  // the face that lands on top shows the number that was rolled.
  private offsets: number[]
  // How much of the die's surface one texture pixel covers, per face label.
  private readonly texel: Map<number, number>
  private readonly size: number

  constructor(shape: DieShape, bodyMaterial: CANNON.Material, options: DieOptions = {}) {
    this.shape = shape
    const all = Array.from({ length: shape.sides }, (_, i) => i + 1)
    this.groups = shape.groups ?? defaultGroups(shape)
    this.numbers = shape.numbers ?? all
    this.offsets = this.groups.map(() => 0)
    this.fontColor = options.fontColor ?? DIE_NUMBER_COLOR
    this.backColor = options.backColor ?? DIE_COLOR

    this.size = options.size ?? 2
    const radius = this.size * (options.scale ?? shape.scale)
    this.radius = radius
    const built = buildDieGeometry(shape, radius)
    this.texel = built.texelByLabel
    this.faces = built.faces
    this.unitVertices = built.unitVertices
    this.inertia = 0.4 * shape.mass * radius * radius

    // Material 0 is the blank bevel; material n shows the number printed on faces with base label n.
    this.materials.push(this.makeMaterial(null))
    for (let label = 1; label <= shape.sides; label++) this.materials.push(this.makeMaterial(label))

    this.mesh = new THREE.Mesh(built.geometry, this.materials)
    this.mesh.castShadow = true

    this.body = new CANNON.Body({
      mass: shape.mass,
      material: bodyMaterial,
      shape: new CANNON.ConvexPolyhedron({
        vertices: built.physicsVertices.map((v) => new CANNON.Vec3(v.x, v.y, v.z)),
        faces: built.physicsFaces,
      }),
    })
    this.body.linearDamping = 0.1
    this.body.angularDamping = 0.1

    this.refreshLabels()

    // Canvas text uses a web font only once it has loaded. If it has not yet, draw with the fallback
    // now and redraw the numbers as soon as it arrives.
    const fontSpec = `${DIE_FONT_WEIGHT} 64px ${DIE_FONT_FAMILY}`
    if (typeof document !== 'undefined' && !document.fonts.check(fontSpec)) {
      void document.fonts.load(fontSpec).then(() => this.redrawTextures())
    }
  }

  // --- Labels ----------------------------------------------------------------------------------

  // The number currently printed on the face with this base label.
  private shown(label: number): number {
    const g = this.groups.findIndex((group) => group.includes(label))
    const group = this.groups[g]
    const at = group.indexOf(label)
    return this.numbers[group[(at + this.offsets[g]) % group.length] - 1]
  }

  private makeMaterial(label: number | null): THREE.MeshPhongMaterial {
    return new THREE.MeshPhongMaterial({
      specular: 0x172022,
      color: 0xf0f0f0,
      shininess: 40,
      flatShading: true,
      map: label === null ? this.labelTexture('', 0) : null,
    })
  }

  // The font size, in texture pixels, that makes a digit the same physical height on this face as on
  // every other face of every die.
  private fontPixels(label: number): number {
    const texel = this.texel.get(label) ?? 1
    return (NUMBER_HEIGHT * this.size) / (DIGIT_HEIGHT_RATIO * texel)
  }

  private labelTexture(text: string, label: number, corners?: number[]): THREE.CanvasTexture {
    const fontSize = this.fontPixels(label)
    const key = corners ? `corners:${corners.join(',')}:${fontSize}` : `text:${text}:${fontSize}`
    const cached = this.textures.get(key)
    if (cached) return cached

    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = TEXTURE_SIZE
    const context = canvas.getContext('2d')!
    context.fillStyle = this.backColor
    context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    context.fillStyle = this.fontColor
    context.textAlign = 'center'
    context.textBaseline = 'middle'

    if (corners) {
      // d4: the three numbers sit near the corners, each turned 120 degrees from the last.
      context.font = `${DIE_FONT_WEIGHT} ${fontSize}px ${DIE_FONT_FAMILY}`
      for (const n of corners) {
        fillTextCentered(context, String(n), TEXTURE_SIZE / 2, TEXTURE_SIZE / 2 - TEXTURE_SIZE * 0.3)
        context.translate(TEXTURE_SIZE / 2, TEXTURE_SIZE / 2)
        context.rotate((Math.PI * 2) / 3)
        context.translate(-TEXTURE_SIZE / 2, -TEXTURE_SIZE / 2)
      }
    } else if (text) {
      // Every number is the same physical height. The ink is centred, not the font's line box.
      context.font = `${DIE_FONT_WEIGHT} ${fontSize}px ${DIE_FONT_FAMILY}`
      fillTextCentered(context, text, TEXTURE_SIZE / 2, TEXTURE_SIZE / 2)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    this.textures.set(key, texture)
    return texture
  }

  // Throws away every drawn texture and draws them again (for when the font finishes loading).
  private redrawTextures() {
    this.textures.forEach((texture) => texture.dispose())
    this.textures.clear()
    this.materials[0].map = this.labelTexture('', 0)
    this.materials[0].needsUpdate = true
    this.refreshLabels()
  }

  // How a number is written on this die.
  private text(value: number): string {
    return this.shape.labelText ? this.shape.labelText(value) : String(value)
  }

  // A texture the shape draws for itself, because what a face shows depends on the other faces.
  private drawnTexture(label: number): THREE.CanvasTexture {
    const key = `drawn:${label}:${this.offsets.join('-')}:${this.fontPixels(label)}`
    const cached = this.textures.get(key)
    if (cached) return cached

    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = TEXTURE_SIZE
    const context = canvas.getContext('2d')!
    context.fillStyle = this.backColor
    context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    context.fillStyle = this.fontColor
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    this.shape.drawFace!(context, TEXTURE_SIZE, label, (l) => this.shown(l), this.fontPixels(label))

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    this.textures.set(key, texture)
    return texture
  }

  private refreshLabels() {
    for (let label = 1; label <= this.shape.sides; label++) {
      const layouts = this.shape.cornerLabels
      const texture = this.shape.drawFace
        ? this.drawnTexture(label)
        : layouts
          ? this.labelTexture('', label, layouts[this.offsets[0] % layouts.length][this.shown(label)])
          : this.labelTexture(this.text(this.shown(label)), label)
      const material = this.materials[label]
      material.map = texture
      material.needsUpdate = true
    }
  }

  // --- Reading and rigging the result -------------------------------------------------------------

  // The face whose normal points most nearly straight up (or down, for the d4).
  private upFace(): FaceInfo {
    const direction = new THREE.Vector3(0, this.shape.readsBottom ? -1 : 1, 0)
    const rotation = new THREE.Quaternion(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w,
    )
    const dots = this.faces.map((face) => face.normal.clone().applyQuaternion(rotation).dot(direction))
    const top = Math.max(...dots)
    // Faces can tie for the top (a d7 standing on its base has a point on top, shared by three
    // faces; a d16 resting on a face has a ridge on top, shared by two). Among faces within a hair
    // of the top, take the one the others lie counter-clockwise of, seen from above: a rule built
    // into the die's shape, so every face of a die with no opposite faces can be the one read. If
    // that does not separate them (a point shared evenly), take the lowest-numbered. Either way the
    // answer cannot flip because of a tiny drift in a resting die.
    const tied = this.faces.map((_, i) => i).filter((i) => dots[i] > top - 0.02)
    if (tied.length === 1) return this.faces[tied[0]]
    const flat = tied.map((i) => {
      const n = this.faces[i].normal.clone().applyQuaternion(rotation)
      return { i, x: n.x, z: n.z }
    })
    const hand = flat.map((a) => flat.reduce((sum, b) => sum + (a.x * b.z - a.z * b.x), 0))
    const spread = Math.max(...hand) - Math.min(...hand)
    const chosen = tied
      .map((i, k) => ({ face: this.faces[i], hand: spread > 0.01 ? hand[k] : 0 }))
      .reduce((a, b) => (b.hand > a.hand || (b.hand === a.hand && b.face.label < a.face.label) ? b : a))
    return chosen.face
  }

  // The number a person reads off the resting die.
  readValue(): number {
    return this.shown(this.upFace().label)
  }

  // --- Steering a throw ----------------------------------------------------------------------------

  // A rotation of the die onto itself that turns face `from` into face `to`, or null if there is
  // none (the faces are not interchangeable). Found by matching the two faces' corner frames and
  // checking that the rotation leaves every vertex on a vertex.
  private symmetry(from: FaceInfo, to: FaceInfo): THREE.Quaternion | null {
    const key = `${this.faces.indexOf(from)}>${this.faces.indexOf(to)}`
    const cached = this.symmetries.get(key)
    if (cached !== undefined) return cached

    const frame = (face: FaceInfo, corner: number) => {
      const centre = face.corners.reduce((sum, c) => sum.add(c), new THREE.Vector3()).divideScalar(face.corners.length)
      const along = face.corners[corner].clone().sub(centre).normalize()
      return new THREE.Matrix4().makeBasis(along, face.normal.clone().cross(along), face.normal)
    }
    const fromFrame = frame(from, 0)

    let found: THREE.Quaternion | null = null
    for (let corner = 0; corner < to.corners.length && !found; corner++) {
      // The rotation that carries the `from` frame onto this corner's frame of `to`.
      const turn = frame(to, corner).multiply(fromFrame.clone().transpose())
      const keepsShape = this.unitVertices.every((v) => {
        const moved = v.clone().applyMatrix4(turn)
        return this.unitVertices.some((w) => w.distanceTo(moved) < 1e-3)
      })
      if (keepsShape) found = new THREE.Quaternion().setFromRotationMatrix(turn)
    }
    this.symmetries.set(key, found)
    return found
  }

  // After a throw that ended with the wrong face showing, a new starting pose that should end with a
  // right face showing instead: the old pose turned by the symmetry that carries a face with the
  // wanted number onto the face the die landed on. The throw then plays out identically, with the
  // wanted face where the wrong one was. Null if no such symmetry exists (try a fresh throw).
  steeredStart(start: BodyState, value: number): BodyState | null {
    const landed = this.upFace()
    const wanted = this.faces.filter((face) => this.shown(face.label) === value)
    for (const face of wanted) {
      const turn = this.symmetry(face, landed)
      if (!turn) continue
      const quaternion = start.quaternion.mult(new CANNON.Quaternion(turn.x, turn.y, turn.z, turn.w))
      quaternion.normalize()
      return { ...start, quaternion }
    }
    return null
  }

  // Whether the face the die has landed on can be made to show `value` just by trading numbers
  // within its group. True for most dice; a d5 that landed on a side can show 2, 3 or 4 but not 1 or 5.
  canShowOnTop(value: number): boolean {
    const group = this.groups.find((g) => g.includes(this.upFace().label))!
    return group.some((label) => this.numbers[label - 1] === value)
  }

  // Reprints the numbers so the face that is currently up shows `value`. Check canShowOnTop first.
  showValueOnTop(value: number) {
    const base = this.upFace().label
    const g = this.groups.findIndex((group) => group.includes(base))
    const group = this.groups[g]
    const at = group.indexOf(base)
    // The face at position `at` shows the number of position at + offset; find the offset for `value`.
    const target = group.findIndex((label) => this.numbers[label - 1] === value)
    this.offsets = this.groups.map(() => 0)
    this.offsets[g] = (target - at + group.length) % group.length
    this.refreshLabels()
  }

  // Lets every number cycle around the whole die, so any value can be shown on any face. A last
  // resort for a throw that kept landing on faces that could not show what was needed.
  allowAnyFace() {
    this.groups = [Array.from({ length: this.shape.sides }, (_, i) => i + 1)]
    this.offsets = [0]
  }

  // Puts the numbers back as the shape defines them (undoing any earlier roll or allowAnyFace).
  resetNumbers() {
    this.groups = this.shape.groups ?? defaultGroups(this.shape)
    this.offsets = this.groups.map(() => 0)
    this.refreshLabels()
  }

  // Whether the body has come to rest.
  isResting(): boolean {
    const v = this.body.velocity
    const w = this.body.angularVelocity
    const limit = 1
    return (
      Math.abs(v.x) < limit &&
      Math.abs(v.y) < limit &&
      Math.abs(v.z) < limit &&
      Math.abs(w.x) < limit &&
      Math.abs(w.y) < limit &&
      Math.abs(w.z) < limit
    )
  }

  // --- Body state ----------------------------------------------------------------------------------

  snapshot(): BodyState {
    return {
      position: this.body.position.clone(),
      quaternion: this.body.quaternion.clone(),
      velocity: this.body.velocity.clone(),
      angularVelocity: this.body.angularVelocity.clone(),
    }
  }

  restore(state: BodyState) {
    this.body.position.copy(state.position)
    this.body.quaternion.copy(state.quaternion)
    this.body.velocity.copy(state.velocity)
    this.body.angularVelocity.copy(state.angularVelocity)
    this.body.force.set(0, 0, 0)
    this.body.torque.set(0, 0, 0)
    // A replay has to start from exactly the state the simulation started from.
    this.body.previousPosition.copy(state.position)
    this.body.interpolatedPosition.copy(state.position)
    this.body.initPosition.copy(state.position)
    this.body.initVelocity.copy(state.velocity)
    this.body.initQuaternion.copy(state.quaternion)
    this.body.initAngularVelocity.copy(state.angularVelocity)
    this.refreshDerived()
    this.syncMesh()
  }

  // Recomputes the cached values that depend on the body's pose (world-space inertia, solver
  // accumulators, bounding box). They go stale when the pose is set by hand, and a stale value
  // makes the first physics step differ from run to run, which would break the replay.
  refreshDerived() {
    this.body.vlambda.set(0, 0, 0)
    this.body.wlambda.set(0, 0, 0)
    this.body.updateMassProperties()
    this.body.inertia.set(this.inertia, this.inertia, this.inertia)
    this.body.invInertia.set(1 / this.inertia, 1 / this.inertia, 1 / this.inertia)
    this.body.updateInertiaWorld(true)
    this.body.updateSolveMassProperties()
    this.body.interpolatedQuaternion.copy(this.body.quaternion)
    this.body.aabbNeedsUpdate = true
  }

  syncMesh() {
    this.mesh.position.set(this.body.position.x, this.body.position.y, this.body.position.z)
    this.mesh.quaternion.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w,
    )
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.materials.forEach((m) => m.dispose())
    this.textures.forEach((t) => t.dispose())
  }
}
