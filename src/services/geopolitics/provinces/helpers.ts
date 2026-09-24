import {
  DEFAULT_MIN_PROVINCE_POPULATION,
  IDEAL_PROVINCE_POP,
  MAX_POP_PERCENT,
  MAX_PROVINCE_POP,
  MIN_POP_PERCENT,
  PROVINCE_TUNING,
  SMALL_NATION_MIN_PROVINCE_POPULATION,
  SMALL_NATION_POPULATION_THRESHOLD,
} from 'src/configs/map/geopolitics';
import { TCell } from 'src/types/global';
import { clamp } from 'src/services/utils/math';

/** Terrain-adjusted management weight for province size calculations. */
export function getProvinceCellWeight(cell: TCell) {
  let weight = 1;
  if (cell.landform === 'mountain') weight += 0.7;
  else if (cell.landform === 'volcanic_field') weight += 0.8;
  else if (cell.landform === 'hills') weight += 0.4;
  else if (cell.landform === 'plateau') weight += 0.3;
  else if (cell.landform === 'coast') weight += 0.15;

  if (cell.biome === 'wetland') weight += 0.25;
  else if (cell.biome === 'desert_hot' || cell.biome === 'desert_cold') weight += 0.2;
  else if (cell.biome === 'tundra' || cell.biome === 'ice') weight += 0.15;

  return weight;
}

export function computeSize(cellIds: number[], cellsWeight: Float32Array) {
  let sum = 0;
  for (const cellId of cellIds) sum += cellsWeight[cellId];
  return sum;
}

export function getSquaredDistance(a: TCell, b: TCell) {
  const dx = a.site[0] - b.site[0];
  const dy = a.site[1] - b.site[1];
  return dx * dx + dy * dy;
}

export function groupNationCellsByProvince(nationCellIds: number[], provinceOwner: Int32Array) {
  const provinceToCells = new Map<number, number[]>();
  for (const cellId of nationCellIds) {
    const provinceId = provinceOwner[cellId];
    if (provinceId < 0) continue;
    if (!provinceToCells.has(provinceId)) provinceToCells.set(provinceId, []);
    (provinceToCells.get(provinceId) as number[]).push(cellId);
  }
  return provinceToCells;
}

export function buildProvinceAggregates(
  nationCellIds: number[],
  provinceOwner: Int32Array,
  cells: TCell[]
) {
  const provinceSize = new Map<number, number>();
  const provincePopulation = new Map<number, number>();
  const provinceEconomy = new Map<number, number>();
  for (const cellId of nationCellIds) {
    const provinceId = provinceOwner[cellId];
    if (provinceId < 0) continue;
    provinceSize.set(provinceId, (provinceSize.get(provinceId) || 0) + 1);
    provincePopulation.set(
      provinceId,
      (provincePopulation.get(provinceId) || 0) + cells[cellId].population
    );
    provinceEconomy.set(provinceId, (provinceEconomy.get(provinceId) || 0) + cells[cellId].economy);
  }
  return { provinceSize, provincePopulation, provinceEconomy };
}

export function getMinProvinceSize(nationSize: number, nationCellCount: number) {
  if (nationCellCount < 10) return nationSize;
  return Math.max(6, Math.ceil(nationSize * 0.02));
}

export function isNationSplit(
  nationPopulation: number,
  nationCellCount: number,
  nationSize: number
) {
  const avgPopPerCell = nationPopulation / Math.max(1, nationCellCount);
  return avgPopPerCell < 2000 && nationCellCount < 20 && nationSize < 26;
}

export function isIgnorePopulationRules(
  nationPopulation: number,
  nationCellCount: number,
  nationSize: number
) {
  const avgPopPerCell = nationPopulation / Math.max(1, nationCellCount);
  const ruggedSparseNation =
    nationCellCount >= 24 &&
    avgPopPerCell < 1300 &&
    nationSize / Math.max(1, nationCellCount) > 1.35;
  return (nationCellCount >= 30 && avgPopPerCell < 1200) || ruggedSparseNation;
}

export function isSmallNation(nationPopulation: number) {
  return nationPopulation <= SMALL_NATION_POPULATION_THRESHOLD;
}

export function getNationMinProvincePop(nationPopulation: number) {
  return isSmallNation(nationPopulation)
    ? SMALL_NATION_MIN_PROVINCE_POPULATION
    : DEFAULT_MIN_PROVINCE_POPULATION;
}

export function getBasedMinProvince(nationPopulation: number) {
  if (nationPopulation > SMALL_NATION_POPULATION_THRESHOLD) return 2;
  return 1;
}

export function calcMinProvincePopulation(targetPopulation: number, nationPopulation: number) {
  return Math.max(getNationMinProvincePop(nationPopulation), Math.floor(targetPopulation * 0.7));
}

export function getMinProvincePopulation(nationPopulation: number) {
  if (nationPopulation > 1_000_000) return Math.ceil(nationPopulation / IDEAL_PROVINCE_POP);
  if (nationPopulation > 500_000 && nationPopulation <= 1_000_000) return 3;
  if (nationPopulation >= 300_000 && nationPopulation <= 500_000) return 2;
  return 1;
}

export function getRequiredMinProvince(
  nationPopulation: number,
  nationCellCount: number,
  minProvincePopulation: number,
  isNationSplit: boolean,
  isIgnore: boolean
) {
  const basedMinProvince = getBasedMinProvince(nationPopulation);
  const originalMinProvinceCount = Math.max(
    getMinProvincePopulation(nationPopulation),
    isNationSplit || isIgnore || nationPopulation >= 200000 ? 2 : basedMinProvince
  );
  const popMinProvinceCount = Math.ceil(nationPopulation / IDEAL_PROVINCE_POP);
  const cellMinProvinceCount = Math.floor(nationCellCount / 25);
  const minProvinceCount = Math.max(
    originalMinProvinceCount,
    popMinProvinceCount,
    cellMinProvinceCount
  );
  const hardFloorMaxProvinces = Math.max(1, Math.floor(1 / MIN_POP_PERCENT));
  const maxByCells = Math.max(1, nationCellCount);
  const maxByPopulation =
    minProvincePopulation > 0
      ? Math.max(1, Math.floor(nationPopulation / minProvincePopulation))
      : Number.POSITIVE_INFINITY;
  const maxByRule = isSmallNation(nationPopulation) ? 3 : Number.POSITIVE_INFINITY;
  const popCappedMax = basedMinProvince >= 2 ? Number.POSITIVE_INFINITY : maxByPopulation;
  return Math.min(
    hardFloorMaxProvinces,
    Math.min(minProvinceCount, Math.max(1, Math.min(maxByCells, popCappedMax, maxByRule)))
  );
}

export function getProvincePlanMetrics(
  nationPopulation: number,
  nationCellCount: number,
  nationSize: number,
  isNationSplit: boolean,
  isIgnore: boolean
) {
  const minProvinceSize = isNationSplit ? 1 : getMinProvinceSize(nationSize, nationCellCount);
  const maxByEffectiveSize = Math.max(1, Math.floor(nationSize / Math.max(1, minProvinceSize)));
  const baselineByPopulation = getMinProvincePopulation(nationPopulation);
  let baselineTarget = Math.max(1, Math.min(maxByEffectiveSize, baselineByPopulation));
  if (nationPopulation > 1_000_000) {
    baselineTarget = clamp(
      baselineTarget,
      Math.floor(1 / MAX_POP_PERCENT),
      Math.floor(1 / MIN_POP_PERCENT)
    );
  }
  const targetPopPerProvince = nationPopulation / Math.max(1, baselineTarget);
  const minProvincePopulation = calcMinProvincePopulation(targetPopPerProvince, nationPopulation);
  const requiredMinProvince = getRequiredMinProvince(
    nationPopulation,
    nationCellCount,
    minProvincePopulation,
    isNationSplit,
    isIgnore
  );
  const maxByCells = Math.max(1, Math.floor(nationSize / Math.max(1, minProvinceSize)));
  const maxByPopulation =
    minProvincePopulation > 0
      ? Math.max(1, Math.floor(nationPopulation / minProvincePopulation))
      : Number.POSITIVE_INFINITY;
  const maxByRule = isSmallNation(nationPopulation) ? 3 : Number.POSITIVE_INFINITY;
  const minProvinceCountByRule = getBasedMinProvince(nationPopulation);
  const popCappedMax = minProvinceCountByRule >= 2 ? Number.POSITIVE_INFINITY : maxByPopulation;
  const maxProvinceCount = Math.max(
    minProvinceCountByRule,
    Math.min(maxByCells, popCappedMax, maxByRule)
  );
  return {
    minProvinceSize,
    baselineTarget,
    minProvincePopulation,
    requiredMinProvince,
    maxProvinceCount,
  };
}

export function getPopulationBounds(nationPopulation: number, targetProvinceCount: number) {
  const target = nationPopulation / Math.max(1, targetProvinceCount);
  return {
    target,
    min: Math.max(Math.floor(nationPopulation * MIN_POP_PERCENT), Math.floor(target * 0.7)),
    max: Math.min(
      MAX_PROVINCE_POP,
      Math.floor(nationPopulation * MAX_POP_PERCENT),
      Math.ceil(target * 1.2)
    ),
  };
}

export function isMetropolis(
  cells: number[],
  population: number,
  maxPopulation: number,
  minSize: number,
  cellsWeight: Float32Array
) {
  if (cells.length > 2) return false;
  if (population <= maxPopulation) return false;
  const effectiveSize = computeSize(cells, cellsWeight);
  return effectiveSize <= minSize;
}

export function getAverageTerrainFactor(cellIds: number[], cellsWeight: Float32Array) {
  if (cellIds.length === 0) return 1;
  return computeSize(cellIds, cellsWeight) / cellIds.length;
}

export function getDominantLandform(cellIds: number[], cells: TCell[]) {
  const counts = new Map<string, number>();
  for (const cellId of cellIds) {
    const landform = cells[cellId].landform;
    counts.set(landform, (counts.get(landform) || 0) + 1);
  }
  let dominant = 'plain';
  let best = -1;
  for (const [landform, count] of counts) {
    if (count > best) {
      best = count;
      dominant = landform;
    }
  }
  return dominant;
}

export function getCellCapByDensity(population: number, cellCount: number) {
  const density = population / Math.max(1, cellCount);
  if (density > 10_000) return 20;
  if (density < 1_000) return 150;
  const t = (density - 1_000) / 9_000;
  return Math.round(150 - t * 130);
}

export function getMaxProvincePopShare(nationPopulation: number) {
  if (nationPopulation <= 1_000_000) return 0.5;
  if (nationPopulation <= 2_000_000) return 0.4;
  if (nationPopulation <= 5_000_000) return 0.35;
  return 0.3;
}

export function getProvinceTargetCount(
  cells: TCell[],
  minProvinceSize: number,
  nationSize: number,
  maxProvinceCount: number
) {
  if (cells.length < 10) return 1;

  const totalPopulation = cells.reduce((sum, cell) => sum + cell.population, 0);
  const avgPopulation = totalPopulation / Math.max(1, cells.length);

  const pressureSum = cells.reduce((sum, cell) => {
    const populationFactor = clamp(cell.population / Math.max(1, avgPopulation), 0, 2.6);
    const ruggedPenalty =
      cell.landform === 'mountain' ||
      cell.landform === 'volcanic_field' ||
      cell.biome === 'desert_hot' ||
      cell.biome === 'desert_cold'
        ? 0.22
        : 0;
    const lowPopulation =
      cell.population < avgPopulation * PROVINCE_TUNING.thresholds.lowPopulationRatio;
    const remotePlain =
      (cell.landform === 'plain' || cell.landform === 'valley') &&
      cell.waterAccessScore < PROVINCE_TUNING.thresholds.remotePlainWaterAccessScoreMax &&
      !cell.isRiver &&
      !cell.isLake;
    const sparseLargeProvinceBias =
      lowPopulation &&
      (cell.landform === 'mountain' ||
        cell.landform === 'volcanic_field' ||
        cell.biome === 'desert_hot' ||
        cell.biome === 'desert_cold' ||
        remotePlain)
        ? PROVINCE_TUNING.thresholds.sparseLargeProvinceBias
        : 0;
    const waterBonus =
      clamp(cell.waterAccessScore, 0, 1) * PROVINCE_TUNING.thresholds.pressure.waterFactor +
      (cell.isRiver || cell.isLake ? PROVINCE_TUNING.thresholds.pressure.waterNodeBonus : 0);
    const pressure = clamp(
      1 +
        populationFactor * PROVINCE_TUNING.thresholds.pressure.popFactor +
        waterBonus -
        ruggedPenalty -
        sparseLargeProvinceBias,
      PROVINCE_TUNING.thresholds.pressure.min,
      PROVINCE_TUNING.thresholds.pressure.max
    );
    return sum + pressure;
  }, 0);

  const pressureAverage = pressureSum / Math.max(1, cells.length);
  const baseCount = nationSize / Math.max(1, minProvinceSize * 2.8);
  const pressureScaled = baseCount * (0.7 + pressureAverage * 0.9);
  const target = Math.max(1, Math.round(pressureScaled));
  return clamp(target, 1, maxProvinceCount);
}
