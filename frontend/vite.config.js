// Vite build configuration: keep framework plugins and future dev-server settings here.
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  oxc: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
}))
