import * as CANNON from 'cannon-es'
import * as THREE from 'three'
import { SUPPORTED_DICE } from '../dice'
import { ROLLABLES, SHAPES } from './catalog'
import { Die } from './Die'
import { DIE_FONT_FAMILY, DIE_FONT_WEIGHT } from './shapes'

// Still pictures of the dice for the buttons that add them: each die seen from straight above with its
// highest value face up (a d20 showing 20), drawn in the same look as the dice that roll.

const SIZE = 1
// How the picture is framed: a blend of every die at the same scale (so the d24 looks bigger than the
// d6, as on the table) and each die filling its picture (so the small ones stay readable).
const SHARED_FRAMING = 0.3

// One picture per die size (3, 4 ... 100), as PNG data URLs, `pixels` wide and tall, handed to
// `onPreview` one at a time (with a pause between, so the page stays responsive while they are made).
// The d100 shows its pair, the percentile die and the units die, side by side.
export async function renderDicePreviews(pixels: number, onPreview: (size: number, url: string) => void) {
  // The numbers are drawn with the app's font, which must have loaded before the dice are made.
  await document.fonts.load(`${DIE_FONT_WEIGHT} 64px ${DIE_FONT_FAMILY}`)

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = pixels
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1)
  renderer.setSize(pixels, pixels, false)
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  scene.add(new THREE.AmbientLight('#ffffff', 1.9))
  const sun = new THREE.DirectionalLight('#ffffff', 2.6)
  sun.position.set(-8, 30, 12)
  scene.add(sun)

  const material = new CANNON.Material('preview')
  const biggest = Math.max(...Object.values(SHAPES).map((shape) => SIZE * shape.scale))

  for (const size of SUPPORTED_DICE) {
    const shapes = ROLLABLES[`d${size}`].shapes
    // The d100's two dice sit side by side, a little smaller so both fit.
    const pair = shapes.length > 1
    const dice = shapes.map((name) => new Die(SHAPES[name], material, { size: pair ? SIZE * 0.85 : SIZE }))
    dice.forEach((die, i) => {
      die.poseForPreview(SHAPES[shapes[i]].sides)
      die.mesh.position.set(pair ? (i === 0 ? -1 : 1) * die.radius * 1.05 : 0, 0, 0)
      scene.add(die.mesh)
    })

    const radius = Math.max(...dice.map((die) => die.radius))
    const half = (pair ? radius * 2.1 : radius) * (1 - SHARED_FRAMING) * 1.12 + biggest * SHARED_FRAMING * 1.12
    const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 100)
    // Straight down, with the numbers upright.
    camera.position.set(0, 20, 0)
    camera.up.set(0, 0, -1)
    camera.lookAt(0, 0, 0)

    renderer.render(scene, camera)
    onPreview(size, canvas.toDataURL('image/png'))

    dice.forEach((die) => {
      scene.remove(die.mesh)
      die.dispose()
    })
    await new Promise((resolve) => setTimeout(resolve))
  }

  renderer.dispose()
}
