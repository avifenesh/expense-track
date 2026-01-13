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
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/lib/**/*.{ts,tsx}', 'src/app/actions/**/*.ts', 'src/schemas/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/types.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'server-only': path.resolve(__dirname, 'tests/mocks/server-only.ts'),
    },
  },
})
