import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.N8N_PROXY_TARGET

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/n8n': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/n8n/, ''),
        },
      },
    },
  }
})
