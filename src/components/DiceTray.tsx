import removeIcon from '../assets/remove.svg'
import { MAX_MODIFIER, MIN_MODIFIER, SUPPORTED_DICE, type DieSize, type Tray } from '../dice'
import { ModifierInput } from './ModifierInput'

interface DiceTrayProps {
  tray: Tray
  // A picture of each die (showing its highest face), by die size, as they become ready.
  previews: Record<number, string>
  onAdd: (size: DieSize) => void
  onRemove: (size: DieSize) => void
  onClear: () => void
  modifier: number
  onModifierChange: (modifier: number) => void
  showHiddenToggle: boolean
  hidden: boolean
  onHiddenChange: (hidden: boolean) => void
}

// Whole-pixel bars so the icons stay crisp at 16px.
function MinusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="3" y="7" width="10" height="2" rx="1" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="3" y="7" width="10" height="2" rx="1" />
      <rect x="7" y="3" width="2" height="10" rx="1" />
    </svg>
  )
}

// Icons from Lucide (ISC license): https://lucide.dev
function EyeIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeClosedIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m15 18-.722-3.25" />
      <path d="M2 8a10.645 10.645 0 0 0 20 0" />
      <path d="m20 15-1.726-2.05" />
      <path d="m4 15 1.726-2.05" />
      <path d="m9 18 .722-3.25" />
    </svg>
  )
}

export function DiceTray({
  tray,
  previews,
  onAdd,
  onRemove,
  onClear,
  modifier,
  onModifierChange,
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
            title={`d${size}`}
          >
            {previews[size] ? (
              <img className="die-preview" src={previews[size]} alt="" width={44} height={44} />
            ) : (
              <>d{size}</>
            )}
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

      <div className={showHiddenToggle ? 'tray-options' : 'tray-options is-solo'}>
        <div className="modifier-card" role="group" aria-labelledby="modifier-label">
          <span id="modifier-label">Modifier</span>
          <div className="modifier-controls">
            <button
              type="button"
              className="modifier-button"
              onClick={() => onModifierChange(modifier - 1)}
              disabled={modifier <= MIN_MODIFIER}
              aria-label="Decrease modifier"
            >
              <MinusIcon />
            </button>
            <ModifierInput value={modifier} onChange={onModifierChange} />
            <button
              type="button"
              className="modifier-button"
              onClick={() => onModifierChange(modifier + 1)}
              disabled={modifier >= MAX_MODIFIER}
              aria-label="Increase modifier"
            >
              <PlusIcon />
            </button>
          </div>
        </div>

        {showHiddenToggle && (
          <label className="hidden-card">
            <span>Secret roll</span>
            {/* The icon sits in the track's empty side: open eye when off, closed eye when on. */}
            <span className="switch-wrap">
              <input
                type="checkbox"
                role="switch"
                className="switch"
                checked={hidden}
                onChange={(e) => onHiddenChange(e.target.checked)}
              />
              <EyeIcon className="switch-icon switch-icon-off" />
              <EyeClosedIcon className="switch-icon switch-icon-on" />
            </span>
          </label>
        )}
      </div>
    </div>
  )
}
