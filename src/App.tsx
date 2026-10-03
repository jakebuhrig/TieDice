import { useMemo, useState } from 'react'
import { isMock, obr } from './obr'
import './App.css'
import { DiceTray } from './components/DiceTray'
import { DevBar } from './components/DevBar'
import { LastRoll } from './components/LastRoll'
import { Logo } from './components/Logo'
import { MotionToggle } from './components/MotionToggle'
import { MovingGradient } from './components/MovingGradient'
import { RollHistoryList } from './components/RollHistoryList'
import { rollTray, type DieSize, type RollRecord, type Tray } from './dice'
import { useGradientPaused } from './useGradientPaused'
import { useOwlbearPlayer } from './useOwlbearPlayer'
import { useRollHistory } from './useRollHistory'

const MAX_LOCAL_HIDDEN = 20

function App() {
  const { ready, role, playerId, playerName, playerColor } = useOwlbearPlayer()
  const { history, appendPublicRoll } = useRollHistory()
  const [gradientPaused, toggleGradientPaused] = useGradientPaused()

  const [tray, setTray] = useState<Tray>([])
  const [hidden, setHidden] = useState(false)
  // Hidden rolls are never written to room metadata or broadcast — they only ever
  // exist in the GM's own local state (see GLOSSARY.md: Hidden Roll).
  const [hiddenRolls, setHiddenRolls] = useState<RollRecord[]>([])

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

  function roll() {
    if (stagedCount === 0) return
    const dice = rollTray(tray)
    const record: RollRecord = {
      id: crypto.randomUUID(),
      playerId,
      playerName,
      playerColor,
      dice,
      total: dice.reduce((sum, d) => sum + d.value, 0),
      hidden: hidden && role === 'GM',
      rolledAt: Date.now(),
    }

    if (record.hidden) {
      setHiddenRolls((prev) => [...prev, record].slice(-MAX_LOCAL_HIDDEN))
    } else {
      void appendPublicRoll(record)
    }
    setTray([])
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
    <main className="app">
      <MovingGradient paused={gradientPaused} />
      {isMock && <DevBar />}
      <header className="app-header">
        <Logo />
        <MotionToggle paused={gradientPaused} onToggle={toggleGradientPaused} />
      </header>
      <DiceTray
        tray={tray}
        onAdd={addDie}
        onRemove={removeDie}
        onClear={() => setTray([])}
        showHiddenToggle={role === 'GM'}
        hidden={hidden}
        onHiddenChange={setHidden}
      />
      <LastRoll roll={myLastRoll} canRoll={stagedCount > 0} onRoll={roll} />
      <section className="history-section">
        <h2>Roll History</h2>
        <RollHistoryList rolls={visibleHistory} />
      </section>
    </main>
  )
}

export default App
