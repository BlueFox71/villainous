/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Expose le serveur de dév sur le réseau local (0.0.0.0) pour que l'invité
    // puisse ouvrir l'app depuis l'IP de l'hôte (http://<ip-hôte>:5173) — requis
    // pour le mode « Jouer en réseau ».
    host: true,
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
