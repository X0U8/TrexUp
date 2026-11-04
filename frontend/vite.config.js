import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // allow importing ../agent/server.py?raw (the downloadable engine server)
    fs: { allow: ['..'] },
    proxy: {
      '/api/meta': {
        target: 'https://api.meta.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/meta/, ''),
        timeout: 120000,
        proxyTimeout: 120000,
      },
    },
  },
})
