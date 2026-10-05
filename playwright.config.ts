import { defineConfig } from '@playwright/test';

// PORT=4174 npm run smoke: a second checkout (a worktree) serves its own build instead of reusing another's
const PORT = Number(process.env.PORT ?? 4173);

export default defineConfig({
  testDir: 'tests/smoke',
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // iPhone 16 Pro held sideways: 874x402 CSS px at 3x.
    viewport: { width: 874, height: 402 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: {
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/cq3/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
