import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

import legacy from '@vitejs/plugin-legacy'

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return ({
  define: mode === 'development'
    ? { 'import.meta.env.VITE_ACCOUNT_AUTH_BASE_URL': JSON.stringify('/account-auth-local') }
    : {},
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
        target: env.VITE_SUPABASE_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/account-auth-local/, '/functions/v1/account-auth'),
        configure: (proxy) => proxy.on('proxyReq', (request) => request.removeHeader('origin'))
      }
    }
  }
  })
})
