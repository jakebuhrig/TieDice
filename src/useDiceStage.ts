import { useCallback, useEffect, useRef, useState } from 'react'
import type { DieResult } from './dice'
import type { DiceStage } from './dice3d/DiceStage'

// Owns the 3D stage behind the last-roll card. The three.js code is a separate chunk that loads the
// first time it is wanted (see `prepare`), so the panel opens as fast as it did before.
class StageSession {
  private stage: DiceStage | null = null
  private loading: Promise<DiceStage | null> | null = null
  // Bumped on dispose, so a stage that finishes loading after the panel unmounted is never built.
  private generation = 0
  // Whether a throw is playing; the dice on the stage must not be swapped out from under it.
  private throwing = false

  // Loads the 3D code and builds the stage; resolves to null if there is no WebGL to draw with.
  prepare(canvas: HTMLCanvasElement | null): Promise<DiceStage | null> {
    const mine = this.generation
    this.loading ??= import('./dice3d/DiceStage')
      .then(({ DiceStage }) => {
        if (!canvas || this.generation !== mine) return null
        this.stage = new DiceStage(canvas, { fitToCanvas: true, fov: 16, zoomOut: 1.5, speed: 1.5 })
        return this.stage
      })
      .catch(() => null)
    return this.loading
  }

  resize() {
    this.stage?.resize()
  }

  dispose() {
    this.stage?.dispose()
    this.stage = null
    this.loading = null
    this.generation++
  }

  // Throws the dice so they land showing `dice`; resolves when they have come to rest. With `instant`
  // they are just set down. Resolves to whether the dice were shown: false if the 3D stage is
  // unavailable, or if an instant request arrived while a throw was still playing.
  async throwDice(canvas: HTMLCanvasElement | null, dice: DieResult[], instant: boolean): Promise<boolean> {
    const stage = await this.prepare(canvas)
    if (!stage || (instant && this.throwing)) return false
    if (instant) {
      await stage.rollDice(dice, { instant })
      return true
    }
    this.throwing = true
    try {
      await stage.rollDice(dice)
    } finally {
      this.throwing = false
    }
    return true
  }
}

export function useDiceStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [session] = useState(() => new StageSession())

  useEffect(() => {
    const observer = new ResizeObserver(() => session.resize())
    if (canvasRef.current) observer.observe(canvasRef.current)
    return () => {
      observer.disconnect()
      session.dispose()
    }
  }, [session])

  const prepare = useCallback(() => session.prepare(canvasRef.current), [session])
  const throwDice = useCallback(
    (dice: DieResult[], instant: boolean) => session.throwDice(canvasRef.current, dice, instant),
    [session],
  )

  return { canvasRef, prepare, throwDice }
}
