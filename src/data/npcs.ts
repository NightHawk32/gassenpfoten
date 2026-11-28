import type { DayPhase } from '../systems/clock';
import raw from './npcs.json';

/**
 * Locals you can talk to (concept §4.8). Content lives in npcs.json and
 * the language files (`npc.<id>.greet.<n>` and the shared `npc.*` lines);
 * see docs/EXTENDING.md.
 */
export interface NpcDef {
  id: string;
  name: string;
  /** Sprite look (src/art/sprites.ts NPC_LOOKS). */
  look: string;
  district: string;
  /** Spot name in the district where the NPC stands. */
  spot: string;
  /** Optional: walks between these spots (first tile of each) instead of standing still. */
  roam?: string[];
  phases: DayPhase[];
  /** Number of greeting lines `npc.<id>.greet.0 … n-1`. */
  greetings: number;
  /** Handed out once per game day. */
  gift?: { item: string; amount: number };
  /** Taler handed out once per game day (together with `gift`, if any). */
  giftCoins?: number;
  /** Sells these items for Taler; the shop opens after the conversation. */
  shop?: { item: string; price: number }[];
  /** Only shows up during a demo (src/systems/demo.ts), not by time of day. */
  demo?: boolean;
  /** Only there while this calendar event is on (src/data/events.json), e.g. a market stall. */
  event?: string;
  /** Something carried above the head (texture key), e.g. a placard. */
  prop?: string;
  /** Which cats the NPC gives hints about: any, or only night and fog cats. */
  hints?: 'any' | 'night';
  /** Tells you what the weather will do next. */
  forecast?: boolean;
  /** Number of lines `npc.<id>.bark.0 … n-1` muttered aloud when the player is nearby. */
  barks?: number;
  /**
   * Story lines `npc.<id>.<line>`. All given conditions must hold: `ifFlag`
   * set, `unlessFlag` not set, and `ifStep` ("questId.stepId") the current
   * step of that active quest. That is how an NPC hands out a quest and
   * reacts to the report. `give` hands over items when the line is said.
   */
  story?: StoryLine[];
}

export interface StoryLine {
  line: string;
  ifFlag?: string;
  unlessFlag?: string;
  ifStep?: string;
  give?: { item: string; amount: number };
}

export const NPCS: NpcDef[] = raw as NpcDef[];
