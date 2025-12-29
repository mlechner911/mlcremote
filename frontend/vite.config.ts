import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5179,
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
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id) return
          if (id.includes('node_modules')) {
            if (id.includes('@codemirror') || id.includes('@uiw/react-codemirror')) return 'vendor-codemirror'
            if (id.includes('xterm')) return 'vendor-xterm'
            if (id.includes('prismjs')) return 'vendor-prism'
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react'
            return 'vendor'
          }
        }
      }
    }
  }
})
