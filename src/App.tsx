import { useEffect, useState } from 'react'
import OBR, { type Player } from '@owlbear-rodeo/sdk'
import './App.css'

function App() {
  const [ready, setReady] = useState(false)
  const [role, setRole] = useState<Player['role'] | null>(null)

  useEffect(() => {
    if (!OBR.isAvailable) return

    return OBR.onReady(async () => {
      setReady(true)
      setRole(await OBR.player.getRole())
    })
  }, [])

  if (!OBR.isAvailable) {
    return (
      <main className="status">
        <h1>ZocchiDice</h1>
        <p>Not running inside Owlbear Rodeo.</p>
        <p className="hint">
          Add this extension via <code>http://localhost:5173/manifest.json</code> in
          an Owlbear Rodeo room to test it.
        </p>
      </main>
    )
  }

  return (
    <main className="status">
      <h1>ZocchiDice</h1>
      <p>{ready ? 'Connected to Owlbear Rodeo' : 'Connecting…'}</p>
      {role && <p className="hint">Signed in as {role}</p>}
    </main>
  )
}

export default App
