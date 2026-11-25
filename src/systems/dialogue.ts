import { CATS, type CatDef } from '../data/cats';
import type { NpcDef } from '../data/npcs';
import { t, type TextKey } from '../i18n/i18n';
import { gameState, LEVEL } from './gameState';

export interface DialogueLine {
  name: string;
  text: string;
}

const item = (id: string) => t(`item.${id}` as TextKey);
const pickOne = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

function isNightCat(cat: CatDef): boolean {
  return cat.phases.includes('night') || !!cat.weather?.only;
}

/**
 * A hint about a cat you haven't befriended yet: where and when it shows up
 * until you have fed it, then what it likes or its favourite petting spot.
 */
function hint(npc: NpcDef): string | null {
  const state = gameState();
  const candidates = CATS.filter(
    (c) => !c.bande && state.cat(c.id).level < LEVEL.FRIEND && (npc.hints === 'any' || isNightCat(c)),
  ).filter((c) => !c.requiresFlag || state.hasFlag(c.requiresFlag));
  if (!candidates.length) return null;
  // Prefer the cats you know least.
  const lowest = Math.min(...candidates.map((c) => state.cat(c.id).level));
  const cat = pickOne(candidates.filter((c) => state.cat(c.id).level === lowest));
  const level = state.cat(cat.id).level;
  const place = t(`district.${cat.district}` as TextKey);

  if (level <= LEVEL.SEEN) {
    if (cat.weather?.only) {
      return t('npc.hint.only', { name: cat.name, place, weather: cat.weather.only.map((w) => t(`weather.${w}` as TextKey)).join(', ') });
    }
    return t('npc.hint.where', {
      name: cat.name,
      spot: t(`spot.${cat.spots[0]}` as TextKey),
      place,
      phase: t(`phase.${pickOne(cat.phases)}` as TextKey),
    });
  }
  // Fed but not yet a friend: what it likes, or where it likes to be stroked.
  return Math.random() < 0.5
    ? t('npc.hint.likes', { name: cat.name, item: item(cat.likes[0]) })
    : t('npc.hint.zone', { name: cat.name, zone: t(`zone.${cat.favourite[0]}` as TextKey) });
}

function forecast(): string {
  const { weather } = gameState().weather.forecast;
  if (weather === 'fog') return t('npc.forecast.fog');
  return t('npc.forecast', { weather: t(`weather.${weather}` as TextKey) });
}

/** Builds what the NPC says right now (and hands out the daily gift). */
export function talk(npc: NpcDef): DialogueLine[] {
  const state = gameState();
  const lines: string[] = [t(`npc.${npc.id}.greet.${Math.floor(Math.random() * npc.greetings)}` as TextKey)];

  if (npc.gift && state.claimNpcGift(npc.id)) {
    const added = state.addItem(npc.gift.item, npc.gift.amount);
    lines.push(added ? t('npc.gift', { amount: added, item: item(npc.gift.item) }) : t('npc.giftFull', { item: item(npc.gift.item) }));
  }
  for (const story of npc.story ?? []) {
    if (story.ifFlag && !state.hasFlag(story.ifFlag)) continue;
    if (!state.hasFlag(story.unlessFlag)) lines.push(t(`npc.${npc.id}.${story.line}` as TextKey));
  }
  const h = hint(npc);
  if (h) lines.push(h);
  if (npc.forecast) lines.push(forecast());
  if (!h && !npc.forecast) lines.push(t('npc.nothing'));

  return lines.map((text) => ({ name: npc.name, text }));
}
