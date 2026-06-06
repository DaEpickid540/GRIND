import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Rolldown (Vite 8) requires manualChunks as a function
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|react-is)\//.test(id)) return 'react-vendor';
          if (/node_modules\/@firebase\/(app|auth|firestore)/.test(id)) return 'firebase-core';
          if (/node_modules\/(recharts)/.test(id)) return 'charts';
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
})
