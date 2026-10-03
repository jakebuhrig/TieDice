interface MotionToggleProps {
  paused: boolean
  onToggle: () => void
}

export function MotionToggle({ paused, onToggle }: MotionToggleProps) {
  const label = paused ? 'Play background animation' : 'Pause background animation'

  return (
    <button type="button" className="motion-toggle" onClick={onToggle} aria-label={label} title={label}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        {paused ? (
          <path d="M4.5 2.8v10.4a.6.6 0 0 0 .92.5l8.2-5.2a.6.6 0 0 0 0-1L5.42 2.3a.6.6 0 0 0-.92.5Z" />
        ) : (
          <>
            <rect x="3.5" y="2.5" width="3" height="11" rx="1" />
            <rect x="9.5" y="2.5" width="3" height="11" rx="1" />
          </>
        )}
      </svg>
    </button>
  )
}
