import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Owlbear Rodeo loads this dev server inside an iframe; Vite 6.0.9+
    // disables cross-origin access by default, so it must be allowed explicitly.
    cors: {
      origin: 'https://www.owlbear.rodeo',
    },
  },
})
