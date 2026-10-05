import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/smoke',
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    // iPhone 16 Pro held sideways: 874x402 CSS px at 3x.
    viewport: { width: 874, height: 402 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: {
    command: 'npx vite build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/cq3/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
