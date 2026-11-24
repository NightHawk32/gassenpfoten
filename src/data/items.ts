import raw from './items.json';

/**
 * Item registry. Add new items to items.json plus a name in the language
 * files (`item.<id>`); see docs/EXTENDING.md.
 *
 * Categories:
 *  - treat: can be put in a bowl for a cat (`color` is the food colour in the bowl)
 *  - toy, key, story: reserved for later (decoy toys against the Rote Bande, quest items …)
 */
export type ItemCategory = 'treat' | 'toy' | 'key' | 'story';

export interface ItemDef {
  id: string;
  category: ItemCategory;
  /** Main colour, used for placeholder icons (and the food in a bowl). */
  color: string;
  /** Amount in a new game. */
  start?: number;
  /** Frau Häberle leaves this many every morning. */
  dailyRefill?: number;
  /** Carry limit (default 9). */
  max?: number;
}

export const ITEMS: ItemDef[] = raw as ItemDef[];

const byId = new Map(ITEMS.map((i) => [i.id, i]));

export function itemDef(id: string): ItemDef {
  const def = byId.get(id);
  if (!def) throw new Error(`Unknown item "${id}"`);
  return def;
}

export function itemsOfCategory(category: ItemCategory): ItemDef[] {
  return ITEMS.filter((i) => i.category === category);
}

export const DEFAULT_ITEM_MAX = 9;
