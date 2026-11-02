import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/meta': {
        target: 'https://api.meta.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/meta/, ''),
      },
    },
  },
})
