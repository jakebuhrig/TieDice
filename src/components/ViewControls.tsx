interface ViewControlsProps {
  trippy: boolean
  onSelectTrippy: (trippy: boolean) => void
  paused: boolean
  onTogglePaused: () => void
}

// Icons from Lucide (ISC license): https://lucide.dev
function SparklesIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
      <path d="M20 2v4" />
      <path d="M22 4h-4" />
      <circle cx="4" cy="20" r="2" />
    </svg>
  )
}

function MoonIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
    </svg>
  )
}

// Two round glass buttons. The view button shows the current view (sparkles for Trippy, the moon
// for Calm), and its label says what a click will do. The pause button shows the action instead.
export function ViewControls({ trippy, onSelectTrippy, paused, onTogglePaused }: ViewControlsProps) {
  const viewLabel = trippy ? 'Switch to the Calm background' : 'Switch to the Trippy background'
  const pauseLabel = paused ? 'Play background animation' : 'Pause background animation'

  return (
    <div className="view-controls">
      <button
        type="button"
        className="motion-toggle glass-control"
        onClick={() => onSelectTrippy(!trippy)}
        aria-label={viewLabel}
        title={viewLabel}
      >
        {/* Both icons stay mounted and stacked; the inactive one is faded out so the swap can animate. */}
        <SparklesIcon className={trippy ? 'motion-icon is-active' : 'motion-icon'} />
        <MoonIcon className={trippy ? 'motion-icon' : 'motion-icon is-active'} />
      </button>
      <button
        type="button"
        className="motion-toggle glass-control"
        onClick={onTogglePaused}
        aria-label={pauseLabel}
        title={pauseLabel}
      >
        <svg
          className={paused ? 'motion-icon' : 'motion-icon is-active'}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <rect x="3.5" y="2.5" width="3" height="11" rx="1" />
          <rect x="9.5" y="2.5" width="3" height="11" rx="1" />
        </svg>
        <svg
          className={paused ? 'motion-icon is-active' : 'motion-icon'}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M4.5 2.8v10.4a.6.6 0 0 0 .92.5l8.2-5.2a.6.6 0 0 0 0-1L5.42 2.3a.6.6 0 0 0-.92.5Z" />
        </svg>
      </button>
    </div>
  )
}
