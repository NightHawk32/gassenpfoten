/**
 * Simulated weather (concept §4.3): a small Markov chain with plausible
 * transitions. The weather changes every few game hours; fog only forms in
 * the early morning and is likelier after rain. The next state is decided in
 * advance, so NPCs can forecast it ("Morgen früh gibt's Nebel, gell?").
 * Seasons (snow, heat) come later.
 */
export type Weather = 'sunny' | 'cloudy' | 'rain' | 'fog';

export const WEATHERS: Weather[] = ['sunny', 'cloudy', 'rain', 'fog'];

export interface WeatherData {
  current: Weather;
  next: Weather;
  /** Total game minutes when `next` takes over. */
  changeAt: number;
  /** Total game minutes when it last rained (for morning fog). */
  lastRain: number;
}

const TRANSITIONS: Record<Weather, [Weather, number][]> = {
  sunny: [['sunny', 0.55], ['cloudy', 0.38], ['rain', 0.07]],
  cloudy: [['sunny', 0.35], ['cloudy', 0.3], ['rain', 0.3], ['fog', 0.05]],
  rain: [['cloudy', 0.45], ['rain', 0.3], ['sunny', 0.12], ['fog', 0.13]],
  fog: [['sunny', 0.55], ['cloudy', 0.4], ['fog', 0.05]],
};

/** Fog only forms between 03:00 and 09:00. */
const FOG_FROM = 3;
const FOG_UNTIL = 9;
const MIN_HOURS = 3;
const MAX_HOURS = 6;

const hourOf = (total: number) => Math.floor((total % (24 * 60)) / 60);

function pick(options: [Weather, number][], rnd: () => number): Weather {
  let r = rnd() * options.reduce((s, [, w]) => s + w, 0);
  for (const [w, weight] of options) {
    r -= weight;
    if (r <= 0) return w;
  }
  return options[0][0];
}

export function freshWeather(now: number): WeatherData {
  return { current: 'sunny', next: 'cloudy', changeAt: now + 4 * 60, lastRain: -1e9 };
}

export class WeatherModel {
  constructor(
    private readonly data: WeatherData,
    private readonly rnd: () => number = Math.random,
  ) {
    if (data.next === undefined) data.next = this.decide(data.current, data.changeAt);
  }

  get current(): Weather {
    return this.data.current;
  }

  /** What comes next, and when (total game minutes). */
  get forecast(): { weather: Weather; at: number } {
    return { weather: this.data.next, at: this.data.changeAt };
  }

  /** Advances to `now`. Returns true if the weather changed. */
  update(now: number): boolean {
    let changed = false;
    // Loop in case a lot of time passed (e.g. fast-forward).
    while (now >= this.data.changeAt) {
      const before = this.data.current;
      if (before === 'rain') this.data.lastRain = this.data.changeAt;
      this.data.current = this.data.next;
      const span = (MIN_HOURS + this.rnd() * (MAX_HOURS - MIN_HOURS)) * 60;
      // Fog lifts by mid-morning at the latest.
      const at = this.data.changeAt + span;
      this.data.changeAt = this.data.current === 'fog' ? Math.min(at, this.fogEnd(this.data.changeAt)) : at;
      this.data.next = this.decide(this.data.current, this.data.changeAt);
      changed ||= before !== this.data.current;
    }
    return changed;
  }

  /** Picks the weather that follows `from` at time `at`. */
  private decide(from: Weather, at: number): Weather {
    const hour = hourOf(at);
    const fogTime = hour >= FOG_FROM && hour < FOG_UNTIL;
    const afterRain = from === 'rain' || at - this.data.lastRain < 12 * 60;
    if (fogTime && afterRain && this.rnd() < 0.45) return 'fog';
    let next = pick(TRANSITIONS[from], this.rnd);
    if (next === 'fog' && !fogTime) next = 'cloudy';
    return next;
  }

  private fogEnd(from: number): number {
    const dayStart = from - (from % (24 * 60));
    let end = dayStart + FOG_UNTIL * 60 + 60;
    if (end <= from) end += 24 * 60;
    return end;
  }
}
