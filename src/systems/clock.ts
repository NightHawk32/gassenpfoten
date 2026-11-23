/**
 * In-game clock (concept §4.2): 1 real minute = 1 game hour,
 * so 1 game day ≈ 24 real minutes. Runs only while the game runs.
 */

export type DayPhase = 'dawn' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

/** Game minutes that pass per real second. 1 → 1 real minute = 60 game minutes. */
export const GAME_MINUTES_PER_REAL_SECOND = 1;

export const MINUTES_PER_DAY = 24 * 60;

export class GameClock {
  /** Total game minutes since the start of day 1, 00:00. */
  private totalMinutes: number;
  public paused = false;

  constructor(startTotalMinutes = 6 * 60 /* day 1, 06:00 */) {
    this.totalMinutes = startTotalMinutes;
  }

  /** Advance the clock by real elapsed time in milliseconds. */
  update(deltaMs: number): void {
    if (this.paused) return;
    this.totalMinutes += (deltaMs / 1000) * GAME_MINUTES_PER_REAL_SECOND;
  }

  get day(): number {
    return Math.floor(this.totalMinutes / MINUTES_PER_DAY) + 1;
  }

  /** Minutes since midnight of the current day (0 … 1439.99). */
  get minuteOfDay(): number {
    return this.totalMinutes % MINUTES_PER_DAY;
  }

  get hour(): number {
    return Math.floor(this.minuteOfDay / 60);
  }

  get phase(): DayPhase {
    return phaseForHour(this.hour);
  }

  /** "06:42" */
  get timeString(): string {
    const m = Math.floor(this.minuteOfDay);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  /** Serialisable state for the save file. */
  toJSON(): number {
    return this.totalMinutes;
  }

  /** Skip forward to the next occurrence of the given hour (e.g. sleeping until 06:00). */
  skipTo(hour: number): void {
    const target = hour * 60;
    let delta = target - this.minuteOfDay;
    if (delta <= 0) delta += MINUTES_PER_DAY;
    this.totalMinutes += delta;
  }
}

export function phaseForHour(hour: number): DayPhase {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Daylight factor 0 (dark night) … 1 (full day), smooth over dawn and dusk.
 * Used for lighting and tinting.
 */
export function daylight(minuteOfDay: number): number {
  const h = minuteOfDay / 60;
  if (h < 5 || h >= 22) return 0;
  if (h < 8) return (h - 5) / 3; // sunrise ramp
  if (h < 18) return 1;
  return 1 - (h - 18) / 4; // sunset ramp
}
