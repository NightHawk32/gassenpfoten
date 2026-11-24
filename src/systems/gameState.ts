import { SAVE_VERSION } from '../config';
import type { PetZone } from '../data/cats';
import { DEFAULT_ITEM_MAX, ITEMS, itemDef } from '../data/items';
import { START_DISTRICT } from '../world/districts';
import { GameClock } from './clock';
import { emitGame } from './events';
import { storage } from './storage';

/**
 * Everything that is saved (concept §10): in-game time, current district,
 * trust per cat, the bag, story flags and quest progress.
 * Stored under `gassenpfoten:save:v1`. All parts are keyed by id, so new
 * cats, items, districts and quests need no save-format change.
 */

/** Trust levels (concept §4.6). */
export const LEVEL = { UNKNOWN: 0, SEEN: 1, FED: 2, FRIEND: 3, BEST_FRIEND: 4 } as const;
/** Bond points needed for "best friend" (feeding a liked treat +2, neutral +1, good petting +2). */
export const BEST_FRIEND_BOND = 12;

export interface CatProgress {
  level: number;
  bond: number;
  /** Petting zones the player has discovered as favourites. */
  knownSpots: PetZone[];
}

export interface QuestProgress {
  /** Index of the current step. */
  step: number;
  /** Progress within the current step (for steps with `count`). */
  count: number;
  done: boolean;
}

interface SaveData {
  version: number;
  minutes: number;
  district: string;
  cats: Record<string, CatProgress>;
  items: Record<string, number>;
  flags: string[];
  quests: Record<string, QuestProgress>;
  lastRefillDay: number;
}

const SAVE_KEY = `save:v${SAVE_VERSION}`;
const START_MINUTES = 5 * 60 + 30; // day 1, 05:30: dawn, when cats are most active

function freshSave(): SaveData {
  const items: Record<string, number> = {};
  for (const item of ITEMS) if (item.start) items[item.id] = item.start;
  return {
    version: SAVE_VERSION,
    minutes: START_MINUTES,
    district: START_DISTRICT,
    cats: {},
    items,
    flags: [],
    quests: {},
    lastRefillDay: 1,
  };
}

function loadSave(): SaveData {
  const data = storage.get<Partial<SaveData> | null>(SAVE_KEY, null);
  const fresh = freshSave();
  if (!data || data.version !== SAVE_VERSION || typeof data.minutes !== 'number') return fresh;
  return { ...fresh, ...data } as SaveData;
}

export class GameState {
  readonly clock: GameClock;
  private data: SaveData;

  constructor() {
    this.data = loadSave();
    this.clock = new GameClock(this.data.minutes);
  }

  get hasProgress(): boolean {
    return Object.keys(this.data.cats).length > 0 || this.clock.toJSON() > START_MINUTES + 60;
  }

  // ------------------------------------------------------------ world
  get district(): string {
    return this.data.district;
  }

  set district(id: string) {
    this.data.district = id;
  }

  // ------------------------------------------------------------ cats
  cat(id: string): CatProgress {
    return (this.data.cats[id] ??= { level: LEVEL.UNKNOWN, bond: 0, knownSpots: [] });
  }

  /** Raises the level to at least `level`. Returns true if it went up. */
  raiseLevel(id: string, level: number): boolean {
    const c = this.cat(id);
    if (c.level >= level) return false;
    c.level = level;
    emitGame({ type: 'cat-level', cat: id, level });
    return true;
  }

  /** Adds bond points; returns true if the cat became a best friend. */
  addBond(id: string, points: number): boolean {
    const c = this.cat(id);
    c.bond += points;
    return c.level >= LEVEL.FRIEND && c.bond >= BEST_FRIEND_BOND && this.raiseLevel(id, LEVEL.BEST_FRIEND);
  }

  learnSpot(id: string, zone: PetZone): boolean {
    const c = this.cat(id);
    if (c.knownSpots.includes(zone)) return false;
    c.knownSpots.push(zone);
    return true;
  }

  // ------------------------------------------------------------ items
  itemCount(id: string): number {
    return this.data.items[id] ?? 0;
  }

  /** Adds items up to the carry limit. Returns how many were actually added. */
  addItem(id: string, amount = 1): number {
    const max = itemDef(id).max ?? DEFAULT_ITEM_MAX;
    const before = this.itemCount(id);
    this.data.items[id] = Math.min(max, before + amount);
    const added = this.data.items[id] - before;
    if (added > 0) emitGame({ type: 'item-gained', item: id, amount: added });
    return added;
  }

  useItem(id: string): boolean {
    if (this.itemCount(id) <= 0) return false;
    this.data.items[id]--;
    return true;
  }

  /** Frau Häberle leaves a few treats every morning. Returns true if she did today. */
  dailyRefill(): boolean {
    if (this.clock.day <= this.data.lastRefillDay || this.clock.hour < 5) return false;
    this.data.lastRefillDay = this.clock.day;
    for (const item of ITEMS) if (item.dailyRefill) this.addItem(item.id, item.dailyRefill);
    return true;
  }

  // ------------------------------------------------------------ story
  hasFlag(flag: string): boolean {
    return this.data.flags.includes(flag);
  }

  setFlag(flag: string): void {
    if (this.hasFlag(flag)) return;
    this.data.flags.push(flag);
    emitGame({ type: 'flag', flag });
  }

  quest(id: string): QuestProgress | undefined {
    return this.data.quests[id];
  }

  startQuest(id: string): QuestProgress {
    return (this.data.quests[id] ??= { step: 0, count: 0, done: false });
  }

  // ------------------------------------------------------------ persistence
  save(): void {
    this.data.minutes = this.clock.toJSON();
    storage.set(SAVE_KEY, this.data);
  }

  reset(): void {
    storage.remove(SAVE_KEY);
    this.data = freshSave();
    this.clock.set(this.data.minutes);
  }
}

let instance: GameState | null = null;

/** The one shared game state. */
export function gameState(): GameState {
  return (instance ??= new GameState());
}
