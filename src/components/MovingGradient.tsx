import { useEffect, useRef } from 'react'
import { startMovingGradient, type GradientController, type GradientView } from '../movingGradient'

interface MovingGradientProps {
  paused: boolean
  view: GradientView
}

export function MovingGradient({ paused, view }: MovingGradientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controllerRef = useRef<GradientController | null>(null)
  const initial = useRef({ paused, view })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const controller = startMovingGradient(canvas, initial.current)
    controllerRef.current = controller
    return () => {
      controller.destroy()
      controllerRef.current = null
    }
  }, [])

  useEffect(() => {
    controllerRef.current?.setPaused(paused)
  }, [paused])

  useEffect(() => {
    controllerRef.current?.setView(view)
  }, [view])

  return (
    <div className="gradient-bg" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  )
}
