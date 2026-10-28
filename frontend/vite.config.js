import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward /api/* to the Express backend so the frontend can use relative URLs
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})
