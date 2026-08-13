import { defineConfig, devices } from '@playwright/test'

// The login E2E runs against a local Supabase stack (`supabase start`, needs Docker).
// A global setup (e2e/global-setup.ts) provisions the test administrator account.
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    // Bind the dev server explicitly to IPv4 so the URL poll below reaches it
    // (Vite's default `localhost` can bind ::1, leaving 127.0.0.1 unreachable).
    command: 'npm run dev -- --host 127.0.0.1 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000
  }
})
