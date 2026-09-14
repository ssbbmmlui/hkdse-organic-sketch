import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const repoName = 'hkdse-organic-sketch'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves this project at /<repo>/, while local `npm run dev` stays at /.
  base: process.env.GITHUB_ACTIONS ? `/${repoName}/` : '/',
  test: {
    globals: true,
    environment: 'node',
  },
})
