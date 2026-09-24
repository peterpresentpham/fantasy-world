import { BIOME_CONFIG } from 'src/configs/map/landform-biome';
import { TBiome, TCell, TDelaunayMesh, TLandform } from 'src/types/global';
import { isWaterOrRiverCell } from 'src/services/utils/cell';
import { buildDistanceMap } from 'src/services/utils/graph';
import { clamp, createSeededRandom, tentScore } from 'src/services/utils/math';

interface TPopulationParams {
  mesh: TDelaunayMesh;
  seed: string;
}

const POP_MODEL = {
  climate: {
    tempIdeal: 0.58,
    tempTolerance: 0.22,
    precipIdeal: 0.52,
    precipTolerance: 0.26,
  },
  water: {
    distanceDecay: 18,
    riverBonus: 0.22,
    nearLakeOrSeaBonus: 0.14,
    nearWaterNeighborBonus: 0.08,
    min: 0.15,
    max: 1.35,
  },
  noise: { min: 0.9, range: 0.2 },
  urban: {
    cityCountDivisor: 900,
    minCityCount: 4,
    maxCityCount: 18,
    minSeedDistance: 55,
    minRadius: 95,
    radiusRange: 55,
    minBoost: 0.9,
    boostRange: 0.7,
  },
};

function calcWaterAccessBase(cells: TCell[]) {
  const distances = buildDistanceMap(cells, {
    isSeed: (cellId) => {
      const landform = cells[cellId].landform;
      return landform === 'marine_deep' || landform === 'marine_shallow';
    },
  });

  const accessibility = new Float64Array(cells.length);
  for (let cellId = 0; cellId < cells.length; cellId += 1) {
    const distance = distances[cellId];
    if (distance < 0) {
      accessibility[cellId] = 0.2;
      continue;
    }
    accessibility[cellId] = clamp(
      Math.exp(-distance / POP_MODEL.water.distanceDecay),
      POP_MODEL.water.min,
      1
    );
  }
  return accessibility;
}

function calcRiverAccess(cells: TCell[]) {
  const distances = buildDistanceMap(cells, {
    isSeed: (cellId) => {
      const cell = cells[cellId];
      return !!(cell.isRiver || (cell.isLake && !cell.isWater));
    },
  });
  const access = new Float64Array(cells.length);
  for (let cellId = 0; cellId < cells.length; cellId += 1) {
    const d = distances[cellId];
    if (d < 0) {
      access[cellId] = 1.0;
      continue;
    }
    access[cellId] = clamp(Math.exp(-d / 8), 0, 1);
  }
  return access;
}

function urbanEligibilityScore(cell: TCell): number {
  if (cell.biome === 'ice') return 0.02;
  if (cell.biome === 'tundra') return 0.08;
  if (cell.landform === 'mountain') return 0.12;
  if (cell.biome === 'desert_hot') return 0.15;
  if (cell.biome === 'desert_cold') return 0.22;
  return 1.0;
}

function carryingCapacity(cell: TCell): number {
  const biomeCapacity: Partial<Record<TBiome, number>> = {
    plain: 1.8,
    grassland: 1.2,
    temperate_forest: 0.85,
    savanna: 0.7,
    tropical_forest: 0.4,
    boreal_forest: 0.38,
    steppe: 0.55,
    wetland: 0.6,
    desert_hot: 0.1,
    desert_cold: 0.14,
    tundra: 0.07,
    ice: 0.02,
    montane_shrub: 0.35,
  };
  const landformBonus: Partial<Record<TLandform, number>> = {
    plain: 0.3,
    valley: 0.25,
    coast: 0.1,
    volcanic_field: 0.4,
    mountain: -0.2,
    plateau: -0.05,
  };
  const base = biomeCapacity[cell.biome] ?? 0.65;
  const bonus = landformBonus[cell.landform] ?? 0;
  return clamp(base + bonus, 0.02, 2.0);
}

// Population-specific climate fitness — separately tuned from
// hydrology/climate.ts's getSuitabilityByLandformBiome (general terrain
// suitability, different ideal points/weights). Kept distinct rather than
// unified: the two formulas feed deterministic, hash-verified generation
// output, and their arithmetic forms aren't guaranteed bit-identical once
// merged.
function climateSuitability(cell: TCell) {
  const tScore = tentScore(
    cell.temperature,
    POP_MODEL.climate.tempIdeal,
    POP_MODEL.climate.tempTolerance
  );
  const pScore = tentScore(
    cell.precipitation,
    POP_MODEL.climate.precipIdeal,
    POP_MODEL.climate.precipTolerance
  );
  return Math.max(0.08, tScore * 0.55 + pScore * 0.45);
}

function isNearLakeOrSea(cell: TCell, cells: TCell[]) {
  return cell.neighbors.some((neighborId) => {
    const neighbor = cells[neighborId];
    return neighbor?.landform === 'lake' || neighbor?.landform === 'marine_shallow';
  });
}

function adjustedWaterAccess(cell: TCell, cells: TCell[], baseWaterAccess: number) {
  let value = baseWaterAccess;
  if (cell.isRiver) value += POP_MODEL.water.riverBonus;
  if (isNearLakeOrSea(cell, cells)) value += POP_MODEL.water.nearLakeOrSeaBonus;
  if (cell.neighbors.some((neighborId) => isWaterOrRiverCell(cells[neighborId] as TCell))) {
    value += POP_MODEL.water.nearWaterNeighborBonus;
  }
  return clamp(value, POP_MODEL.water.min, POP_MODEL.water.max);
}

function humanSettlementBoost(cell: TCell) {
  if (cell.biome === 'plain') return 1.35;
  if (cell.biome === 'wetland') return 0.85;
  if (cell.biome === 'desert_hot' || cell.biome === 'desert_cold') return 0.75;
  return 1;
}

function economyFactor(cell: TCell) {
  let factor = 1;
  if (cell.landform === 'coast') factor += 0.8;
  if (cell.landform === 'valley') factor += 0.3;
  if (cell.landform === 'mountain') factor -= 0.25;
  if (cell.landform === 'volcanic_field') factor += 0.55;
  if (cell.biome === 'wetland') factor -= 0.15;
  if (cell.biome === 'temperate_forest' || cell.biome === 'tropical_forest') factor += 0.1;
  if (cell.biome === 'desert_hot' || cell.biome === 'desert_cold') factor -= 0.25;
  return Math.max(0.2, factor);
}

export function buildPopulation({ mesh, seed }: TPopulationParams): TDelaunayMesh {
  const cells = mesh.cells;
  const random = createSeededRandom(`${seed}:population`);
  const score = new Float64Array(cells.length);
  const waterAccessScore = calcWaterAccessBase(cells);
  const riverAccessScore = calcRiverAccess(cells);
  const climateSuitabilityByCell = new Float64Array(cells.length);
  const adjustedWaterAccessByCell = new Float64Array(cells.length);
  const humanSettlementByCell = new Float64Array(cells.length);
  const economyFactorByCell = new Float64Array(cells.length);
  const urbanEligibilityByCell = new Float64Array(cells.length);
  let landCellCount = 0;

  for (let cellId = 0; cellId < cells.length; cellId += 1) {
    const cell = cells[cellId];
    if (cell.isWater) {
      score[cellId] = 0;
      climateSuitabilityByCell[cellId] = 0;
      adjustedWaterAccessByCell[cellId] = waterAccessScore[cell.id] as number;
      humanSettlementByCell[cellId] = 0;
      economyFactorByCell[cellId] = 0;
      urbanEligibilityByCell[cellId] = 0;
      continue;
    }
    landCellCount += 1;

    const biome = BIOME_CONFIG[cell.biome].populationFactor;
    const climate = climateSuitability(cell);
    const baseWater = adjustedWaterAccess(cell, cells, waterAccessScore[cell.id] as number);
    // River valley corridor: rivers are settlement magnets even deep inland
    const riverBonus = (riverAccessScore[cellId] as number) * 0.4;
    const water = clamp(baseWater + riverBonus, POP_MODEL.water.min, 1.5);
    const human = humanSettlementBoost(cell);
    const terrainEconomyFactor = economyFactor(cell);
    climateSuitabilityByCell[cellId] = climate;
    adjustedWaterAccessByCell[cellId] = water;
    humanSettlementByCell[cellId] = human;
    economyFactorByCell[cellId] = terrainEconomyFactor;
    urbanEligibilityByCell[cellId] = urbanEligibilityScore(cell);
    const noise = POP_MODEL.noise.min + random() * POP_MODEL.noise.range;
    let value = biome * climate * water * human * noise;
    value *= 0.8 + cell.suitability * 0.35;
    score[cellId] = Math.max(0, value);
  }

  const urbanCandidates: Array<{ id: number; score: number }> = [];
  for (const cell of cells) {
    const eligibility = urbanEligibilityByCell[cell.id] as number;
    if (eligibility <= 0.01) continue;
    const candidateScore = (score[cell.id] + cell.suitability * 0.6) * eligibility;
    if (candidateScore <= 0.25) continue;
    urbanCandidates.push({ id: cell.id, score: candidateScore });
  }
  urbanCandidates.sort((a, b) => b.score - a.score);

  const cityCount = Math.max(
    POP_MODEL.urban.minCityCount,
    Math.min(
      POP_MODEL.urban.maxCityCount,
      Math.floor(landCellCount / POP_MODEL.urban.cityCountDivisor)
    )
  );
  const citySeeds: number[] = [];
  const minSeedDistSq = POP_MODEL.urban.minSeedDistance * POP_MODEL.urban.minSeedDistance;

  for (const candidate of urbanCandidates) {
    if (citySeeds.length >= cityCount) break;
    const point = cells[candidate.id].site;
    const tooClose = citySeeds.some((seedId) => {
      const seedPoint = cells[seedId].site;
      const dx = point[0] - seedPoint[0];
      const dy = point[1] - seedPoint[1];
      return dx * dx + dy * dy < minSeedDistSq;
    });
    if (tooClose) continue;
    citySeeds.push(candidate.id);
  }

  for (const seedId of citySeeds) {
    const seedPoint = cells[seedId].site;
    const radius = POP_MODEL.urban.minRadius + random() * POP_MODEL.urban.radiusRange;
    const boost = POP_MODEL.urban.minBoost + random() * POP_MODEL.urban.boostRange;
    const radiusSq = radius * radius;

    for (let cellId = 0; cellId < cells.length; cellId += 1) {
      const cell = cells[cellId];
      if (cell.isWater) continue;
      const dx = cell.site[0] - seedPoint[0];
      const dy = cell.site[1] - seedPoint[1];
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq > radiusSq) continue;
      const distance = Math.sqrt(distanceSq);
      const distanceFactor = 1 - distance / radius;
      const suitability = climateSuitabilityByCell[cellId] as number;
      const settlement = humanSettlementByCell[cellId] as number;
      score[cellId] += distanceFactor * boost * (0.45 + suitability * 0.55) * settlement;
    }
  }

  const next = new Float64Array(score.length);
  for (let pass = 0; pass < 2; pass += 1) {
    for (let cellId = 0; cellId < cells.length; cellId += 1) {
      if (cells[cellId].isWater) {
        next[cellId] = 0;
        continue;
      }
      let sum = score[cellId];
      for (const neighborId of cells[cellId].neighbors) {
        sum += score[neighborId];
      }
      const avg = sum / (cells[cellId].neighbors.length + 1);
      next[cellId] = score[cellId] * 0.62 + avg * 0.38;
    }
    score.set(next);
  }

  for (let cellId = 0; cellId < cells.length; cellId += 1) {
    const cell = cells[cellId];
    if (cell.isWater) continue;
    const isHarsh =
      cell.biome === 'ice' ||
      cell.biome === 'tundra' ||
      cell.landform === 'mountain' ||
      cell.biome === 'desert_hot' ||
      cell.biome === 'desert_cold';
    if (!isHarsh) continue;
    let neighborAvg = 0;
    for (const neighborId of cell.neighbors) {
      neighborAvg += score[neighborId];
    }
    neighborAvg /= Math.max(1, cell.neighbors.length);
    // Ice/tundra: hard cap; mountains/deserts: soft cap allowing rare large cities
    const capMultiplier = cell.biome === 'ice' ? 0.5 : cell.biome === 'tundra' ? 0.9 : 1.5;
    score[cellId] = Math.min(score[cellId], neighborAvg * capMultiplier);
  }

  let maxScore = 0;
  for (let cellId = 0; cellId < cells.length; cellId += 1) {
    if (cells[cellId].isWater) continue;
    maxScore = Math.max(maxScore, score[cellId]);
  }

  const normalizedMax = Math.max(0.0001, maxScore);
  const nextCells = cells.map((cell) => {
    if (cell.isWater)
      return {
        ...cell,
        population: 0,
        economy: 0,
        waterAccessScore: waterAccessScore[cell.id],
      };
    const density = clamp(score[cell.id] / normalizedMax, 0, 1);
    const shaped = Math.pow(density, 1.08);
    const basePopulation = Math.round(shaped * 15000);
    const adjustedWater = adjustedWaterAccessByCell[cell.id] as number;
    const population = Math.round(basePopulation * adjustedWater * carryingCapacity(cell));

    const terrainFactor = economyFactorByCell[cell.id] as number;
    const waterFactor = 0.7 + adjustedWater * 1.1;
    const popNorm = clamp(population / 120000, 0, 1);
    const waterNorm = clamp(adjustedWater, 0, 1);
    const synergyMultiplier = 1 + popNorm * waterNorm * 1.35;
    const economy = Math.round(
      Math.pow(Math.max(0, population), 1.12) * terrainFactor * waterFactor * synergyMultiplier
    );

    return { ...cell, population, economy, waterAccessScore: adjustedWater };
  });
  return { ...mesh, cells: nextCells };
}
