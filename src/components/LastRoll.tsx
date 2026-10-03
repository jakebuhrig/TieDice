import { formatRoll, type RollRecord } from '../dice'

interface LastRollProps {
  roll: RollRecord | undefined
  canRoll: boolean
  onRoll: () => void
}

// When dice are staged, the previous result blurs back and the Roll button takes its place in the card.
export function LastRoll({ roll, canRoll, onRoll }: LastRollProps) {
  return (
    <section className="last-roll" aria-label="Your last roll">
      <div className={canRoll ? 'last-roll-content is-blurred' : 'last-roll-content'} aria-live="polite">
        {roll ? (
          <>
            <div className="last-roll-total">{roll.total}</div>
            <div className="last-roll-breakdown">
              {roll.hidden && <span className="sr-only">Hidden roll. </span>}
              {formatRoll(roll.dice)}
            </div>
          </>
        ) : (
          <p className="hint">Your last roll will show here.</p>
        )}
      </div>
      {canRoll && (
        <button type="button" className="roll-button" onClick={onRoll}>
          Roll the dice
        </button>
      )}
    </section>
  )
}
