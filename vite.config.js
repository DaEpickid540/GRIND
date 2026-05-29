import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Vite 8 uses Rolldown — vendor splitting via output.advancedChunks.groups
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'react-vendor',  test: /node_modules\/(react|react-dom|react-is)\// },
            { name: 'firebase-core', test: /node_modules\/@firebase\/(app|auth|firestore)/ },
            { name: 'charts',        test: /node_modules\/(recharts|d3-|victory)/ },
          ],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
})
