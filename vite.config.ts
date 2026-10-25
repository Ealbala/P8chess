import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the built app works on any static host (Vercel, Netlify, GitHub Pages...)
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/icon.svg'],
      manifest: {
        name: 'Pocho Chess',
        short_name: 'Pocho Chess',
        description: 'Camino a GM Pocho — personal chess training, goals and progress.',
        theme_color: '#16a34a',
        background_color: '#0b1120',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache the app shell and the puzzle set so training works offline
        globPatterns: ['**/*.{js,css,html,png,svg,json}'],
      },
    }),
  ],
  server: { host: true },
  build: { chunkSizeWarningLimit: 1200 },
})
