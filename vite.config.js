import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'node:https'

import legacy from '@vitejs/plugin-legacy'

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const authTarget = new URL(env.VITE_ACCOUNT_AUTH_BASE_URL || `${env.VITE_SUPABASE_URL}/functions/v1/account-auth`)
  const authAgent = new https.Agent({ keepAlive: true, maxSockets: 8, maxFreeSockets: 2, timeout: 40000 })
  return ({
  define: mode === 'development'
    ? { 'import.meta.env.VITE_ACCOUNT_AUTH_BASE_URL': JSON.stringify('/account-auth-local') }
    : {},
  // This worktree shares installed packages with the production worktree, but
  // keeps Vite's optimized dependency output separate to prevent 504 stale-cache errors.
  cacheDir: 'node_modules/.vite-frontend-redesign',
  plugins: [
    react(),
    command === 'build' && legacy({
      targets: ['chrome >= 60', 'safari >= 11'],
      polyfills: true
    })
  ].filter(Boolean),
  build: {
    target: ['chrome60', 'es2015'],
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].[hash].js`,
        chunkFileNames: `assets/[name].[hash].js`,
        assetFileNames: `assets/[name].[hash].[ext]`
      }
    }
  },
  server: {
    // Codex can retain hidden preview tabs. Their HMR reconnects used to make
    // every server start recompile the app several times before the visible
    // tab could respond. A normal refresh is deterministic and much faster.
    hmr: false,
    watch: {
      // Browser smoke-test profiles contain databases and lock files that
      // change continuously. Watching them can restart Vite in a loop.
      ignored: ['**/.chrome-*/**', '**/.edge-*/**', '**/.codex-*/**']
    },
    proxy: {
      '/naver-api': {
        target: 'https://openapi.naver.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/naver-api/, '')
      },
      '/account-auth-local': {
        target: authTarget.origin,
        agent: authAgent,
        proxyTimeout: 35000,
        timeout: 40000,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/account-auth-local/, authTarget.pathname.replace(/\/$/, '')),
        configure: (proxy) => {
          proxy.on('proxyReq', request => request.removeHeader('origin'))
          proxy.on('error', (error, request, response) => {
            // Log connection codes only, never login bodies or authorization headers.
            console.warn('[local-account-auth]', error.code || 'CONNECTION_FAILED')
            if (response && 'writeHead' in response && !response.headersSent) {
              response.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
              response.end(JSON.stringify({ error: 'local_proxy_unavailable' }))
            }
          })
          proxy.on('close', () => authAgent.destroy())
        }
      }
    }
  }
  })
})
