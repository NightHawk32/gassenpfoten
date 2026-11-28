import { EVENTS, eventActive, propTiles } from '../../systems/season';
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
    placeEventProps(d);
    cache.set(id, d);
  }
  return d;
}

/**
 * Seasonal props (market stalls, the tree) block their tiles while their event
 * is on. Every event of the district is checked, on or not, so a stall on a
 * cat's spot shows up in any month, not only in December.
 */
function placeEventProps(d: District): void {
  const { def, grid } = d;
  const reserved = new Map<string, string>();
  for (const [name, points] of Object.entries(def.spots)) points.forEach((p) => reserved.set(`${p.x},${p.y}`, `spot "${name}"`));
  for (const [name, p] of Object.entries(def.entries)) reserved.set(`${p.x},${p.y}`, `entry "${name}"`);
  def.exits.forEach((p) => reserved.set(`${p.x},${p.y}`, 'an exit'));
  for (const ev of EVENTS.filter((e) => e.district === def.id)) {
    const on = eventActive(ev.id);
    for (const prop of ev.props) {
      for (const t of propTiles(prop)) {
        const what = `Event "${ev.id}": ${prop.type} at ${t.x},${t.y}`;
        if (grid.isSolid(t.x, t.y)) throw new Error(`${what} is not on walkable ground`);
        const clash = reserved.get(`${t.x},${t.y}`);
        if (clash) throw new Error(`${what} blocks ${clash}`);
      }
      if (on) for (const t of propTiles(prop)) grid.setSolid(t.x, t.y, true);
    }
  }
}
