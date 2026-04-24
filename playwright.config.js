const { defineConfig } = require('@playwright/test')

const isWindows = process.platform === 'win32'

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    headless: true,
    viewport: { width: 1280, height: 960 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: isWindows
      ? 'npm.cmd run dev -- --hostname 127.0.0.1 --port 3000'
      : 'npm run dev -- --hostname 127.0.0.1 --port 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
