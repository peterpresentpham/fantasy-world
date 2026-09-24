import { MERGE_POP_CAP, MIN_POP_PERCENT, PROVINCE_TUNING } from 'src/configs/map/geopolitics';
import { TCell, TCellOwnerParams } from 'src/types/global';
import { findNearestCell } from 'src/services/utils/geometry';
import { getOwnerLandCellIds, reassignDisconnectedFragments } from '../shared';
import {
  buildProvinceAggregates,
  computeSize,
  getAverageTerrainFactor,
  getDominantLandform,
  getNationMinProvincePop,
  getPopulationBounds,
  getProvinceCellWeight,
  getProvincePlanMetrics,
  groupNationCellsByProvince,
  isIgnorePopulationRules,
  isNationSplit,
} from './helpers';
import { enforceMinProvince } from './seed-split';

/**
 * Merge provinces that fall below the hard floor (3% of national population).
 * Shared between minProvinceArea (includeTouchBonus) and limitProvincePopulation (no touch bonus).
 */
function mergeUnderfloorProvinces(
  cells: TCell[],
  owner: Int32Array,
  provinceOwner: Int32Array,
  nationId: number,
  nationCellIds: number[],
  nationPopulation: number,
  options: {
    maxPasses: number;
    mergeCap?: number;
    includeTouchBonus?: boolean;
  }
) {
  const hardFloorPopulation = Math.floor(nationPopulation * MIN_POP_PERCENT);
  const { maxPasses, mergeCap = Number.POSITIVE_INFINITY, includeTouchBonus = false } = options;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const provinceToCells = new Map<number, number[]>();
    for (const cellId of nationCellIds) {
      const provinceId = provinceOwner[cellId];
      if (provinceId < 0) continue;
      if (!provinceToCells.has(provinceId)) provinceToCells.set(provinceId, []);
      (provinceToCells.get(provinceId) as number[]).push(cellId);
    }

    const provincePop = new Map<number, number>();
    for (const [provinceId, cellIds] of provinceToCells) {
      provincePop.set(
        provinceId,
        cellIds.reduce((sum, cellId) => sum + cells[cellId].population, 0)
      );
    }

    const underFloor = Array.from(provinceToCells.entries())
      .filter(([provinceId]) => (provincePop.get(provinceId) || 0) < hardFloorPopulation)
      .sort((left, right) => (provincePop.get(left[0]) || 0) - (provincePop.get(right[0]) || 0));
    if (underFloor.length === 0) break;

    let changed = false;
    for (const [provinceId, cellIds] of underFloor) {
      const currentPop = provincePop.get(provinceId) || 0;
      if (currentPop >= hardFloorPopulation) continue;
      const dominantTerrain = getDominantLandform(cellIds, cells);

      const candidateScores = new Map<
        number,
        { touch: number; terrainMatch: number; mergedPop: number }
      >();
      for (const cellId of cellIds) {
        for (const neighborId of cells[cellId].neighbors) {
          if (owner[neighborId] !== nationId) continue;
          const candidateProvinceId = provinceOwner[neighborId];
          if (candidateProvinceId < 0 || candidateProvinceId === provinceId) continue;
          const mergedPop = (provincePop.get(candidateProvinceId) || 0) + currentPop;
          if (mergedPop > mergeCap) continue;
          const prev = candidateScores.get(candidateProvinceId);
          const terrainMatch = cells[neighborId].landform === dominantTerrain ? 1 : 0;
          if (!prev) {
            candidateScores.set(candidateProvinceId, { touch: 1, terrainMatch, mergedPop });
          } else {
            prev.touch += 1;
            prev.terrainMatch += terrainMatch;
            prev.mergedPop = mergedPop;
          }
        }
      }
      if (candidateScores.size === 0) continue;

      let bestProvinceId = -1;
      let bestScore = Number.NEGATIVE_INFINITY;
      for (const [candidateProvinceId, stat] of candidateScores) {
        const reachesFloor = stat.mergedPop >= hardFloorPopulation ? 1 : 0;
        const overshoot = Math.abs(stat.mergedPop - hardFloorPopulation);
        const score =
          reachesFloor * 1_000_000 +
          stat.terrainMatch * 10_000 +
          (includeTouchBonus ? stat.touch * 100 : 0) -
          overshoot * 0.001;
        if (score > bestScore) {
          bestScore = score;
          bestProvinceId = candidateProvinceId;
        }
      }
      if (bestProvinceId < 0) continue;

      for (const cellId of cellIds) provinceOwner[cellId] = bestProvinceId;
      changed = true;
    }
    if (!changed) break;
  }
}

export function minProvinceArea(params: TCellOwnerParams) {
  const { cells, owner, provinceOwner } = params;
  const nationIds = Array.from(new Set(owner)).filter((nationId) => nationId >= 0);
  const cellsWeight = new Float32Array(cells.length);
  for (let cellId = 0; cellId < cells.length; cellId += 1) {
    cellsWeight[cellId] = getProvinceCellWeight(cells[cellId] as TCell);
  }
  const nextProvinceIdRef = { value: Math.max(0, ...Array.from(provinceOwner)) + 1 };

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
      const provinceId = provinceOwner[nationCellIds[0] as number];
      for (const cellId of nationCellIds) provinceOwner[cellId] = provinceId;
      continue;
    }

    const { minProvinceSize, baselineTarget, minProvincePopulation, requiredMinProvince } =
      getProvincePlanMetrics(
        nationPopulation,
        nationCellIds.length,
        nationSize,
        smallNationSplit,
        isIgnore
      );
    const populationBounds = getPopulationBounds(nationPopulation, Math.max(1, baselineTarget));
    const assignedProvinceIds = Array.from(
      new Set(nationCellIds.map((cellId) => provinceOwner[cellId]).filter((id) => id >= 0))
    );
    if (assignedProvinceIds.length === 0) {
      const fallbackProvinceId = nextProvinceIdRef.value;
      nextProvinceIdRef.value += 1;
      for (const cellId of nationCellIds) provinceOwner[cellId] = fallbackProvinceId;
    }

    const { provinceSize, provincePopulation, provinceEconomy } = buildProvinceAggregates(
      nationCellIds,
      provinceOwner,
      cells
    );
    const nationAverageEconomyPerCell =
      nationCellIds.reduce((sum, cellId) => sum + cells[cellId].economy, 0) /
      Math.max(1, nationCellIds.length);

    const mandatoryMinProvincePop = getNationMinProvincePop(nationPopulation);
    const enforceMandatoryPopulationFloor = !isIgnore;
    const provinceToCellsMap = groupNationCellsByProvince(nationCellIds, provinceOwner);
    const smallProvinceIds = Array.from(provinceSize.keys()).filter((provinceId) => {
      const population = provincePopulation.get(provinceId) || 0;
      const provinceCellIds = provinceToCellsMap.get(provinceId) ?? [];
      const effectiveProvinceSize = computeSize(provinceCellIds, cellsWeight);
      const averageTerrainFactor = getAverageTerrainFactor(provinceCellIds, cellsWeight);
      const terrainAdjustedMinPop =
        averageTerrainFactor >= 1.45
          ? Math.floor(
              minProvincePopulation * PROVINCE_TUNING.thresholds.geography.terrainAdjustedMinFactor
            )
          : minProvincePopulation;
      const tooSmallByArea = effectiveProvinceSize < minProvinceSize;
      const tooSmallByPopulation = terrainAdjustedMinPop > 0 && population < terrainAdjustedMinPop;
      const tooSmallByMandatoryPopulation =
        enforceMandatoryPopulationFloor && population < mandatoryMinProvincePop;
      const isUnderpopulatedHardFloor = population < Math.floor(nationPopulation * MIN_POP_PERCENT);
      const isDenseUrbanProvince = population > populationBounds.target * 1.2;
      if (isDenseUrbanProvince) return false;
      const isAbovePopulationCap = population > populationBounds.max;
      if (isAbovePopulationCap) return false;
      const size = provinceSize.get(provinceId) || 0;
      const economy = provinceEconomy.get(provinceId) || 0;
      const economyPerCell = economy / Math.max(1, size);
      const isSpecialEconomyProvince =
        economyPerCell >
        nationAverageEconomyPerCell * PROVINCE_TUNING.thresholds.economySpecialFactor;
      if (isSpecialEconomyProvince) return false;
      const isLargeSparseProvince =
        effectiveProvinceSize >=
        minProvinceSize * PROVINCE_TUNING.thresholds.geography.largeSparseFactor;
      if (isLargeSparseProvince && tooSmallByPopulation) return false;
      return (
        isUnderpopulatedHardFloor ||
        (tooSmallByArea && tooSmallByPopulation) ||
        tooSmallByMandatoryPopulation
      );
    });

    for (const provinceId of smallProvinceIds) {
      const provinceCells = provinceToCellsMap.get(provinceId) ?? [];
      const dominantTerrain = getDominantLandform(provinceCells, cells);
      const currentPopulation = provincePopulation.get(provinceId) || 0;
      const underPopulatedByHardFloor =
        currentPopulation < Math.floor(nationPopulation * MIN_POP_PERCENT);
      for (const cellId of provinceCells) {
        const sameTerrainNeighborCounts = new Map<number, number>();
        const mixedTerrainNeighborCounts = new Map<number, number>();
        for (const neighborId of cells[cellId].neighbors) {
          if (owner[neighborId] !== nationId) continue;
          const candidateProvinceId = provinceOwner[neighborId];
          if (candidateProvinceId < 0 || candidateProvinceId === provinceId) continue;
          const mergedPopulation =
            (provincePopulation.get(candidateProvinceId) || 0) +
            (provincePopulation.get(provinceId) || 0);
          if (mergedPopulation > MERGE_POP_CAP) continue;
          if (cells[neighborId].landform === dominantTerrain) {
            sameTerrainNeighborCounts.set(
              candidateProvinceId,
              (sameTerrainNeighborCounts.get(candidateProvinceId) || 0) + 1
            );
          } else {
            mixedTerrainNeighborCounts.set(
              candidateProvinceId,
              (mixedTerrainNeighborCounts.get(candidateProvinceId) || 0) + 1
            );
          }
        }

        let bestProvinceId = -1;
        let bestCount = 0;
        const prioritizedCounts =
          sameTerrainNeighborCounts.size > 0 && !underPopulatedByHardFloor
            ? sameTerrainNeighborCounts
            : mixedTerrainNeighborCounts.size > 0
              ? mixedTerrainNeighborCounts
              : sameTerrainNeighborCounts;
        for (const [candidateProvinceId, count] of prioritizedCounts) {
          if (count > bestCount) {
            bestCount = count;
            bestProvinceId = candidateProvinceId;
          }
        }

        if (bestProvinceId < 0) {
          const nearestCellId = findNearestCell(cells, cells[cellId].site, nationCellIds, (id) => {
            const candidateProvinceId = provinceOwner[id];
            return candidateProvinceId >= 0 && candidateProvinceId !== provinceId;
          });
          if (nearestCellId >= 0) {
            bestProvinceId = provinceOwner[nearestCellId];
          }
        }

        if (bestProvinceId >= 0) provinceOwner[cellId] = bestProvinceId;
      }
    }

    enforceMinProvince(
      cells,
      nationCellIds,
      provinceOwner,
      requiredMinProvince,
      nationPopulation,
      nextProvinceIdRef
    );

    // FinalRebalance (soft)
    for (
      let rebalancePass = 0;
      rebalancePass < PROVINCE_TUNING.rebalance.softPasses;
      rebalancePass += 1
    ) {
      const provinceToCells = groupNationCellsByProvince(nationCellIds, provinceOwner);

      const provincePopMap = new Map<number, number>();
      for (const [pid, cellIds] of provinceToCells) {
        provincePopMap.set(
          pid,
          cellIds.reduce((s, id) => s + cells[id].population, 0)
        );
      }

      let changed = false;
      for (const [provinceId, provinceCells] of provinceToCells) {
        const population = provincePopMap.get(provinceId) ?? 0;
        if (population >= Math.floor(nationPopulation * MIN_POP_PERCENT)) continue;
        const dominantTerrain = getDominantLandform(provinceCells, cells);

        for (const cellId of provinceCells) {
          let bestProvinceId = -1;
          let bestScore = -1;
          for (const neighborId of cells[cellId].neighbors) {
            if (owner[neighborId] !== nationId) continue;
            const candidateProvinceId = provinceOwner[neighborId];
            if (candidateProvinceId < 0 || candidateProvinceId === provinceId) continue;
            const mergedPopulation = (provincePopMap.get(candidateProvinceId) ?? 0) + population;
            if (mergedPopulation > MERGE_POP_CAP) continue;
            const terrainScore = cells[neighborId].landform === dominantTerrain ? 2 : 1;
            if (terrainScore > bestScore) {
              bestScore = terrainScore;
              bestProvinceId = candidateProvinceId;
            }
          }
          if (bestProvinceId >= 0) {
            provinceOwner[cellId] = bestProvinceId;
            changed = true;
          }
        }
      }
      if (!changed) break;
    }

    // StrictFloorEnforcement
    mergeUnderfloorProvinces(
      cells,
      owner,
      provinceOwner,
      nationId,
      nationCellIds,
      nationPopulation,
      {
        maxPasses: PROVINCE_TUNING.rebalance.strictPasses,
        mergeCap: MERGE_POP_CAP,
        includeTouchBonus: true,
      }
    );
  }
}

export function limitProvincePopulation(params: TCellOwnerParams) {
  const { cells, owner, provinceOwner } = params;
  const nationIds = Array.from(new Set(owner)).filter((nationId) => nationId >= 0);

  for (const nationId of nationIds) {
    const nationCellIds = getOwnerLandCellIds(cells, owner, nationId);
    if (nationCellIds.length === 0) continue;
    const nationPopulation = nationCellIds.reduce(
      (sum, cellId) => sum + cells[cellId].population,
      0
    );

    mergeUnderfloorProvinces(
      cells,
      owner,
      provinceOwner,
      nationId,
      nationCellIds,
      nationPopulation,
      {
        maxPasses: 12,
        includeTouchBonus: false,
      }
    );
  }
}

export function enforceProvinceConnect(params: TCellOwnerParams) {
  const { cells, owner, provinceOwner } = params;
  const provinceIds = Array.from(new Set(provinceOwner)).filter((provinceId) => provinceId >= 0);

  reassignDisconnectedFragments(cells, provinceOwner, provinceIds, {
    boundaryOwner: owner,
    pickBestOwner: (cellId, neighborCounts) => {
      let bestProvinceId = provinceOwner[cellId];
      let bestCount = -1;
      for (const [candidateProvinceId, count] of neighborCounts) {
        if (count > bestCount) {
          bestCount = count;
          bestProvinceId = candidateProvinceId;
        }
      }
      return bestProvinceId;
    },
    isSharedBoundary: (current, neighborId) => {
      return owner[current] === owner[neighborId];
    },
  });
}
