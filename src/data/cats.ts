import type { Coat } from '../art/sprites';
import type { DayPhase } from '../systems/clock';
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
  /** Sprite size, 1 = normal. The Baron is bigger. */
  size?: number;
  /** Optional: only appears once this story flag is set (e.g. by a quest). */
  requiresFlag?: string;
}

export const CATS: CatDef[] = raw as CatDef[];

export function catDef(id: string): CatDef {
  const def = CATS.find((c) => c.id === id);
  if (!def) throw new Error(`Unknown cat "${id}"`);
  return def;
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
