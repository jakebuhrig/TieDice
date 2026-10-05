import { useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { formatModifier, MAX_MODIFIER } from '../dice'

interface ModifierInputProps {
  value: number
  onChange: (value: number) => void
}

const clamp = (n: number) => Math.max(-MAX_MODIFIER, Math.min(MAX_MODIFIER, n))

// What the person has typed, e.g. "-", "+4", "12"; empty or a lone sign means no number yet.
const parseDraft = (draft: string): number | null => {
  const n = Number.parseInt(draft, 10)
  return Number.isNaN(n) ? null : n
}

// The modifier's number, editable in place. While focused it shows exactly what is typed (so "-"
// can be the first keystroke of "-3"); otherwise it shows the signed value.
export function ModifierInput({ value, onChange }: ModifierInputProps) {
  const [draft, setDraft] = useState<string | null>(null)

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.value
    // A sign (optional) followed by at most two digits, which is also the ±99 limit.
    if (!/^[+-]?\d{0,2}$/.test(next)) return
    setDraft(next)
    // Apply as they type, so a roll started without leaving the field still uses it. An empty
    // field or a lone sign counts as 0.
    onChange(clamp(parseDraft(next) ?? 0))
  }

  function handleBlur() {
    setDraft(null)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(clamp(value + (e.key === 'ArrowUp' ? 1 : -1)))
      setDraft(null)
    }
  }

  // The typed text only counts while it still matches the real value; once the value changes
  // elsewhere (the −/+ buttons, or the reset after a roll) the field shows the real value.
  const shown = draft !== null && (parseDraft(draft) ?? 0) === value ? draft : formatModifier(value)

  return (
    <input
      type="text"
      className="modifier-value"
      aria-label="Modifier value"
      autoComplete="off"
      spellCheck={false}
      value={shown}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onFocus={(e) => e.currentTarget.select()}
      // Keeps the click from undoing the select-all on focus.
      onMouseUp={(e) => e.preventDefault()}
    />
  )
}
