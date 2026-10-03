import { useState } from 'react'
import { mockControls } from '../mockObr'

export function DevBar() {
  const [role, setRole] = useState(mockControls.getRole())

  return (
    <div className="dev-bar">
      <strong>Local preview</strong>
      <label>
        Role{' '}
        <select
          value={role}
          onChange={(e) => {
            const next = e.target.value as 'GM' | 'PLAYER'
            mockControls.setRole(next)
            setRole(next)
          }}
        >
          <option value="GM">GM</option>
          <option value="PLAYER">Player</option>
        </select>
      </label>
      <button type="button" onClick={() => mockControls.simulateOtherPlayerRoll()}>
        Simulate Alice roll
      </button>
    </div>
  )
}
