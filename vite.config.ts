// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/mx/',
  plugins: [react()],
  assetsInclude: ['**/*.xlsx'],
  server: {
    port: 5174,
    proxy: {
      // Dual-dev con Chile: Chile API = :4000, México API = :4001
      // (Chile vite ya proxea /mx/api → :4001)
      '/mx/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/mx/, ''),
      },
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
    },
  },
})

