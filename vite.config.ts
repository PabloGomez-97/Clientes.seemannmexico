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
      // Con base /mx/, el fetch patch manda a /mx/api → API local (mismo puerto default 4000)
      '/mx/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/mx/, ''),
      },
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
