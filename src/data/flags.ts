// Content switches (plain data). Region 5 (Noonspire) joined the campaign once its art and music landed (round 8);
// the switch stays so a balance tool can still play the campaign without it (CQ3_REGION5=0 in the environment).

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;

/** Region 5 in the campaign (REGIONS, its scenes, relics and gear in the game's tables). */
export const NOON_ON: boolean = env?.CQ3_REGION5 !== '0';
