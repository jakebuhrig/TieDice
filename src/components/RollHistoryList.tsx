import { formatRoll, type RollRecord } from '../dice'

interface RollHistoryListProps {
  rolls: RollRecord[]
}

export function RollHistoryList({ rolls }: RollHistoryListProps) {
  if (rolls.length === 0) {
    return <p className="hint">No rolls yet.</p>
  }

  // Most recent first.
  const ordered = [...rolls].reverse()

  return (
    <ul className="roll-history" aria-live="polite" aria-label="Roll history">
      {ordered.map((roll) => (
        <li key={roll.id} className={roll.hidden ? 'hidden-roll' : undefined}>
          <span className="roll-who">
            <span className="roll-player" style={{ color: roll.playerColor }}>
              {roll.playerName}
            </span>
            {roll.hidden && <span className="sr-only">Hidden roll</span>}
            <span className="roll-breakdown">{formatRoll(roll.dice, roll.modifier)}</span>
          </span>
          <span className="roll-total">
            <span className="sr-only">Total </span>
            {roll.total}
          </span>
        </li>
      ))}
    </ul>
  )
}
