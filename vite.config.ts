/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      // `assets/` contient des milliers d'images de decks (sources hors runtime,
      // les images servies vivent dans `public/`). Sous Windows, certaines sont
      // verrouillées et faisaient planter le watcher (EBUSY). On l'ignore.
      ignored: ['**/assets/**'],
    },
  },
  test: {
    // Le moteur est pur (aucune dépendance navigateur) → environnement node.
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
