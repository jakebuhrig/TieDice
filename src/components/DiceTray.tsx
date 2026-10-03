import { SUPPORTED_DICE, type DieSize, type Tray } from '../dice'

interface DiceTrayProps {
  tray: Tray
  onAdd: (size: DieSize) => void
  onRemove: (size: DieSize) => void
  onClear: () => void
  onRoll: () => void
  canRoll: boolean
  showHiddenToggle: boolean
  hidden: boolean
  onHiddenChange: (hidden: boolean) => void
}

export function DiceTray({
  tray,
  onAdd,
  onRemove,
  onClear,
  onRoll,
  canRoll,
  showHiddenToggle,
  hidden,
  onHiddenChange,
}: DiceTrayProps) {
  const staged = tray

  return (
    <div className="dice-tray">
      <div className="die-buttons">
        {SUPPORTED_DICE.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => onAdd(size)}
            aria-label={`Add a d${size} to the roll`}
          >
            d{size}
          </button>
        ))}
      </div>

      <div className="staged-dice" role="group" aria-label="Dice staged to roll">
        {staged.map(({ size, count }) => (
          <button
            key={size}
            type="button"
            className="staged-die"
            onClick={() => onRemove(size)}
            aria-label={`${count}d${size} staged. Remove one d${size}`}
            title="Click to remove one"
          >
            {count}d{size} <span aria-hidden="true">&times;</span>
          </button>
        ))}
        {staged.length > 0 && (
          <button
            type="button"
            className="clear-button"
            onClick={onClear}
            aria-label="Clear all staged dice"
          >
            Clear
          </button>
        )}
      </div>

      {showHiddenToggle && (
        <label className="hidden-card">
          <span>Hidden roll (GM only)</span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={hidden}
            onChange={(e) => onHiddenChange(e.target.checked)}
          />
        </label>
      )}

      <div className="tray-actions">
        <button type="button" className="roll-button" onClick={onRoll} disabled={!canRoll}>
          Roll
        </button>
      </div>
    </div>
  )
}
