import { GEOPOLITICAL_CONFIG } from 'src/configs/map/geopolitics';
import { TBorderType, TCell } from 'src/types/global';
import { getBoundaryStepCost, isLand, makeFrontierHash } from '../shared';

type TNationFrontierState = { cellId: number; nationId: number; cost: number };

const T_COUNTRY_REASSIGN_HASH = makeFrontierHash('postprocess', 'nation-reassign');

export function pickBestNationForCell(
  cells: TCell[],
  owner: Int32Array,
  cellId: number,
  candidates: Map<number, number>
) {
  let bestNationId = -1;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const [nationId, neighborCount] of candidates) {
    let minStep = Number.POSITIVE_INFINITY;

    for (const neighborId of cells[cellId].neighbors) {
      if (owner[neighborId] !== nationId) continue;
      const step = getBoundaryStepCost(
        cells,
        owner,
        neighborId,
        cellId,
        nationId,
        T_COUNTRY_REASSIGN_HASH,
        'nation'
      );
      if (step < minStep) minStep = step;
    }

    if (!Number.isFinite(minStep)) continue;

    const score = neighborCount * 1.2 - minStep * 0.8;
    if (score > bestScore) {
      bestScore = score;
      bestNationId = nationId;
    }
  }
  return bestNationId;
}

export function getNationStepCost(
  cells: TCell[],
  owner: Int32Array,
  current: TNationFrontierState,
  neighborId: number,
  seedHash: number,
  borderType: TBorderType,
  nationExpansionBias: number[]
) {
  let stepCost = getBoundaryStepCost(
    cells,
    owner,
    current.cellId,
    neighborId,
    current.nationId,
    seedHash,
    borderType
  );
  stepCost *= nationExpansionBias[current.nationId] || 1;
  stepCost += GEOPOLITICAL_CONFIG.frontierNoise * 0.15;
  return Math.max(0.2, stepCost);
}

export function runFloorExpansion(
  cells: TCell[],
  owner: Int32Array,
  cost: Float64Array,
  nationExpansionBias: number[],
  seedHash: number
) {
  const minNationCells = GEOPOLITICAL_CONFIG.minLandCells;
  if (minNationCells <= 1) return;

  const nationCount = nationExpansionBias.length;
  const nationCellCounts = new Int32Array(nationCount);
  for (let cellId = 0; cellId < cells.length; cellId += 1) {
    const nationId = owner[cellId];
    if (nationId >= 0 && isLand(cells[cellId])) nationCellCounts[nationId] += 1;
  }

  const maxIterations = Math.max(1, cells.length * 2);
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let changed = false;

    for (let nationId = 0; nationId < nationCount; nationId += 1) {
      if (nationCellCounts[nationId] >= minNationCells) continue;

      let bestCurrentCellId = -1;
      let bestNeighborId = -1;
      let bestNextCost = Number.POSITIVE_INFINITY;

      for (let cellId = 0; cellId < cells.length; cellId += 1) {
        if (owner[cellId] !== nationId) continue;
        if (!isLand(cells[cellId])) continue;

        const currentState = { cellId, nationId, cost: cost[cellId] };
        for (const neighborId of cells[cellId].neighbors) {
          if (!isLand(cells[neighborId])) continue;
          if (owner[neighborId] >= 0) continue;

          const nextCost =
            currentState.cost +
            getNationStepCost(
              cells,
              owner,
              currentState,
              neighborId,
              seedHash,
              'nation',
              nationExpansionBias
            );

          if (nextCost < bestNextCost) {
            bestNextCost = nextCost;
            bestCurrentCellId = cellId;
            bestNeighborId = neighborId;
          }
        }
      }

      if (bestCurrentCellId < 0 || bestNeighborId < 0) continue;
      owner[bestNeighborId] = nationId;
      cost[bestNeighborId] = bestNextCost;
      nationCellCounts[nationId] += 1;
      changed = true;
    }

    if (!changed) break;
  }
}

export function buildSeedStates(owner: Int32Array, cost: Float64Array) {
  const seeds: TNationFrontierState[] = [];
  for (let cellId = 0; cellId < owner.length; cellId += 1) {
    if (owner[cellId] < 0 || !Number.isFinite(cost[cellId])) continue;
    seeds.push({ cellId, nationId: owner[cellId], cost: cost[cellId] });
  }
  return seeds;
}
