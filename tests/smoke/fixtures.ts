// The shared test for every smoke, screenshot and lab spec: import `test` and `expect` from here, not from
// '@playwright/test'. It fails a test whose screens drew a number with a long decimal ("137.35", "61.0004") or a
// broken one ("NaN", "1e+21"): the game's safety net (src/core/format.ts guardText, run on every string the canvas
// draws and on the HTML panels' text) rounds it on screen and reports the raw string here, as it happens, across
// reloads too. So any screen a test visits is covered, today's and any added later.
import { expect, test as base } from '@playwright/test';

export const test = base.extend<{ numbersGuard: string[] }>({
  numbersGuard: [
    async ({ page }, use) => {
      const seen: string[] = [];
      await page.exposeFunction('__cq3TextViolation', (raw: string) => {
        if (!seen.includes(raw)) seen.push(raw);
      });
      await use(seen);
      expect(seen, 'on-screen text with a long decimal (format it with src/core/format.ts)').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
export type { Page } from '@playwright/test';
