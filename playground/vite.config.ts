import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'playground',
  plugins: [react()],
  server: {
    // The app runs in a sandboxed iframe with an opaque origin, so its module
    // requests to the dev server are cross-origin and need CORS headers.
    cors: true,
  },
})
