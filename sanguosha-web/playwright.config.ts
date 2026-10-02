import { defineConfig, devices } from '@playwright/test';

const PORT = 8799;

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : undefined,
  },
  webServer: {
    command: `node dist/server/main.js`,
    url: `http://localhost:${PORT}/health`,
    reuseExistingServer: false,
    env: { PORT: String(PORT), STORE: 'memory', ENABLE_DEBUG: '1', BOT_DELAY_MS: '120' },
    timeout: 30_000,
  },
});
