import { NATION_SEED_CONFIG } from 'src/configs/map/geopolitics';
import { TCell } from 'src/types/global';
import { isLand } from './shared';

/** How many steps around a city must belong to one nation. */
const CITY_WHOLE_RADIUS = 2;

/**
 * The cities of a world: land cells no neighbour out-populates, big enough to matter (at least
 * `minCityShare` of the biggest one). Biggest first.
 */
export function getCityCells(cells: TCell[]) {
  const biggest = cells.reduce(
    (max, cell) => (isLand(cell) ? Math.max(max, cell.population) : max),
    0
  );
  if (biggest <= 0) return [];
  return cells
    .filter(
      (cell) =>
        isLand(cell) &&
        cell.population >= biggest * NATION_SEED_CONFIG.minCityShare &&
        cell.neighbors.every((id) => !isLand(cells[id]) || cells[id].population <= cell.population)
    )
    .sort((a, b) => b.population - a.population || a.id - b.id)
    .map((cell) => cell.id);
}

/**
 * A border should not run through a city: everything within `CITY_WHOLE_RADIUS` steps of a city
 * goes to the nation that holds the city itself. Bigger cities are settled first and their land is
 * not taken back by a smaller neighbour. Returns how many cells changed hands.
 */
export function keepCitiesWhole(cells: TCell[], owner: Int32Array) {
  const settled = new Set<number>();
  let changed = 0;
  for (const cityId of getCityCells(cells)) {
    const nationId = owner[cityId];
    if (nationId < 0 || settled.has(cityId)) continue;

    const area = new Set<number>([cityId]);
    let frontier = [cityId];
    for (let step = 0; step < CITY_WHOLE_RADIUS; step += 1) {
      const next: number[] = [];
      for (const id of frontier) {
        for (const neighborId of cells[id].neighbors) {
          if (area.has(neighborId) || !isLand(cells[neighborId])) continue;
          area.add(neighborId);
          next.push(neighborId);
        }
      }
      frontier = next;
    }

    for (const id of area) {
      if (settled.has(id)) continue;
      settled.add(id);
      if (owner[id] >= 0 && owner[id] !== nationId) {
        owner[id] = nationId;
        changed += 1;
      }
    }
  }
  return changed;
}
