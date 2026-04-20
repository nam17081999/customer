import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/**/*.test.js', '__tests__/**/*.test.jsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['helper/**/*.js'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
