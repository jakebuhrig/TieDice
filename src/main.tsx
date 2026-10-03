import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/host-grotesk/400.css'
import '@fontsource/host-grotesk/500.css'
import '@fontsource/host-grotesk/600.css'
import '@fontsource/host-grotesk/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/700.css'
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
