import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/health': {
        target: 'http://127.0.0.1:8443',
        changeOrigin: true,
        secure: false
      },
      '/api': {
        target: 'http://127.0.0.1:8443',
        changeOrigin: true,
        secure: false
      },
      '/openapi.yaml': {
        target: 'http://127.0.0.1:8443',
        changeOrigin: true,
        secure: false
      },
      '/ws': {
        target: 'ws://127.0.0.1:8443',
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist'
  }
})
