import * as CANNON from 'cannon-es'
import type { BodyState, Die } from './Die'

// The physics world and the rigged throw, ported from threejs-dice by Michael Wolf (MIT; see
// third_party/threejs-dice).
//
// A throw is rigged by simulating it to rest in the background, noting which face landed on top,
// reprinting the die's numbers so that face shows the number that was rolled, and then replaying
// the same throw from the same start. The physics is deterministic with a fixed time step, so the
// replay lands exactly as the simulation did. The number is decided before any of this happens.

export interface Throw {
  die: Die
  value: number
}

// A rectangle of the floor reserved for one die during a throw.
export interface Cell {
  x0: number
  x1: number
  z0: number
  z1: number
}

export interface Bounds {
  // Half the width (x) and depth (z) of the floor the dice stay on.
  halfWidth: number
  halfDepth: number
}

export const STEP = 1 / 60
// How many steps in a row every die must be resting before the simulation calls the throw over.
const SETTLE_STEPS = 50
// The replay stops this many steps before the simulation did: late enough that every die has been
// still for a while, early enough not to wait on the full settle window.
const REPLAY_TRIM = 40
const MAX_SIMULATED_STEPS = 1800
// How many throws to try, and for how long, before giving up on keeping a fixed-number die's numbers
// in place. The time limit stops a big pool of prisms from freezing the page while it keeps trying.
const MAX_ATTEMPTS = 150
const MAX_SEARCH_MS = 250

// Collision groups. The floor and the outer walls are group 1 and collide with everything. During a
// throw each die gets a group of its own (2, 4, 8 ...) and collides only with the floor, the outer
// walls and the walls of its own lane, never with another die. Up to 30 dice can have their own lane.
const SHARED_GROUP = 1
const laneGroup = (index: number) => 2 << (index % 30)

export class DiceWorld {
  readonly world: CANNON.World
  readonly bodyMaterial = new CANNON.Material('die')
  private readonly barrierMaterial = new CANNON.Material('barrier')
  private readonly bounds: Bounds
  private readonly dice = new Set<Die>()
  private playing: { throws: Throw[]; stepsLeft: number; done: () => void } | null = null

  constructor(bounds: Bounds) {
    this.bounds = bounds
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82 * 20, 0) })
    this.world.broadphase = new CANNON.NaiveBroadphase()
    ;(this.world.solver as CANNON.GSSolver).iterations = 16

    const floorMaterial = new CANNON.Material('floor')
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(floorMaterial, this.bodyMaterial, { friction: 0.01, restitution: 0.5 }),
    )
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.barrierMaterial, this.bodyMaterial, { friction: 0, restitution: 1 }),
    )
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.bodyMaterial, this.bodyMaterial, { friction: 0, restitution: 0.5 }),
    )

    const floor = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: floorMaterial })
    floor.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2)
    this.world.addBody(floor)

    // Four invisible walls keep the dice on the stage.
    this.walls(-bounds.halfWidth, bounds.halfWidth, -bounds.halfDepth, bounds.halfDepth).forEach((body) =>
      this.world.addBody(body),
    )
  }

  // The four walls of a rectangle of floor, all facing inward.
  private walls(x0: number, x1: number, z0: number, z1: number): CANNON.Body[] {
    const wall = (x: number, z: number, angle: number) => {
      const body = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: this.barrierMaterial })
      body.position.set(x, 0, z)
      body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle)
      return body
    }
    return [wall(x0, 0, Math.PI / 2), wall(x1, 0, -Math.PI / 2), wall(0, z0, 0), wall(0, z1, Math.PI)]
  }

  // Divides the floor into one cell per die, in rows and columns shaped like the floor itself. A
  // single die gets the whole floor.
  layout(count: number): Cell[] {
    const { halfWidth, halfDepth } = this.bounds
    const columns = Math.max(1, Math.ceil(Math.sqrt((count * halfWidth) / halfDepth)))
    const rows = Math.max(1, Math.ceil(count / columns))
    const width = (2 * halfWidth) / columns
    const depth = (2 * halfDepth) / rows
    return Array.from({ length: count }, (_, i) => {
      const column = i % columns
      const row = Math.floor(i / columns)
      return {
        x0: -halfWidth + column * width,
        x1: -halfWidth + (column + 1) * width,
        z0: -halfDepth + row * depth,
        z1: -halfDepth + (row + 1) * depth,
      }
    })
  }

  add(die: Die) {
    this.dice.add(die)
    this.world.addBody(die.body)
  }

  remove(die: Die) {
    this.dice.delete(die)
    this.world.removeBody(die.body)
  }

  // Lets dice fall from where they are and come to rest, without drawing it, so they can be laid out
  // sitting naturally on the floor.
  settle(dice: Die[]) {
    dice.forEach((die) => {
      die.body.velocity.set(0, 0, 0)
      die.body.angularVelocity.set(0, 0, 0)
      die.refreshDerived()
    })
    const stable = new Map(dice.map((die) => [die, 0]))
    for (let step = 0; step < MAX_SIMULATED_STEPS; step++) {
      this.world.step(STEP)
      let allStable = true
      for (const die of dice) {
        const count = die.isResting() ? stable.get(die)! + 1 : 0
        stable.set(die, count)
        if (count < 20) allStable = false
      }
      if (allStable) break
    }
    dice.forEach((die) => die.syncMesh())
  }

  get isPlaying(): boolean {
    return this.playing !== null
  }

  // How many throws were simulated for the last roll (more than one when a die kept landing on a
  // face that could not show what it was rigged to).
  lastAttempts = 0

  // Starts a rigged throw. `cells` gives each die a lane of its own (see layout), so the dice never
  // touch and each can be searched and steered on its own. `relaunch` gives the dice it is handed a
  // new random start, for when a die has to be thrown again. Resolves when every die has come to rest.
  roll(
    throws: Throw[],
    relaunch: (dice: Die[]) => void = () => {},
    cells: Cell[] = this.layout(throws.length),
  ): Promise<void> {
    if (this.playing) return Promise.reject(new Error('A throw is already in progress.'))
    throws.forEach(({ die, value }) => {
      if (value < 1 || value > die.shape.sides) {
        throw new Error(`A ${die.shape.name} has no face ${value}.`)
      }
    })

    // Dice that are not part of this throw sit out so they cannot disturb the simulation.
    const parked = [...this.dice].filter((d) => !throws.some((t) => t.die === d))
    parked.forEach((d) => this.world.removeBody(d.body))

    // Each die gets a lane: its own collision group, and walls around its cell that only it feels.
    const laneWalls: CANNON.Body[] = []
    throws.forEach(({ die }, i) => {
      const group = laneGroup(i)
      die.body.collisionFilterGroup = group
      die.body.collisionFilterMask = SHARED_GROUP | group
      const cell = cells[i]
      // A die too big for its lane (a crowded roll) is not walled in: it roams the whole floor. It
      // still never touches another die, so its throw stays independent.
      if (!cell || die.radius * 2.1 > Math.min(cell.x1 - cell.x0, cell.z1 - cell.z0)) return
      for (const wall of this.walls(cell.x0, cell.x1, cell.z0, cell.z1)) {
        wall.collisionFilterGroup = group
        wall.collisionFilterMask = group
        this.world.addBody(wall)
        laneWalls.push(wall)
      }
    })

    // Most dice can be reprinted to show anything on any face, so the first throw almost always
    // works. A die with fixed numbers (the d5's ends are always 1 and 5) can only show some values on
    // some faces. When one lands on a face that cannot show its value, only that die is thrown again;
    // the dice that landed well are put back at their starts, so each die is searched separately.
    throws.forEach(({ die }) => die.resetNumbers())
    let starts = new Map<Die, BodyState>()
    let simulatedSteps = 0
    const searchStart = performance.now()
    const alreadySteered = new Set<Die>()
    const fresh = () => {
      // The simulation and the replay must start from identical state, derived values included.
      throws.forEach(({ die }) => die.refreshDerived())
      starts = new Map<Die, BodyState>(throws.map(({ die }) => [die, die.snapshot()]))
    }

    fresh()
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      this.lastAttempts = attempt
      simulatedSteps = this.simulate(throws)
      const failing = throws.filter(({ die, value }) => !die.canShowOnTop(value))
      if (failing.length === 0) break

      if (attempt === MAX_ATTEMPTS || performance.now() - searchStart > MAX_SEARCH_MS) {
        // Out of tries or time: let the numbers cycle freely on the dice that still cannot show
        // their value, and use this throw as it is.
        failing.forEach(({ die }) => die.allowAnyFace())
        break
      }

      // Dice that landed well go back to their starts. A die that did not is turned by the symmetry
      // that moves a face with the wanted number onto the face it landed on, so the same throw
      // should now end on the right face; a die with no such symmetry gets a fresh random throw.
      // Steering is deterministic, so a die that was steered and still landed wrong could be steered
      // into the same few outcomes forever. Such a die gets a fresh random throw instead.
      const steered = failing.map(({ die, value }) => {
        const state = alreadySteered.has(die) ? null : die.steeredStart(starts.get(die)!, value)
        if (state) alreadySteered.add(die)
        else alreadySteered.delete(die)
        return { die, state }
      })
      throws.filter((t) => !failing.includes(t)).forEach(({ die }) => {
        alreadySteered.delete(die)
        die.restore(starts.get(die)!)
      })
      steered.forEach(({ die, state }) => {
        if (state) die.restore(state)
      })
      relaunch(steered.filter(({ state }) => !state).map(({ die }) => die))
      this.world.contacts.length = 0
      this.world.clearForces()
      fresh()
    }

    throws.forEach(({ die, value }) => die.showValueOnTop(value))
    throws.forEach(({ die }) => die.restore(starts.get(die)!))
    // The simulation left contact and collision caches behind; a replay must start clean.
    this.world.contacts.length = 0
    this.world.clearForces()

    return new Promise<void>((resolve) => {
      this.playing = {
        throws,
        // The replay follows the simulation step for step, so it ends where the simulation ended
        // (trimmed) and can never stop on a die that is only pausing before it tips over.
        stepsLeft: Math.max(simulatedSteps - REPLAY_TRIM, 1),
        done: () => {
          // Back to the shared group so dice laid out afterwards behave as usual.
          laneWalls.forEach((wall) => this.world.removeBody(wall))
          throws.forEach(({ die }) => {
            die.body.collisionFilterGroup = SHARED_GROUP
            die.body.collisionFilterMask = -1
          })
          parked.forEach((d) => this.world.addBody(d.body))
          this.playing = null
          resolve()
        },
      }
    })
  }

  // Runs the throw to rest without drawing it, and returns how many steps it took.
  private simulate(throws: Throw[]): number {
    const stable = new Map(throws.map(({ die }) => [die, 0]))
    for (let step = 1; step <= MAX_SIMULATED_STEPS; step++) {
      this.world.step(STEP)
      let allStable = true
      for (const { die } of throws) {
        const count = die.isResting() ? stable.get(die)! + 1 : 0
        stable.set(die, count)
        if (count < SETTLE_STEPS) allStable = false
      }
      if (allStable) return step
    }
    return MAX_SIMULATED_STEPS
  }

  // Advances the replay by one fixed step. Call this once per 1/60s of real time while playing.
  step() {
    this.world.step(STEP)
    this.dice.forEach((die) => die.syncMesh())
    if (!this.playing) return

    this.playing.stepsLeft--
    if (this.playing.stepsLeft <= 0) {
      // The replay follows the simulation exactly, so every die shows its number. In a very crowded
      // throw, rounding can occasionally nudge it somewhere else. If so, reprint that die now rather
      // than show the wrong number.
      for (const { die, value } of this.playing.throws) {
        if (die.readValue() !== value) {
          die.allowAnyFace()
          die.showValueOnTop(value)
        }
      }
      this.playing.done()
    }
  }
}
