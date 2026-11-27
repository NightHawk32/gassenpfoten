/**
 * Now and then a vegan demo marches across the Marktplatz and every cat runs
 * for it. Like the weather, it runs on game time whether or not the player is
 * there: once per game hour during the day there is a small chance that one
 * starts, and it lasts an hour or so. The demonstrators are NPCs with
 * `"demo": true` (npcs.json); GameScene shows them and scares the cats away
 * while `active` is true in their district.
 */
export interface DemoData {
  /** Total game minutes when the current demo ends (in the past = none). */
  until: number;
  /** Last game hour (total) that was rolled for a new demo. */
  checkedHour: number;
}

/** Demos only start between 09:00 and 18:00. */
const FROM_HOUR = 9;
const UNTIL_HOUR = 18;
/** Chance per game hour; ≈ one demo a day. */
const CHANCE = 0.12;
/** Duration in game minutes (1 game hour = 1 real minute). */
const MIN_MINUTES = 60;
const MAX_MINUTES = 105;

export function freshDemo(now: number): DemoData {
  return { until: 0, checkedHour: Math.floor(now / 60) };
}

export class DemoModel {
  constructor(
    private readonly data: DemoData,
    private readonly rnd: () => number = Math.random,
  ) {}

  active(now: number): boolean {
    return now < this.data.until;
  }

  /** Rolls for a new demo once per game hour. `allowed`: false keeps the square quiet (tutorial). */
  update(now: number, allowed: boolean): void {
    const hour = Math.floor(now / 60);
    if (hour <= this.data.checkedHour) return;
    this.data.checkedHour = hour;
    const hourOfDay = hour % 24;
    if (!allowed || this.active(now) || hourOfDay < FROM_HOUR || hourOfDay >= UNTIL_HOUR) return;
    if (this.rnd() < CHANCE) this.data.until = now + MIN_MINUTES + this.rnd() * (MAX_MINUTES - MIN_MINUTES);
  }
}
