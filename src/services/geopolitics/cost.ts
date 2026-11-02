import { BORDER_CONFIG, NATION_SEED_CONFIG } from 'src/configs/map/geopolitics';
import { TBorderType, TCell } from 'src/types/global';
import { getCityCells } from './cities';
import { isLand } from './shared';

export default class Cost {
  static logistics(cell: TCell) {
    let base = 1;
    if (cell.landform === 'mountain' || cell.landform === 'volcanic_field') base += 2.8;
    else if (cell.landform === 'hills') base += 1.6;
    else if (cell.landform === 'plateau') base += 1.25;
    else if (cell.landform === 'valley' || cell.landform === 'plain') base += 0.35;
    else if (cell.landform === 'coast') base += 0.6;

    if (cell.biome === 'wetland') base += 1.4;
    else if (cell.biome === 'desert_hot' || cell.biome === 'desert_cold') base += 1.15;
    else if (cell.biome === 'tundra' || cell.biome === 'ice') base += 0.9;
    else if (cell.biome === 'boreal_forest' || cell.biome === 'temperate_forest') base += 0.65;

    if (cell.isRiver) base += 0.45;
    if (cell.isLake) base += 1;
    return base;
  }

  static ethnic(cell: TCell, config: { strength: number }) {
    const strength = config.strength;
    if (cell.landform === 'plain' || cell.landform === 'valley' || cell.landform === 'coast')
      return 0.55 * strength;
    if (cell.biome === 'temperate_forest' || cell.biome === 'tropical_forest')
      return 2.8 * strength;
    if (cell.biome === 'wetland') return 3.2 * strength;
    if (cell.landform === 'hills') return 2.2 * strength;
    if (cell.landform === 'plateau') return 2.4 * strength;
    if (cell.landform === 'mountain' || cell.landform === 'volcanic_field') return 4.5 * strength;
    if (cell.biome === 'desert_hot' || cell.biome === 'desert_cold' || cell.biome === 'steppe')
      return 3.0 * strength;
    if (cell.biome === 'tundra' || cell.biome === 'ice') return 2.8 * strength;
    return 1.8 * strength;
  }

  static border(cell: TCell, borderType: TBorderType) {
    const profile = BORDER_CONFIG[borderType];
    const landformCost = profile.landformCost[cell.landform];
    const biomeCost = profile.biomeCost[cell.biome];
    return landformCost * 0.7 + biomeCost * 0.3;
  }
}

/**
 * Per cell, how much living nearby (population smoothed over the neighbours, square-rooted so a big
 * city does not drown out every other settled valley) is worth as a nation seed.
 */
export function buildPopulationSeedBonus(cells: TCell[]) {
  let current = Float64Array.from(cells, (cell) => (isLand(cell) ? cell.population : 0));
  for (let pass = 0; pass < NATION_SEED_CONFIG.smoothingPasses; pass += 1) {
    const next = new Float64Array(current.length);
    for (let id = 0; id < cells.length; id += 1) {
      if (!isLand(cells[id])) continue;
      let sum = current[id];
      for (const neighborId of cells[id].neighbors) sum += current[neighborId];
      next[id] = sum / (cells[id].neighbors.length + 1);
    }
    current = next;
  }
  const max = current.reduce((a, b) => Math.max(a, b), 0);
  const cityCells = new Set(getCityCells(cells));
  return current.map((value, id) => {
    if (max <= 0) return 0;
    return (
      Math.sqrt(value / max) * NATION_SEED_CONFIG.populationWeight +
      (cityCells.has(id) ? NATION_SEED_CONFIG.cityBonus : 0)
    );
  });
}

export function getNationSeedSuitability(cellId: number, cells: TCell[]) {
  const cell = cells[cellId];
  if (!isLand(cell)) return -1000;

  let score = 0;
  if (cell.landform === 'plain') score += 2.3;
  if (cell.landform === 'valley') score += 1.9;
  if (cell.biome === 'temperate_forest' || cell.biome === 'tropical_forest') score += 0.6;
  if (cell.landform === 'mountain' || cell.landform === 'volcanic_field') score -= 2.8;
  if (cell.biome === 'desert_hot' || cell.biome === 'desert_cold' || cell.biome === 'steppe')
    score -= 1.8;

  if (cell.isRiver) score += 1.8;
  if (cell.isLake) score += 1.3;

  for (const neighborId of cell.neighbors) {
    const neighbor = cells[neighborId];
    if (neighbor.isWater && !neighbor.isLake) score += 0.22;
    if (neighbor.isRiver || neighbor.isLake) score += 0.35;
  }
  score += cell.suitability * 1.1;
  return score;
}

export function getProvinceSeedScore(cell: TCell) {
  if (!isLand(cell)) return -1000;
  if (cell.landform === 'plain') return 7 + cell.suitability * 2;
  if (cell.landform === 'valley') return 6.5 + cell.suitability * 2;
  if (cell.landform === 'coast') return 5.2 + cell.suitability * 1.8;
  if (cell.biome === 'temperate_forest' || cell.biome === 'tropical_forest')
    return 3.5 + cell.suitability;
  if (cell.landform === 'hills' || cell.landform === 'plateau') return 1.8 + cell.suitability * 0.8;
  if (
    cell.landform === 'mountain' ||
    cell.landform === 'volcanic_field' ||
    cell.biome === 'desert_hot' ||
    cell.biome === 'desert_cold'
  )
    return -4;
  return 1.2 + cell.suitability * 0.8;
}
