// Content switches (plain data). Region 5 (Noonspire) is wired end to end but stays out of the campaign until its art
// and music exist: off in the game and in the unit tests; the balance tools switch it on with CQ3_REGION5=1 in the
// environment (e.g. `CQ3_REGION5=1 REGION=4 npm run region-tune`). When its art lands, set it to true here.

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;

/** Region 5 in the campaign (REGIONS, its scenes, relics and gear in the game's tables). */
export const NOON_ON: boolean = env?.CQ3_REGION5 === '1';
