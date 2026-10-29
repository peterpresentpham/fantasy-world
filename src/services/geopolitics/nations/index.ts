import { GEOPOLITICAL_CONFIG } from 'src/configs/map/geopolitics';
import { TCell } from 'src/types/global';
import { findNearestCell } from 'src/services/utils/geometry';
import { runMultiSourceExpansion } from 'src/services/utils/graph';
import { createSeededRandom } from 'src/services/utils/math';
import {
  getNationCount,
  getNationNeighborCounts,
  isLand,
  makeFrontierHash,
  reassignDisconnectedFragments,
} from '../shared';
import { buildConnectivityContext, selectNationSeeds } from './seeds';
import {
  buildSeedStates,
  getNationStepCost,
  pickBestNationForCell,
  runFloorExpansion,
} from './expansion';
import { buildLandCellIds, buildLandNationSizeMap, getSmallNationIds } from './transfer';
import { enforceMinNationArea } from './balance';

export { diversifySmallNationSizes, enforceMinNationArea } from './balance';

export function buildLandNations(cells: TCell[], seed: string, nationCount: number) {
  const landCellCount = buildLandCellIds(cells).length;
  const numOfNation = getNationCount(nationCount, landCellCount);
  const connectivity = buildConnectivityContext(cells);
  const minSeedComponentSize = GEOPOLITICAL_CONFIG.minLandCells + 6;
  const seeds = selectNationSeeds(cells, numOfNation, seed, connectivity, minSeedComponentSize);
  const owner = new Int32Array(cells.length);
  const cost = new Float64Array(cells.length);
  owner.fill(-1);
  cost.fill(Number.POSITIVE_INFINITY);
  const nationExpansionBias = Array.from({ length: seeds.length }, (_, nationId) => {
    const random = createSeededRandom(`${seed}:${nationId}:nation-expansion-bias`);
    const roll = random();
    if (roll < 0.2) return 0.7 + random() * 0.18;
    if (roll < 0.75) return 0.9 + random() * 0.22;
    return 1.12 + random() * 0.26;
  });

  const seedStates: Array<{ cellId: number; nationId: number; cost: number }> = [];
  for (let nationId = 0; nationId < seeds.length; nationId += 1) {
    const cellId = seeds[nationId];
    owner[cellId] = nationId;
    cost[cellId] = 0;
    seedStates.push({ cellId, nationId, cost: 0 });
  }

  const seedHash = makeFrontierHash(seed, 'geopolitics:frontier');
  // Stage A: grow nations toward min floor size before regular global expansion.
  runFloorExpansion(cells, owner, cost, nationExpansionBias, seedHash);
  const initialStates = buildSeedStates(owner, cost);

  // Stage B: regular cost-based multi-source expansion with the current frontier model.
  runMultiSourceExpansion({
    seeds: initialStates.length > 0 ? initialStates : seedStates,
    getPriority: (state) => state.cost,
    isStale: (state) => state.cost > cost[state.cellId],
    expand: (current, push) => {
      const currentCell = cells[current.cellId];
      for (const neighborId of currentCell.neighbors) {
        const neighbor = cells[neighborId];
        if (!isLand(neighbor)) continue;
        const nextCost =
          current.cost +
          getNationStepCost(
            cells,
            owner,
            current,
            neighborId,
            seedHash,
            'nation',
            nationExpansionBias
          );

        if (nextCost < cost[neighborId]) {
          cost[neighborId] = nextCost;
          owner[neighborId] = current.nationId;
          push({ cellId: neighborId, nationId: current.nationId, cost: nextCost });
        }
      }
    },
  });
  return owner;
}

export function alignNaturalTerrainClusters(cells: TCell[], owner: Int32Array) {
  const targetLandforms = new Set(['mountain', 'hills', 'plateau', 'valley']);
  const passes = 2;

  for (let pass = 0; pass < passes; pass += 1) {
    const nextOwner = Int32Array.from(owner);

    for (let cellId = 0; cellId < cells.length; cellId += 1) {
      const cell = cells[cellId];
      if (!isLand(cell)) continue;
      if (!targetLandforms.has(cell.landform)) continue;
      if (owner[cellId] < 0) continue;

      const nationCounts = new Map<number, number>();
      let sameTerrainNeighbors = 0;
      for (const neighborId of cell.neighbors) {
        const neighbor = cells[neighborId];
        if (!isLand(neighbor)) continue;
        if (neighbor.landform !== cell.landform) continue;
        sameTerrainNeighbors += 1;
        const nationId = owner[neighborId];
        if (nationId < 0) continue;
        nationCounts.set(nationId, (nationCounts.get(nationId) || 0) + 1);
      }

      if (sameTerrainNeighbors < 3) continue;
      const bestNationId = pickBestNationForCell(cells, owner, cellId, nationCounts);
      const bestCount = bestNationId >= 0 ? nationCounts.get(bestNationId) || 0 : 0;
      if (bestNationId >= 0 && bestNationId !== owner[cellId] && bestCount >= 3) {
        nextOwner[cellId] = bestNationId;
      }
    }
    owner.set(nextOwner);
  }
}

export function enforceMainlandContiguity(cells: TCell[], owner: Int32Array) {
  const nationIds = Array.from(new Set(owner)).filter((nationId) => nationId >= 0);

  reassignDisconnectedFragments(cells, owner, nationIds, {
    pickBestOwner: (cellId, neighborCounts) => {
      return pickBestNationForCell(cells, owner, cellId, neighborCounts);
    },
  });
}

function fillUnclaimedLand(cells: TCell[], owner: Int32Array) {
  let changed = true;
  while (changed) {
    changed = false;
    for (let cellId = 0; cellId < cells.length; cellId += 1) {
      if (!isLand(cells[cellId]) || owner[cellId] >= 0) continue;
      const neighborCounts = getNationNeighborCounts(cells, owner, cellId);
      const bestNationId = pickBestNationForCell(cells, owner, cellId, neighborCounts);
      if (bestNationId >= 0) {
        owner[cellId] = bestNationId;
        changed = true;
      }
    }
  }
}

function ensureAllLandClaimed(cells: TCell[], owner: Int32Array) {
  const claimedLandIds = cells
    .filter((cell) => isLand(cell) && owner[cell.id] >= 0)
    .map((cell) => cell.id);
  if (claimedLandIds.length === 0) return;

  for (let cellId = 0; cellId < cells.length; cellId += 1) {
    if (!isLand(cells[cellId])) continue;
    if (owner[cellId] >= 0) continue;
    const nearestCellId = findNearestCell(cells, cells[cellId].site, claimedLandIds);
    if (nearestCellId >= 0) owner[cellId] = owner[nearestCellId];
  }
}

function getUnclaimedLandCount(cells: TCell[], owner: Int32Array) {
  let count = 0;
  for (let cellId = 0; cellId < cells.length; cellId += 1) {
    if (!isLand(cells[cellId])) continue;
    if (owner[cellId] >= 0) continue;
    count += 1;
  }
  return count;
}

function getSmallNationCount(landCellIds: number[], owner: Int32Array) {
  const minNationCells = Math.max(
    GEOPOLITICAL_CONFIG.minLandCells,
    Math.floor(landCellIds.length * GEOPOLITICAL_CONFIG.minLandRatio)
  );
  const sizeByNation = buildLandNationSizeMap(landCellIds, owner);
  return getSmallNationIds(sizeByNation, minNationCells).length;
}

export function finalizeNationBorders(
  cells: TCell[],
  owner: Int32Array,
  nationCount: number,
  maxPasses = 3
) {
  const shouldLogMetrics = process.env.NODE_ENV !== 'production';
  const landCellIds = buildLandCellIds(cells);

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const beforeUnclaimed = getUnclaimedLandCount(cells, owner);
    const beforeSmallNationCount = getSmallNationCount(landCellIds, owner);

    fillUnclaimedLand(cells, owner);
    ensureAllLandClaimed(cells, owner);
    enforceMinNationArea(cells, owner, nationCount, landCellIds);
    ensureAllLandClaimed(cells, owner);

    const afterUnclaimed = getUnclaimedLandCount(cells, owner);
    const afterSmallNationCount = getSmallNationCount(landCellIds, owner);
    if (shouldLogMetrics) {
      console.debug('[nation:reconcile]', {
        pass,
        beforeUnclaimed,
        afterUnclaimed,
        beforeSmallNationCount,
        afterSmallNationCount,
      });
    }
    const stabilized =
      afterUnclaimed === beforeUnclaimed && afterSmallNationCount === beforeSmallNationCount;
    if (stabilized) break;
  }
}
