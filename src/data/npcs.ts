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
  phases: DayPhase[];
  /** Number of greeting lines `npc.<id>.greet.0 … n-1`. */
  greetings: number;
  /** Handed out once per game day. */
  gift?: { item: string; amount: number };
  /** Which cats the NPC gives hints about: any, or only night and fog cats. */
  hints?: 'any' | 'night';
  /** Tells you what the weather will do next. */
  forecast?: boolean;
  /** Story lines `npc.<id>.<line>`, said until the flag is set. */
  story?: { unlessFlag: string; line: string }[];
}

export const NPCS: NpcDef[] = raw as NpcDef[];
