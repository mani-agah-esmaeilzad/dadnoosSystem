import path from 'node:path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setupEnv.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
})
