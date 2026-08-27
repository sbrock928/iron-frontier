import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
    },
  },
  test: {
    /*
     * Two projects rather than one jsdom environment for everything: the
     * simulation tests (pathfinding, spatial hash, terrain) are pure and run
     * far faster in plain Node, and running them in jsdom would hide an
     * accidental DOM dependency creeping into game logic that has to work
     * inside a Phaser scene.
     */
    projects: [
      {
        extends: true,
        test: {
          name: 'simulation',
          environment: 'node',
          include: ['src/game/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          setupFiles: ['src/test/setup.ts'],
          include: ['src/**/*.test.tsx', 'src/store/**/*.test.ts'],
        },
      },
    ],
  },
})
