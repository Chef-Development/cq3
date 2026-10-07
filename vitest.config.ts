import { defineConfig } from 'vitest/config';

export default defineConfig({
  // the audio renders and the bot's balance guards are heavy: give them room when the whole suite runs in parallel
  test: { include: ['tests/unit/**/*.test.ts'], testTimeout: 30000 },
});
