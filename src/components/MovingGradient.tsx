import { useEffect, useRef } from 'react'
import { startMovingGradient, type GradientController } from '../movingGradient'

interface MovingGradientProps {
  paused: boolean
}

export function MovingGradient({ paused }: MovingGradientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controllerRef = useRef<GradientController | null>(null)
  const initialPaused = useRef(paused)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const controller = startMovingGradient(canvas, { paused: initialPaused.current })
    controllerRef.current = controller
    return () => {
      controller.destroy()
      controllerRef.current = null
    }
  }, [])

  useEffect(() => {
    controllerRef.current?.setPaused(paused)
  }, [paused])

  return (
    <div className="gradient-bg" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  )
}
