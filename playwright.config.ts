import { defineConfig, devices } from '@playwright/test';

// The suite only talks to its loopback Vite server. Corporate proxy variables
// can otherwise make Playwright mistake a proxy's HTTP 400 for a running app.
process.env.NO_PROXY = '*';
process.env.no_proxy = '*';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm exec vite -- --host localhost --port 4173 --strictPort',
    // A local .env.local key changes the first-run dialog and must not enter tests.
    env: { GEMINI_API_KEY: '' },
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
