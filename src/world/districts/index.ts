import { buildDistrict, type District, type DistrictDef } from '../district';
import { marktplatz } from './marktplatz';
import { neckarfront } from './neckarfront';

/**
 * District registry. To add an area: create a DistrictDef file next to this
 * one and add it here (see docs/EXTENDING.md).
 */
const DEFS: DistrictDef[] = [marktplatz, neckarfront];

export const DISTRICT_IDS = DEFS.map((d) => d.id);
export const START_DISTRICT = 'marktplatz';

const cache = new Map<string, District>();

export function districtDef(id: string): DistrictDef {
  const def = DEFS.find((x) => x.id === id);
  if (!def) throw new Error(`Unknown district "${id}"`);
  return def;
}

/** Districts that become reachable when `flag` is set. */
export function districtsUnlockedBy(flag: string): DistrictDef[] {
  return DEFS.filter((d) => d.requiresFlag === flag);
}

export function getDistrict(id: string): District {
  let d = cache.get(id);
  if (!d) {
    d = buildDistrict(districtDef(id));
    cache.set(id, d);
  }
  return d;
}
