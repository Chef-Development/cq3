import { defineConfig } from 'vitest/config';

// The balance bot (npm run balance): long-running, so it is not part of npm test.
export default defineConfig({
  test: { include: ['tests/balance/**/*.run.ts'], testTimeout: 1_800_000 },
});
