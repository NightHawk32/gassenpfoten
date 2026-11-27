import { buildDistrict, type District, type DistrictDef } from '../district';
import bota from './bota.json';
import marktplatz from './marktplatz.json';
import neckarfront from './neckarfront.json';

/**
 * District registry. Each area is a JSON file next to this one (map rows,
 * spots, exits, entries; legend in ../district.ts). To add an area: create
 * <id>.json and add it here (see docs/EXTENDING.md). The type annotation makes
 * `tsc` check every file against DistrictDef.
 */
const DEFS: DistrictDef[] = [marktplatz, neckarfront, bota];

// Exits must lead to a district and entry that exist (caught at startup, not on the first walk-through).
for (const def of DEFS) {
  for (const exit of def.exits) {
    if (!exit.to) continue;
    const target = DEFS.find((d) => d.id === exit.to!.district);
    if (!target) throw new Error(`District "${def.id}": exit at ${exit.x},${exit.y} leads to unknown district "${exit.to.district}"`);
    if (!target.entries[exit.to.entry]) {
      throw new Error(`District "${def.id}": exit at ${exit.x},${exit.y} leads to unknown entry "${exit.to.entry}" in "${target.id}"`);
    }
  }
}

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
