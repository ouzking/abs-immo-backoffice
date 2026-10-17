import { fileURLToPath, URL } from 'node:url'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * Tests d'intégration : exécutent la couche de services du back-office contre la
 * pile Supabase LOCALE du dépôt abs-immo-backend (`npm run db:start && npm run db:reset`),
 * avec les comptes de démonstration du seed. Ils créent puis suppriment des données :
 * ils refusent de s'exécuter sur une URL qui n'est pas locale.
 */
export default defineConfig(({ mode }) => ({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    // jsdom fournit XMLHttpRequest (envois avec progression) et localStorage (session).
    environment: 'jsdom',
    globals: true,
    environmentOptions: { jsdom: { url: 'http://localhost:5174' } },
    include: ['tests/integration/**/*.test.ts'],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: loadEnv(mode, process.cwd(), 'VITE_'),
  },
}))
