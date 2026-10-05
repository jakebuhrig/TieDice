import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import './index.css'
import App from './App.tsx'
import { isMock } from './obr'

// Local preview only: frame the app at the size of the Owlbear Rodeo popover.
if (isMock) document.body.classList.add('is-mock')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
