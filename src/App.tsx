import { useEffect, useMemo, useRef, useState } from 'react'
import { isMock, obr } from './obr'
import './App.css'
import { DiceTray } from './components/DiceTray'
import { DevBar } from './components/DevBar'
import { LastRoll } from './components/LastRoll'
import { Logo } from './components/Logo'
import { MovingGradient } from './components/MovingGradient'
import { RollHistoryList } from './components/RollHistoryList'
import { ViewControls } from './components/ViewControls'
import { rollTotal, rollTray, type DieSize, type RollRecord, type Tray } from './dice'
import { useDicePreviews } from './useDicePreviews'
import { useGradientPaused } from './useGradientPaused'
import { useOwlbearPlayer } from './useOwlbearPlayer'
import { useRollHistory } from './useRollHistory'
import { useTrippy } from './useTrippy'

const MAX_LOCAL_HIDDEN = 20

function App() {
  const { ready, role, playerId, playerName, playerColor } = useOwlbearPlayer()
  const { history, appendPublicRoll } = useRollHistory()
  const [gradientPaused, toggleGradientPaused] = useGradientPaused()
  const [trippy, toggleTrippy] = useTrippy()
  const dicePreviews = useDicePreviews()
  const selectTrippy = (next: boolean) => {
    if (next !== trippy) toggleTrippy()
  }

  const [tray, setTray] = useState<Tray>([])
  // A flat amount added to the next roll's total; it goes back to 0 after every roll.
  const [modifier, setModifier] = useState(0)
  const [hidden, setHidden] = useState(false)
  // Hidden rolls are never written to room metadata or broadcast — they only ever
  // exist in the GM's own local state (see GLOSSARY.md: Hidden Roll).
  const [hiddenRolls, setHiddenRolls] = useState<RollRecord[]>([])
  // The roll currently being revealed in the last-roll card. It is only published to the room (or
  // the GM-only log) once the number lands, so nobody sees the result before the roller does.
  const [rolling, setRolling] = useState<RollRecord | null>(null)
  const rollingRef = useRef<RollRecord | null>(null)
  // What the card shows once a reveal finishes, until history catches up.
  const [lastRolled, setLastRolled] = useState<RollRecord | null>(null)

  const stagedCount = tray.reduce((sum, entry) => sum + entry.count, 0)

  const visibleHistory = useMemo(() => {
    if (role !== 'GM') return history
    return [...history, ...hiddenRolls].sort((a, b) => a.rolledAt - b.rolledAt)
  }, [history, hiddenRolls, role])

  const myLastRoll = useMemo(
    () => [...visibleHistory].reverse().find((r) => r.playerId === playerId),
    [visibleHistory, playerId],
  )

  function addDie(size: DieSize) {
    setTray((prev) =>
      prev.some((entry) => entry.size === size)
        ? prev.map((entry) => (entry.size === size ? { ...entry, count: entry.count + 1 } : entry))
        : [...prev, { size, count: 1 }],
    )
  }

  function removeDie(size: DieSize) {
    setTray((prev) =>
      prev
        .map((entry) => (entry.size === size ? { ...entry, count: entry.count - 1 } : entry))
        .filter((entry) => entry.count > 0),
    )
  }

  function publish(record: RollRecord) {
    if (record.hidden) {
      setHiddenRolls((prev) => [...prev, record].slice(-MAX_LOCAL_HIDDEN))
    } else {
      void appendPublicRoll(record)
    }
  }

  function handleLanded(record: RollRecord) {
    // The pagehide flush may already have published this roll; never publish it twice.
    const stillPending = rollingRef.current?.id === record.id
    rollingRef.current = null
    if (stillPending) publish(record)
    setLastRolled(record)
    setRolling(null)
  }

  // If the popover closes mid-reveal, publish right away so the roll is never lost.
  useEffect(() => {
    const flush = () => {
      const pending = rollingRef.current
      if (!pending) return
      rollingRef.current = null
      publish(pending)
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function roll() {
    if (stagedCount === 0 || rolling) return
    const dice = rollTray(tray)
    const record: RollRecord = {
      id: crypto.randomUUID(),
      playerId,
      playerName,
      playerColor,
      dice,
      modifier,
      total: rollTotal(dice, modifier),
      hidden: hidden && role === 'GM',
      rolledAt: Date.now(),
    }

    setTray([])
    setModifier(0)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // No reveal animation for people who prefer reduced motion: show and publish immediately.
      publish(record)
      setLastRolled(record)
      return
    }
    rollingRef.current = record
    setRolling(record)
  }

  if (!obr.isAvailable) {
    return (
      <main className="app">
        <Logo />
        <p>Not running inside Owlbear Rodeo.</p>
        <p className="hint">
          Add this extension via <code>http://localhost:5173/manifest.json</code> in
          an Owlbear Rodeo room to test it.
        </p>
      </main>
    )
  }

  if (!ready) {
    return (
      <main className="app">
        <Logo />
        <p>Connecting&hellip;</p>
      </main>
    )
  }

  return (
    <main className={trippy ? 'app' : 'app is-calm'}>
      <MovingGradient paused={gradientPaused} view={trippy ? 'trippy' : 'calm'} />
      {isMock && <DevBar />}
      <header className="app-header">
        <Logo />
        <ViewControls
          trippy={trippy}
          onSelectTrippy={selectTrippy}
          paused={gradientPaused}
          onTogglePaused={toggleGradientPaused}
        />
      </header>
      <div className="workspace">
        <DiceTray
          previews={dicePreviews}
          onAdd={addDie}
          modifier={modifier}
          onModifierChange={setModifier}
          showHiddenToggle={role === 'GM'}
          hidden={hidden}
          onHiddenChange={setHidden}
        />
        <div className="main-column">
          <LastRoll
            roll={lastRolled ?? myLastRoll}
            rolling={rolling}
            tray={tray}
            onRemove={removeDie}
            onClear={() => setTray([])}
            onRoll={roll}
            onLanded={handleLanded}
          />
          <section className="history-section">
            <h2>Roll History</h2>
            <RollHistoryList rolls={visibleHistory} />
          </section>
        </div>
      </div>
    </main>
  )
}

export default App
