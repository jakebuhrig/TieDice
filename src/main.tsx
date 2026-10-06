import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import './index.css'
import App from './App.tsx'
import { isMock } from './obr'

const root = createRoot(document.getElementById('root')!)

// Development only: /?dice3d opens a page for trying the 3D dice. The branch is removed from
// production builds, so none of the 3D code ships.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('dice3d')) {
  void import('./dice3d/Dice3DLab').then(({ Dice3DLab }) => root.render(<Dice3DLab />))
} else {
  // Local preview only: frame the app at the size of the Owlbear Rodeo popover.
  if (isMock) document.body.classList.add('is-mock')

  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
