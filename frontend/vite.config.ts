/** was: @type {import('vite').UserConfig} */
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
          manualChunks(id: string) {
            if (!id) return
            if (!id.includes('node_modules')) return
            // group specific large packages into their own chunk
            if (id.includes('node_modules/react')) return 'vendor-react'
            if (id.includes('node_modules/@codemirror') || id.includes('node_modules/@uiw/react-codemirror')) return 'vendor-codemirror'
            if (id.includes('node_modules/xterm')) return 'vendor-xterm'
            if (id.includes('node_modules/prismjs')) return 'vendor-prism'
            // For pdfjs-dist, distribute modules across several vendor chunks to avoid one huge file
            if (id.includes('node_modules/pdfjs-dist')) {
              // simple hash on the module path to spread files across 3 chunks
              let hash = 0
              for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i)
              const bucket = Math.abs(hash) % 3
              return `vendor-pdfjs-dist-${bucket}`
            }
            // split large commonly-used libs into separate chunks by package name
            const match = id.match(/node_modules\/([^\/]+)\//)
            if (match && match[1]) {
              const pkg = match[1].replace('@', '')
              return `vendor-${pkg}`
            }
            return 'vendor'
          }
        }
    }
  }
})
