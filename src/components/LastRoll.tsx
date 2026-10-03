import { formatRoll, type RollRecord } from '../dice'

interface LastRollProps {
  roll: RollRecord | undefined
}

export function LastRoll({ roll }: LastRollProps) {
  return (
    <section className="last-roll" aria-live="polite" aria-label="Your last roll">
      {roll ? (
        <>
          <div className="last-roll-total">{roll.total}</div>
          <div className="last-roll-breakdown">
            {roll.hidden && (
              <span role="img" aria-label="Hidden roll" title="Hidden roll">
                &#128274;{' '}
              </span>
            )}
            {formatRoll(roll.dice)}
          </div>
        </>
      ) : (
        <p className="hint">Your last roll will show here.</p>
      )}
    </section>
  )
}
