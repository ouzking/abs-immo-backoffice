import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Port 5174 : URL de redirection Auth déclarée dans abs-immo-backend/supabase/config.toml
  // (le site public occupe 5173).
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
  build: {
    target: 'es2022',
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'supabase', test: /node_modules[/\\]@supabase/ },
            { name: 'charts', test: /node_modules[/\\](recharts|d3-[a-z]+|victory-vendor)[/\\]/ },
            { name: 'react', test: /node_modules[/\\](react|react-dom|react-router|scheduler)[/\\]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      VITE_PUBLIC_SITE_URL: 'https://www.example.test',
    },
  },
})
