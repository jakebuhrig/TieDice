import { useEffect, useRef, useState } from 'react'
import { formatRoll, totalRange, type RollRecord } from '../dice'

interface LastRollProps {
  roll: RollRecord | undefined
  rolling: RollRecord | null
  canRoll: boolean
  onRoll: () => void
  onLanded: (record: RollRecord) => void
}

// Reveal timing: the pill fades, then the number flickers through plausible totals and decelerates
// onto the real one with a small pop, then the breakdown fades in. About 0.43s from click to landed.
// The pill fade should match the roll button's opacity transition in App.css.
const LEAVE_MS = 90
const FIRST_TICK_MS = 26
// Each tick lasts this many times longer than the one before, so the flicker slows toward the end.
const TICK_SLOWDOWN = 1.25
const SPIN_MS = 340

type Phase = 'idle' | 'leaving' | 'spinning'

function randomTotal(min: number, max: number, avoid: number | null): number {
  if (max <= min) return min
  let value = min + Math.floor(Math.random() * (max - min + 1))
  if (value === avoid) value = value === max ? min : value + 1
  return value
}

// When dice are staged, the previous result blurs back and the Roll button takes its place in the card.
export function LastRoll({ roll, rolling, canRoll, onRoll, onLanded }: LastRollProps) {
  // Which roll the spin has started for. Until then a roll in progress counts as "leaving".
  const [spinningId, setSpinningId] = useState<string | null>(null)
  // The roll whose number has just landed; it gets the landing pop.
  const [landedId, setLandedId] = useState<string | null>(null)
  const [flicker, setFlicker] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const onLandedRef = useRef(onLanded)

  useEffect(() => {
    onLandedRef.current = onLanded
  }, [onLanded])

  useEffect(() => {
    if (!rolling) return

    const { min, max } = totalRange(rolling.dice, rolling.modifier)
    const timers: number[] = []
    let shown: number | null = null

    timers.push(
      window.setTimeout(() => {
        setAnnouncement('')
        // Show a number immediately so the card never flashes empty between the old and new result.
        shown = randomTotal(min, max, null)
        setFlicker(shown)
        setSpinningId(rolling.id)
        let elapsed = 0
        let tick = FIRST_TICK_MS
        while (elapsed < SPIN_MS - tick) {
          elapsed += tick
          timers.push(
            window.setTimeout(() => {
              shown = randomTotal(min, max, shown)
              setFlicker(shown)
            }, elapsed),
          )
          tick *= TICK_SLOWDOWN
        }
        timers.push(
          window.setTimeout(() => {
            setFlicker(null)
            setSpinningId(null)
            setLandedId(rolling.id)
            setAnnouncement(`Rolled ${rolling.total}`)
            onLandedRef.current(rolling)
          }, SPIN_MS),
        )
      }, LEAVE_MS),
    )

    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [rolling])

  const phase: Phase = !rolling ? 'idle' : spinningId === rolling.id ? 'spinning' : 'leaving'
  const revealing = phase !== 'idle'
  const spinning = phase === 'spinning'
  const showPill = (canRoll && !revealing) || phase === 'leaving'
  const blurred = canRoll && !revealing

  return (
    <section className="last-roll" aria-label="Your last roll">
      <div className={blurred ? 'last-roll-content is-blurred' : 'last-roll-content'}>
        {roll || spinning ? (
          <>
            <div
              className={
                !spinning && roll?.id === landedId ? 'last-roll-total is-landed' : 'last-roll-total'
              }
              aria-hidden={spinning}
            >
              {spinning ? flicker : roll?.total}
            </div>
            <div className={spinning ? 'last-roll-breakdown is-pending' : 'last-roll-breakdown'}>
              {spinning ? (
                ' '
              ) : (
                roll && (
                  <>
                    {roll.hidden && <span className="sr-only">Hidden roll. </span>}
                    {formatRoll(roll.dice, roll.modifier)}
                  </>
                )
              )}
            </div>
          </>
        ) : (
          <p className="hint">Your last roll will show here.</p>
        )}
      </div>
      <div className="sr-only" role="status">
        {announcement}
      </div>
      {showPill && (
        <button
          type="button"
          className={phase === 'leaving' ? 'roll-button is-leaving' : 'roll-button'}
          onClick={onRoll}
          tabIndex={phase === 'leaving' ? -1 : undefined}
        >
          Roll the dice
        </button>
      )}
    </section>
  )
}
