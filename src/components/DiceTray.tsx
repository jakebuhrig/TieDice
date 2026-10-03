import removeIcon from '../assets/remove.svg'
import { SUPPORTED_DICE, type DieSize, type Tray } from '../dice'

interface DiceTrayProps {
  tray: Tray
  onAdd: (size: DieSize) => void
  onRemove: (size: DieSize) => void
  onClear: () => void
  showHiddenToggle: boolean
  hidden: boolean
  onHiddenChange: (hidden: boolean) => void
}

export function DiceTray({
  tray,
  onAdd,
  onRemove,
  onClear,
  showHiddenToggle,
  hidden,
  onHiddenChange,
}: DiceTrayProps) {
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
        {tray.map(({ size, count }) => (
          <button
            key={size}
            type="button"
            className="staged-die"
            onClick={() => onRemove(size)}
            aria-label={`${count}d${size} staged. Remove one d${size}`}
            title="Click to remove one"
          >
            {count}d{size}
            <img src={removeIcon} alt="" width={16} height={16} />
          </button>
        ))}
        {tray.length > 0 && (
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
          <span>Roll in secret</span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={hidden}
            onChange={(e) => onHiddenChange(e.target.checked)}
          />
        </label>
      )}
    </div>
  )
}
