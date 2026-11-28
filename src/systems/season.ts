import raw from '../data/events.json';
import type { Point } from '../world/grid';
import type { Weather } from './weather';

/**
 * Seasons and calendar events (see docs/EXTENDING.md). They follow the real
 * date, not the in-game clock: the Christmas market and snow come in
 * December. Add `?month=12` to the URL to preview another month.
 */

export interface EventProp extends Point {
  /** 'stall' takes two tiles (x and x+1), 'tree' one. Both block walking. */
  type: 'stall' | 'tree';
  /** Stall colours, see STALL_VARIANTS in src/art/festive.ts. */
  variant?: string;
}

export interface SeasonEvent {
  id: string;
  /** Calendar months (1–12) in which the event is on. */
  months: number[];
  district: string;
  /** Story flag set while the event is on (quests can require it). */
  flag?: string;
  props: EventProp[];
}

export const EVENTS: SeasonEvent[] = raw as SeasonEvent[];

/** Month (1–12) from the URL (?month=12), for previews and tests. */
function monthOverride(): number | null {
  if (typeof location === 'undefined') return null;
  const m = Number(new URLSearchParams(location.search).get('month'));
  return Number.isInteger(m) && m >= 1 && m <= 12 ? m : null;
}

let forced: number | null | undefined;

/** Current calendar month, 1–12. */
export function currentMonth(now: Date = new Date()): number {
  if (forced === undefined) forced = monthOverride();
  return forced ?? now.getMonth() + 1;
}

/** For tests: pretend it is this month (null = real date). */
export function setMonth(month: number | null): void {
  forced = month;
}

/** Snow lies in December, and rain falls as snow. */
export function isSnowSeason(): boolean {
  return currentMonth() === 12;
}

export function eventActive(id: string): boolean {
  const ev = EVENTS.find((e) => e.id === id);
  return !!ev && ev.months.includes(currentMonth());
}

export function activeEvents(district?: string): SeasonEvent[] {
  return EVENTS.filter((e) => e.months.includes(currentMonth()) && (!district || e.district === district));
}

/** Tiles a prop blocks. */
export function propTiles(p: EventProp): Point[] {
  return p.type === 'stall' ? [{ x: p.x, y: p.y }, { x: p.x + 1, y: p.y }] : [{ x: p.x, y: p.y }];
}

/** Text key part for a weather: rain shows as snow in the snow season. */
export function weatherName(w: Weather): string {
  return w === 'rain' && isSnowSeason() ? 'snow' : w;
}
