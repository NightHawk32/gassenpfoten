import type { Coat } from '../art/sprites';
import type { DayPhase } from '../systems/clock';
import type { Weather } from '../systems/weather';
import raw from './cats.json';

/** Where a cat can be petted (concept §4.5). */
export type PetZone = 'head' | 'cheeks' | 'chin' | 'back' | 'belly' | 'tail';

/**
 * A cat's spawn profile and personality (concept §4.1). Content lives in
 * cats.json; see docs/EXTENDING.md.
 */
export interface CatDef {
  id: string;
  name: string;
  coat: Coat;
  /** District id (src/world/districts). */
  district: string;
  phases: DayPhase[];
  /** Spot names defined by the district. */
  spots: string[];
  /** Item ids of treats. */
  likes: string[];
  dislikes: string[];
  /** 1 (relaxed) … 5 (very shy). */
  shyness: number;
  favourite: PetZone[];
  noGo: PetZone[];
  /**
   * Weather habits (concept §4.3). `only`: shows up only in this weather
   * (fog cats); `avoids`: stays away; `prefers`: always comes out then.
   * `spots` per weather replaces the normal spots, e.g. shelter from rain.
   */
  weather?: {
    only?: Weather[];
    avoids?: Weather[];
    prefers?: Weather[];
    spots?: Partial<Record<Weather, string[]>>;
  };
  /** Rote Bande member: can't be befriended, steals food (concept §4.7). */
  bande?: boolean;
  /** Sprite size, 1 = normal. The Baron is bigger. */
  size?: number;
  /** Optional: only appears once this story flag is set (e.g. by a quest). */
  requiresFlag?: string;
  /** Optional: only appears while this calendar event is on (src/data/events.json). */
  event?: string;
  /**
   * Inseparable: this cat comes, goes, moves and flees together with the cat
   * with this id (same district). Its own phases and weather are only shown
   * in the journal; the leader decides.
   */
  follows?: string;
  /** The one cat that follows the player around once it is a best friend (Bello, the Maine Coon). */
  companion?: boolean;
}

export const CATS: CatDef[] = raw as CatDef[];

export function catDef(id: string): CatDef {
  const def = CATS.find((c) => c.id === id);
  if (!def) throw new Error(`Unknown cat "${id}"`);
  return def;
}

/** Does the cat come out at this time of day and in this weather? */
export function catActive(cat: CatDef, phase: DayPhase, weather: Weather): boolean {
  if (!cat.phases.includes(phase)) return false;
  const w = cat.weather;
  if (w?.only && !w.only.includes(weather)) return false;
  return !w?.avoids?.includes(weather);
}

/** Spot names the cat uses in this weather. */
export function catSpots(cat: CatDef, weather: Weather): string[] {
  return cat.weather?.spots?.[weather] ?? cat.spots;
}

/** Orange cats share a single brain cell (see src/world/brainCell.ts). */
export function isOrange(cat: CatDef): boolean {
  return cat.coat === 'orange';
}

export function treatReaction(cat: CatDef, item: string): 'liked' | 'neutral' | 'disliked' {
  if (cat.likes.includes(item)) return 'liked';
  if (cat.dislikes.includes(item)) return 'disliked';
  return 'neutral';
}

export function zoneReaction(cat: CatDef, zone: PetZone): 'favourite' | 'neutral' | 'noGo' {
  if (cat.favourite.includes(zone)) return 'favourite';
  if (cat.noGo.includes(zone)) return 'noGo';
  return 'neutral';
}
