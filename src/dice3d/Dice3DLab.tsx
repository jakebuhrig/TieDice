import { useEffect, useRef, useState } from 'react'
import { DiceStage } from './DiceStage'
import { ROLLABLES, SHAPES } from './catalog'

// Development-only page (open /?dice3d) for trying the 3D dice: pick dice, roll them to random
// results, and check that each roll lands showing the result it was rigged to.

interface RollReport {
  wanted: number[]
  shown: number[]
  ok: boolean
}

declare global {
  interface Window {
    __dice3d?: { stage: DiceStage; rollAll: () => Promise<RollReport> }
  }
}

export function Dice3DLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<DiceStage | null>(null)
  const [dice, setDice] = useState<string[]>(['d3', 'd5', 'd7'])
  // Per-shape size adjustment, starting from each shape's own default. Edit these to tune by eye.
  const [scales, setScales] = useState<Record<string, number>>(() =>
    Object.fromEntries(Object.entries(SHAPES).map(([name, shape]) => [name, shape.scale])),
  )
  // How big the dice are drawn, in stage units (the real app would pick this to fit its panel).
  const [dieSize, setDieSize] = useState(3)
  const [report, setReport] = useState<RollReport | null>(null)
  const [rolling, setRolling] = useState(false)

  useEffect(() => {
    const stage = new DiceStage(canvasRef.current!)
    stageRef.current = stage
    const onResize = () => stage.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      stage.dispose()
      stageRef.current = null
    }
  }, [])

  // Keep the stage's dice in step with the chosen list.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    stage.clear()
    // The two dice of a d100 are the d10's shape, so they follow the d10's size.
    const sizes = { ...scales, 'd10 percentile': scales.d10, 'd10 units': scales.d10 }
    dice.forEach((name) => {
      stage.addRoll(name, { size: dieSize }, sizes)
    })
    // Set the dice down in a row (two rows once there are many), a little above the floor, and let
    // them fall and come to rest so there is something natural to see before the first roll.
    const count = stage.diceList.length
    const rows = count > 5 ? 2 : 1
    const columns = Math.ceil(count / rows)
    // Each row is laid out left to right with the dice's own widths, so big dice get more room.
    const gap = 0.9
    const xs: number[] = []
    for (let row = 0; row < rows; row++) {
      const inRow = stage.diceList.slice(row * columns, (row + 1) * columns)
      const total = inRow.reduce((sum, die) => sum + 2 * die.radius, 0) + gap * (inRow.length - 1)
      let x = -total / 2
      inRow.forEach((die) => {
        xs.push(x + die.radius)
        x += 2 * die.radius + gap
      })
    }
    stage.diceList.forEach((die, i) => {
      const row = Math.floor(i / columns)
      const z = rows === 1 ? 0 : (row - 0.5) * 6.4
      die.body.position.set(xs[i], rows === 1 ? 4 : die.radius * 1.1 + 0.4, z)
      die.body.quaternion.setFromEuler(Math.random() * 0.8, Math.random() * Math.PI, Math.random() * 0.8)
      die.syncMesh()
    })
    stage.settle()
  }, [dice, scales, dieSize])

  async function rollAll(): Promise<RollReport> {
    const stage = stageRef.current!
    setRolling(true)
    const wanted = stage.rollSides.map((sides) => 1 + Math.floor(Math.random() * sides))
    await stage.roll(wanted)
    const shown = stage.readResults()
    const result = { wanted, shown, ok: wanted.every((w, i) => w === shown[i]) }
    setReport(result)
    setRolling(false)
    return result
  }

  useEffect(() => {
    if (stageRef.current) window.__dice3d = { stage: stageRef.current, rollAll }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })

  return (
    <main style={{ padding: 16, color: '#fff', fontFamily: 'var(--font-ui)' }}>
      <div
        style={{
          position: 'relative',
          width: 'min(100%, 1120px)',
          height: 'min(66vh, 680px)',
          borderRadius: 12,
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #b07bff, #3ad0ff 55%, #4de88a)',
        }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 0' }}>
        {Object.keys(ROLLABLES).map((name) => (
          <button key={name} onClick={() => setDice((d) => [...d, name].slice(-5))}>
            + {name}
          </button>
        ))}
        <button
          onClick={() => {
            setDieSize(1.4)
            setDice(Object.keys(ROLLABLES))
          }}
        >
          Show all
        </button>
        <button onClick={() => setDice([])}>Clear</button>
        <button onClick={() => void rollAll()} disabled={rolling || dice.length === 0}>
          Roll
        </button>
      </div>
      <label style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
        Dice size{' '}
        <input
          type="number"
          step={0.25}
          min={1}
          max={6}
          value={dieSize}
          style={{ width: 64 }}
          onChange={(e) => {
            const next = Number(e.target.value)
            if (next > 0) setDieSize(next)
          }}
        />
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
        {Object.keys(SHAPES)
          .filter((name) => !name.startsWith('d10 '))
          .map((name) => (
          <label key={name} style={{ fontSize: 13 }}>
            {name} size{' '}
            <input
              type="number"
              step={0.05}
              min={0.3}
              max={2}
              value={scales[name]}
              style={{ width: 64 }}
              onChange={(e) => {
                const next = Number(e.target.value)
                if (next > 0) setScales((s) => ({ ...s, [name]: next }))
              }}
            />
          </label>
        ))}
      </div>
      <p>Dice: {dice.join(', ') || 'none'}</p>
      {report && (
        <p>
          Rigged to: {report.wanted.join(', ')}. Showing: {report.shown.join(', ')}.{' '}
          {report.ok ? 'Match' : 'MISMATCH'}
        </p>
      )}
    </main>
  )
}
