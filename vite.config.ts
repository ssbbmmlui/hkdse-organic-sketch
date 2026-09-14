import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { formulaApiPlugin } from './src/api/vite-plugin'

export default defineConfig({
  plugins: [react(), formulaApiPlugin()],
  test: {
    globals: true,
    environment: 'node',
  },
})
