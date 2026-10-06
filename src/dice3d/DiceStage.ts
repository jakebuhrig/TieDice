import * as THREE from 'three'
import { Die, type DieOptions } from './Die'
import { DiceWorld, STEP, type Cell, type Throw } from './DiceWorld'
import { ROLLABLES, SHAPES, type Rollable } from './catalog'

// A canvas that renders rolling dice over whatever is behind it (the floor only draws shadows).

const HALF_WIDTH = 13
const HALF_DEPTH = 7

export class DiceStage {
  readonly world = new DiceWorld({ halfWidth: HALF_WIDTH, halfDepth: HALF_DEPTH })
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500)
  private readonly dice: Die[] = []
  private readonly rolls: { rollable: Rollable; dice: Die[] }[] = []
  private frame = 0
  private lastTime = 0
  private accumulator = 0
  private disposed = false
  private readonly canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.scene.add(new THREE.AmbientLight('#ffffff', 1.9))

    const sun = new THREE.DirectionalLight('#ffffff', 2.6)
    sun.position.set(-8, 30, 12)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -HALF_WIDTH - 4
    sun.shadow.camera.right = HALF_WIDTH + 4
    sun.shadow.camera.top = HALF_DEPTH + 6
    sun.shadow.camera.bottom = -HALF_DEPTH - 6
    sun.shadow.camera.near = 5
    sun.shadow.camera.far = 80
    this.scene.add(sun)

    // The floor draws nothing but the dice's shadows, so the panel's gradient shows through.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF_WIDTH * 2 + 10, HALF_DEPTH * 2 + 10),
      new THREE.ShadowMaterial({ opacity: 0.28 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)

    this.camera.position.set(0, 25, 14)
    this.camera.lookAt(0, 0, 0)

    this.resize()
    this.lastTime = performance.now()
    this.frame = requestAnimationFrame(this.tick)
  }

  // Matches the drawing buffer to the canvas's on-screen size.
  resize() {
    const width = this.canvas.clientWidth || 1
    const height = this.canvas.clientHeight || 1
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  // Puts a die (or, for the d100, a pair) on the stage. Returns the dice it added. `scales` sets a
  // size adjustment per shape name (a d100's two dice are shapes of their own).
  addRoll(name: string, options?: DieOptions, scales?: Record<string, number>): Die[] {
    const rollable = ROLLABLES[name]
    if (!rollable) throw new Error(`Nothing called ${name} can be rolled.`)
    const dice = rollable.shapes.map((shapeName) => {
      const die = new Die(SHAPES[shapeName], this.world.bodyMaterial, { ...options, scale: scales?.[shapeName] ?? options?.scale })
      this.dice.push(die)
      this.scene.add(die.mesh)
      this.world.add(die)
      return die
    })
    this.rolls.push({ rollable, dice })
    return dice
  }

  clear() {
    this.rolls.length = 0
    this.dice.splice(0).forEach((die) => {
      this.scene.remove(die.mesh)
      this.world.remove(die)
      die.dispose()
    })
  }

  // Throws everything on the stage from the left, rigged so each roll shows its result (one result
  // per roll, in the order they were added). Resolves once the dice rest.
  roll(results: number[]): Promise<void> {
    const throws: Throw[] = []
    this.rolls.forEach((entry, i) => {
      const values = entry.rollable.split(results[i])
      entry.dice.forEach((die, k) => throws.push({ die, value: values[k] }))
    })
    // Each die gets its own lane of the floor, so the dice never touch and each throw can be searched
    // and steered on its own. A die that lands wrong is thrown again from a fresh start.
    const cells = this.world.layout(throws.length)
    const launchOne = (index: number) => {
      const { die } = throws[index]
      this.launch(die, cells[index])
      die.syncMesh()
    }
    throws.forEach((_, index) => launchOne(index))
    return this.world.roll(
      throws,
      (dice) => dice.forEach((die) => launchOne(throws.findIndex((t) => t.die === die))),
      cells,
    )
  }

  // Lets every die on the stage fall to the floor and rest there.
  settle() {
    this.world.settle(this.dice)
  }

  // What the resting dice show, one result per roll.
  readResults(): number[] {
    return this.rolls.map((entry) => entry.rollable.join(entry.dice.map((die) => die.readValue())))
  }

  // How many sides each roll on the stage has.
  get rollSides(): number[] {
    return this.rolls.map((entry) => entry.rollable.sides)
  }

  // Puts a die at a random start inside its cell: at the left of the cell, tossed to the right. The
  // throw is softer in a small cell so the die stays inside its lane rather than slamming its walls.
  private launch(die: Die, cell: Cell) {
    const width = cell.x1 - cell.x0
    const depth = cell.z1 - cell.z0
    const inset = Math.min(die.radius * 1.3, width * 0.3)
    const centreZ = (cell.z0 + cell.z1) / 2
    die.body.position.set(
      cell.x0 + inset,
      die.radius * 1.2 + 1 + Math.random() * 2,
      centreZ + (Math.random() - 0.5) * Math.max(depth - 2 * die.radius, 0) * 0.8,
    )
    // Any orientation is equally likely (a uniformly random rotation), so no face is favoured by the
    // way the die starts out.
    const [u1, u2, u3] = [Math.random(), Math.random(), Math.random()]
    die.body.quaternion.set(
      Math.sqrt(1 - u1) * Math.sin(2 * Math.PI * u2),
      Math.sqrt(1 - u1) * Math.cos(2 * Math.PI * u2),
      Math.sqrt(u1) * Math.sin(2 * Math.PI * u3),
      Math.sqrt(u1) * Math.cos(2 * Math.PI * u3),
    )
    // Full speed across the whole floor (a 26-unit-wide cell), gentler as the cell narrows. A die that
    // tends not to roll (the thin d5) is thrown harder and spun faster.
    const power = die.shape.throwPower ?? 1
    const speed = Math.min(Math.max(width * 1.2, 7), 31) * Math.sqrt(power)
    die.body.velocity.set(speed * (0.85 + Math.random() * 0.3), 8 + Math.random() * 12, (Math.random() - 0.5) * depth * 0.6)
    die.body.angularVelocity.set(
      (Math.random() * 20 - 10) * power,
      (Math.random() * 20 - 10) * power,
      (Math.random() * 20 - 10) * power,
    )
    die.syncMesh()
  }

  private tick = (time: number) => {
    if (this.disposed) return
    this.frame = requestAnimationFrame(this.tick)

    // Physics runs in fixed 1/60s steps so a replay matches the simulation exactly.
    this.accumulator += Math.min((time - this.lastTime) / 1000, 0.1)
    this.lastTime = time
    while (this.accumulator >= STEP) {
      if (this.world.isPlaying) this.world.step()
      this.accumulator -= STEP
    }

    this.renderer.render(this.scene, this.camera)
  }

  get diceList(): readonly Die[] {
    return this.dice
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.clear()
    this.renderer.dispose()
  }
}
