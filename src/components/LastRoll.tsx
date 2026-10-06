import { useEffect, useRef, useState } from 'react'
import { formatRoll, type RollRecord, type Tray } from '../dice'
import { useDiceStage } from '../useDiceStage'
import { StagedDice } from './DiceTray'

interface LastRollProps {
  roll: RollRecord | undefined
  rolling: RollRecord | null
  // The dice staged to roll, shown over the card with the Roll and Clear buttons.
  tray: Tray
  onRemove: (size: Tray[number]['size']) => void
  onClear: () => void
  onRoll: () => void
  onLanded: (record: RollRecord) => void
}

// Reveal timing: the pill fades, then the dice are thrown and the total fades in once they have come
// to rest. The pill fade should match the roll button's opacity transition in App.css.
const LEAVE_MS = 90

type Phase = 'idle' | 'leaving' | 'throwing'

// The last-roll card: the dice tumble across it, and come to rest showing what was rolled. The total
// sits quietly underneath for ease of use. When dice are staged, the previous result blurs back and
// the Roll button takes its place in the card.
export function LastRoll({ roll, rolling, tray, onRemove, onClear, onRoll, onLanded }: LastRollProps) {
  const canRoll = tray.length > 0
  // The dice the overlay shows. A roll empties the tray at once, but the overlay takes a moment to
  // fade, so it keeps showing the dice that were rolled until it has gone.
  const [lastStaged, setLastStaged] = useState(tray)
  if (canRoll && tray !== lastStaged) setLastStaged(tray)
  const { canvasRef, prepare, throwDice } = useDiceStage()
  // Which roll the throw has started for. Until then a roll in progress counts as "leaving".
  const [throwingId, setThrowingId] = useState<string | null>(null)
  // The roll whose total has just appeared; it gets the landing pop.
  const [landedId, setLandedId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  // Which roll the dice on the stage are showing.
  const stagedId = useRef<string | null>(null)
  const onLandedRef = useRef(onLanded)

  useEffect(() => {
    onLandedRef.current = onLanded
  }, [onLanded])

  // Load the 3D code as soon as dice are staged, so it is ready by the time Roll is pressed.
  useEffect(() => {
    if (canRoll) void prepare()
  }, [canRoll, prepare])

  useEffect(() => {
    if (!rolling) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      setAnnouncement('')
      setThrowingId(rolling.id)
      stagedId.current = rolling.id
      void throwDice(rolling.dice, false)
        .catch(() => undefined)
        .then(() => {
          if (cancelled) return
          setThrowingId(null)
          setLandedId(rolling.id)
          setAnnouncement(`Rolled ${rolling.total}`)
          onLandedRef.current(rolling)
        })
    }, LEAVE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [rolling, throwDice])

  // A result that is not being thrown (the roll saved from before the panel was opened, or any roll
  // when motion is reduced) is simply shown, with its dice at rest.
  useEffect(() => {
    if (!roll || rolling || stagedId.current === roll.id) return
    void throwDice(roll.dice, true)
      .then((shown) => {
        if (shown) stagedId.current = roll.id
      })
      .catch(() => undefined)
  }, [roll, rolling, throwDice])

  const phase: Phase = !rolling ? 'idle' : throwingId === rolling.id ? 'throwing' : 'leaving'
  const revealing = phase !== 'idle'
  const throwing = phase === 'throwing'
  const showPill = (canRoll && !revealing) || phase === 'leaving'
  const blurred = canRoll && !revealing
  // The total stays out of sight until the dice have landed, so it never gives the result away.
  const pending = revealing

  return (
    <section className="last-roll" aria-label="Your last roll">
      <div className={blurred ? 'last-roll-content is-blurred' : 'last-roll-content'}>
        <canvas ref={canvasRef} className="last-roll-dice" aria-hidden="true" />
        {roll || throwing ? (
          <div className={pending ? 'last-roll-caption is-pending' : 'last-roll-caption'}>
            <div className="last-roll-breakdown">
              {roll && (
                <>
                  {roll.hidden && <span className="sr-only">Hidden roll. </span>}
                  {formatRoll(roll.dice, roll.modifier)}
                </>
              )}
            </div>
            <div
              className={
                !pending && roll?.id === landedId ? 'last-roll-total is-landed' : 'last-roll-total'
              }
            >
              {roll?.total}
            </div>
          </div>
        ) : (
          <p className="hint last-roll-hint">Your last roll will show here.</p>
        )}
      </div>
      <div className="sr-only" role="status">
        {announcement}
      </div>
      {showPill && (
        <div
          className={phase === 'leaving' ? 'roll-overlay is-leaving' : 'roll-overlay'}
          inert={phase === 'leaving'}
        >
          <StagedDice tray={phase === 'leaving' ? lastStaged : tray} onRemove={onRemove} />
          <div className="roll-slot">
            <button type="button" className="roll-button" onClick={onRoll}>
              Roll the dice
            </button>
          </div>
          <div className="roll-slot">
            <button type="button" className="clear-button" onClick={onClear} aria-label="Clear all staged dice">
              Clear
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
