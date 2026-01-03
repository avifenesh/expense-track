import { defineConfig } from 'vitest/config'
import path from 'path'
import { config } from 'dotenv'

// Load .env file for tests
config()

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/lib/**/*.{ts,tsx}'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'server-only': path.resolve(__dirname, 'tests/mocks/server-only.ts'),
    },
  },
})
