import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Served from https://jayr-ai.github.io/terraslate-ceo-dashboard/ — asset
  // paths need this subpath prefix or they'll 404 (this isn't a custom-domain
  // repo, unlike some of the other client dashboards).
  base: '/terraslate-ceo-dashboard/',
})
