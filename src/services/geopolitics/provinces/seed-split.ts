import { MAX_PROVINCE_POP, MIN_POP_PERCENT, PROVINCE_TUNING } from 'src/configs/map/geopolitics';
import { TCell } from 'src/types/global';
import { sortDescStable } from 'src/services/utils';
import { runMultiSourceExpansion } from 'src/services/utils/graph';
import { hashSeed } from 'src/services/utils/math';
import { getProvinceSeedScore } from '../cost';
import { getBoundaryStepCost, getOwnerLandCellIds, isLand } from '../shared';
import {
  computeSize,
  getCellCapByDensity,
  getMaxProvincePopShare,
  getPopulationBounds,
  getProvinceCellWeight,
  getProvincePlanMetrics,
  getProvinceTargetCount,
  getSquaredDistance,
  groupNationCellsByProvince,
  isIgnorePopulationRules,
  isMetropolis,
  isNationSplit,
} from './helpers';

export function enforceMinProvince(
  cells: TCell[],
  nationCellIds: number[],
  provinceOwner: Int32Array,
  requiredMinProvinceCount: number,
  nationPopulation: number,
  nextProvinceIdRef: { value: number }
) {
  const hardFloorPopulation = Math.floor(nationPopulation * MIN_POP_PERCENT);
  while (true) {
    const provinceIds = Array.from(
      new Set(nationCellIds.map((cellId) => provinceOwner[cellId]).filter((id) => id >= 0))
    );
    if (provinceIds.length >= requiredMinProvinceCount) break;
    if (provinceIds.length === 0) break;

    const pToCells = groupNationCellsByProvince(nationCellIds, provinceOwner);
    let largestProvinceId = provinceIds[0] as number;
    let largestCells = pToCells.get(largestProvinceId) ?? [];
    for (const provinceId of provinceIds) {
      const pCells = pToCells.get(provinceId) ?? [];
      if (pCells.length > largestCells.length) {
        largestProvinceId = provinceId;
        largestCells = pCells;
      }
    }
    if (largestCells.length < 2) break;
    const largestProvincePopulation = largestCells.reduce(
      (sum, cellId) => sum + cells[cellId].population,
      0
    );
    if (largestProvincePopulation < hardFloorPopulation * 2) break;

    const seedA = largestCells[0] as number;
    let seedB = largestCells[0] as number;
    let bestDistance = -1;
    for (const cellId of largestCells) {
      const distance = Math.hypot(
        cells[cellId].site[0] - cells[seedA].site[0],
        cells[cellId].site[1] - cells[seedA].site[1]
      );
      if (distance > bestDistance) {
        bestDistance = distance;
        seedB = cellId;
      }
    }
    if (seedA === seedB) break;

    const newProvinceId = nextProvinceIdRef.value;
    nextProvinceIdRef.value += 1;
    provinceOwner[seedB] = newProvinceId;

    for (const cellId of largestCells) {
      if (cellId === seedA || cellId === seedB) continue;
      const distanceToA = Math.hypot(
        cells[cellId].site[0] - cells[seedA].site[0],
        cells[cellId].site[1] - cells[seedA].site[1]
      );
      const distanceToB = Math.hypot(
        cells[cellId].site[0] - cells[seedB].site[0],
        cells[cellId].site[1] - cells[seedB].site[1]
      );
      provinceOwner[cellId] = distanceToB < distanceToA ? newProvinceId : largestProvinceId;
    }
  }
}

function assignProvincesBySeeds(
  cells: TCell[],
  owner: Int32Array,
  nationId: number,
  seeds: number[],
  provinceOwner: Int32Array,
  startProvinceId: number,
  noiseHash: number
) {
  const localCost = new Float64Array(cells.length);
  localCost.fill(Number.POSITIVE_INFINITY);
  const seedStates: Array<{ cellId: number; provinceId: number; cost: number }> = [];
  const seedLandformByProvinceId = new Map<number, string>();

  for (let seedIndex = 0; seedIndex < seeds.length; seedIndex += 1) {
    const cellId = seeds[seedIndex];
    const provinceId = startProvinceId + seedIndex;
    provinceOwner[cellId] = provinceId;
    localCost[cellId] = 0;
    seedLandformByProvinceId.set(provinceId, cells[cellId].landform);
    seedStates.push({ cellId, provinceId, cost: 0 });
  }

  runMultiSourceExpansion({
    seeds: seedStates,
    getPriority: (state) => state.cost,
    isStale: (state) => state.cost > localCost[state.cellId],
    expand: (current, push) => {
      for (const neighborId of cells[current.cellId].neighbors) {
        if (owner[neighborId] !== nationId) continue;
        if (!isLand(cells[neighborId])) continue;

        const step = getBoundaryStepCost(
          cells,
          provinceOwner,
          current.cellId,
          neighborId,
          current.provinceId,
          noiseHash,
          'province'
        );

        const seedLandform = seedLandformByProvinceId.get(current.provinceId);
        const terrainMismatchMultiplier =
          seedLandform && cells[neighborId].landform !== seedLandform ? 3 : 1;
        const nextCost = current.cost + Math.max(0.25, step * terrainMismatchMultiplier);
        if (nextCost < localCost[neighborId]) {
          localCost[neighborId] = nextCost;
          provinceOwner[neighborId] = current.provinceId;
          push({ cellId: neighborId, provinceId: current.provinceId, cost: nextCost });
        }
      }
    },
  });
}

export function buildNationProvinces(cells: TCell[], owner: Int32Array, seed: string) {
  const provinceOwner = new Int32Array(cells.length);
  provinceOwner.fill(-1);
  const cellsWeight = new Float32Array(cells.length);
  for (let cellId = 0; cellId < cells.length; cellId += 1) {
    cellsWeight[cellId] = getProvinceCellWeight(cells[cellId] as TCell);
  }
  let nextProvinceId = 0;
  const nationIds = Array.from(new Set(owner)).filter((nationId) => nationId >= 0);

  for (const nationId of nationIds) {
    const nationCellIds = getOwnerLandCellIds(cells, owner, nationId);
    if (nationCellIds.length === 0) continue;
    const nationPopulation = nationCellIds.reduce(
      (sum, cellId) => sum + cells[cellId].population,
      0
    );
    const nationSize = computeSize(nationCellIds, cellsWeight);
    const smallNationSplit = isNationSplit(nationPopulation, nationCellIds.length, nationSize);
    const isIgnore = isIgnorePopulationRules(nationPopulation, nationCellIds.length, nationSize);
    if (
      (nationCellIds.length < 10 || nationSize < 10.5 || nationPopulation < 1200) &&
      !smallNationSplit
    ) {
      for (const cellId of nationCellIds) provinceOwner[cellId] = nextProvinceId;
      nextProvinceId += 1;
      continue;
    }

    const { minProvinceSize, requiredMinProvince, maxProvinceCount } = getProvincePlanMetrics(
      nationPopulation,
      nationCellIds.length,
      nationSize,
      smallNationSplit,
      isIgnore
    );
    const initialTarget = Math.max(
      requiredMinProvince,
      getProvinceTargetCount(
        nationCellIds.map((cellId) => cells[cellId]),
        minProvinceSize,
        nationSize,
        maxProvinceCount
      )
    );
    const basePopulationBounds = getPopulationBounds(nationPopulation, initialTarget);

    const scored = sortDescStable(
      nationCellIds.map((cellId) => ({ cellId, score: getProvinceSeedScore(cells[cellId]) }))
    );
    if (scored.length === 0) continue;

    const seeds: number[] = [];
    for (const entry of scored) {
      if (seeds.length >= initialTarget) break;
      const candidate = cells[entry.cellId];
      const requiredDistance =
        candidate.landform === 'plain' || candidate.landform === 'valley'
          ? PROVINCE_TUNING.seedDistance.plainOrValley
          : PROVINCE_TUNING.seedDistance.other;
      const minDistanceSquared = requiredDistance * requiredDistance;
      const tooClose = seeds.some(
        (seedCellId) => getSquaredDistance(candidate, cells[seedCellId]) < minDistanceSquared
      );
      if (tooClose) continue;
      seeds.push(entry.cellId);
    }
    if (seeds.length === 0) seeds.push(scored[0].cellId);
    for (const entry of scored) {
      if (seeds.length >= requiredMinProvince) break;
      if (seeds.includes(entry.cellId)) continue;
      seeds.push(entry.cellId);
    }

    const nationStartProvinceId = nextProvinceId;
    const noiseHash = hashSeed(`${seed}:province:${nationId}`);
    let usedMetroException = false;

    for (
      let splitIteration = 0;
      splitIteration < PROVINCE_TUNING.split.maxIterations;
      splitIteration += 1
    ) {
      for (const cellId of nationCellIds) {
        provinceOwner[cellId] = -1;
      }

      assignProvincesBySeeds(
        cells,
        owner,
        nationId,
        seeds,
        provinceOwner,
        nationStartProvinceId,
        noiseHash
      );

      const provinceToCells = groupNationCellsByProvince(nationCellIds, provinceOwner);

      const hasOverCapProvince = Array.from(provinceToCells.values()).some((provinceCells) => {
        const population = provinceCells.reduce((sum, cellId) => sum + cells[cellId].population, 0);
        return population > MAX_PROVINCE_POP;
      });

      let addedSeed = false;
      if (seeds.length < maxProvinceCount || hasOverCapProvince) {
        const dynamicPopulationBounds = getPopulationBounds(
          nationPopulation,
          Math.max(1, seeds.length)
        );
        const provincePopulationById = new Map<number, number>();
        for (const [provinceId, provinceCells] of provinceToCells) {
          provincePopulationById.set(
            provinceId,
            provinceCells.reduce((sum, cellId) => sum + cells[cellId].population, 0)
          );
        }
        const prioritizedByPopulation = Array.from(provinceToCells.entries()).sort(
          (left, right) =>
            (provincePopulationById.get(right[0]) || 0) - (provincePopulationById.get(left[0]) || 0)
        );
        for (const [provinceId, provinceCells] of prioritizedByPopulation) {
          const provincePopulation = provincePopulationById.get(provinceId) || 0;
          const cellCapByDensity = getCellCapByDensity(provincePopulation, provinceCells.length);
          const effectiveProvinceSize = computeSize(provinceCells, cellsWeight);
          const maxProvincePopulationShare = getMaxProvincePopShare(nationPopulation);
          const provincePopulationShare = provincePopulation / Math.max(1, nationPopulation);
          const exceedsHardPopulationCap = provincePopulation > dynamicPopulationBounds.max;
          const canUseMetropolisException =
            !usedMetroException &&
            isMetropolis(
              provinceCells,
              provincePopulation,
              dynamicPopulationBounds.max,
              minProvinceSize,
              cellsWeight
            );
          if (canUseMetropolisException) {
            usedMetroException = true;
            continue;
          }

          const shouldSplitByPopulation =
            exceedsHardPopulationCap ||
            (provincePopulationShare > maxProvincePopulationShare &&
              provincePopulation > basePopulationBounds.target * 1.05);
          const shouldSplitByDensityArea = provinceCells.length > cellCapByDensity;
          const shouldSplitByArea =
            effectiveProvinceSize > minProvinceSize * PROVINCE_TUNING.split.maxProvinceAreaFactor;
          if (!shouldSplitByPopulation && !shouldSplitByArea && !shouldSplitByDensityArea) continue;

          const seedCellId = seeds[provinceId - nationStartProvinceId];
          let farthestCellId = seedCellId;
          let farthestDistanceSq = -1;
          for (const cellId of provinceCells) {
            const dx = cells[cellId].site[0] - cells[seedCellId].site[0];
            const dy = cells[cellId].site[1] - cells[seedCellId].site[1];
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq > farthestDistanceSq) {
              farthestDistanceSq = distanceSq;
              farthestCellId = cellId;
            }
          }

          const minSeedDistanceSquared =
            PROVINCE_TUNING.seedDistance.minBetweenSeeds *
            PROVINCE_TUNING.seedDistance.minBetweenSeeds;
          const tooClose = seeds.some((existingSeedId) => {
            if (existingSeedId === seedCellId) return false;
            return (
              getSquaredDistance(cells[existingSeedId], cells[farthestCellId]) <
              minSeedDistanceSquared
            );
          });
          if (tooClose) continue;

          seeds.push(farthestCellId);
          addedSeed = true;
          break;
        }
      }
      if (!addedSeed) break;
    }
    nextProvinceId = nationStartProvinceId + seeds.length;
  }
  return provinceOwner;
}
