import { buildDistrict, type District, type DistrictDef } from '../district';
import { marktplatz } from './marktplatz';

/**
 * District registry. To add an area: create a DistrictDef file next to this
 * one and add it here (see docs/EXTENDING.md).
 */
const DEFS: DistrictDef[] = [marktplatz];

export const DISTRICT_IDS = DEFS.map((d) => d.id);
export const START_DISTRICT = 'marktplatz';

const cache = new Map<string, District>();

export function getDistrict(id: string): District {
  let d = cache.get(id);
  if (!d) {
    const def = DEFS.find((x) => x.id === id);
    if (!def) throw new Error(`Unknown district "${id}"`);
    d = buildDistrict(def);
    cache.set(id, d);
  }
  return d;
}
