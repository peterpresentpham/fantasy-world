import { GEOPOLITICAL_CONFIG } from 'src/configs/map/geopolitics';
import { TCell } from 'src/types/global';
import { createSeededRandom } from 'src/services/utils/math';
import { getNationNeighborCounts, isLand } from '../shared';
import {
  borrowCellForNation,
  buildLandCellIds,
  buildLandNationSizeMap,
  findNearestForeignNation,
  getSmallNationIds,
  tryGrowNation,
} from './transfer';
import { pickBestNationForCell } from './expansion';

export function enforceMinNationArea(
  cells: TCell[],
  owner: Int32Array,
  minNationCount = 0,
  precomputedLandCellIds?: number[]
) {
  const landCellIds = precomputedLandCellIds ?? buildLandCellIds(cells);
  const minNationCells = Math.max(
    GEOPOLITICAL_CONFIG.minLandCells,
    Math.floor(landCellIds.length * GEOPOLITICAL_CONFIG.minLandRatio)
  );

  const sizeByNation = buildLandNationSizeMap(landCellIds, owner);

  let activeNationCount = sizeByNation.size;
  const maxRebalancePasses = Math.max(1, sizeByNation.size);

  for (let rebalancePass = 0; rebalancePass < maxRebalancePasses; rebalancePass += 1) {
    let changedInPass = false;
    const smallNationIds = getSmallNationIds(sizeByNation, minNationCells);

    if (smallNationIds.length === 0) break;

    for (const nationId of smallNationIds) {
      const reachedMin = tryGrowNation(cells, owner, nationId, sizeByNation, minNationCells);
      if (reachedMin) {
        changedInPass = true;
        continue;
      }
      if (minNationCount > 0) {
        let borrowed = false;
        while ((sizeByNation.get(nationId) || 0) < minNationCells) {
          const visited = new Set<number>([nationId]);
          const grew = borrowCellForNation(
            cells,
            owner,
            sizeByNation,
            nationId,
            minNationCells,
            visited
          );
          if (!grew) break;
          borrowed = true;
        }
        if ((sizeByNation.get(nationId) || 0) >= minNationCells) {
          if (borrowed) changedInPass = true;
          continue;
        }
      }

      if (activeNationCount <= minNationCount) continue;

      const nationCells = landCellIds.filter((cellId) => owner[cellId] === nationId);
      let movedAnyCell = false;
      for (const cellId of nationCells) {
        const neighborCounts = getNationNeighborCounts(cells, owner, cellId);
        neighborCounts.delete(nationId);
        let bestNationId = pickBestNationForCell(cells, owner, cellId, neighborCounts);
        if (bestNationId < 0) {
          bestNationId = findNearestForeignNation(cells, owner, landCellIds, cellId, nationId);
        }
        if (bestNationId >= 0) {
          owner[cellId] = bestNationId;
          movedAnyCell = true;
          changedInPass = true;
        }
      }
      if (movedAnyCell) {
        activeNationCount -= 1;
      }
    }
    if (!changedInPass) break;
  }
}

export function diversifySmallNationSizes(cells: TCell[], owner: Int32Array, seed: string) {
  const minNationCells = GEOPOLITICAL_CONFIG.minLandCells;
  const sizeByNation = new Map<number, number>();
  for (const cell of cells) {
    if (!isLand(cell)) continue;
    const nationId = owner[cell.id];
    if (nationId < 0) continue;
    sizeByNation.set(nationId, (sizeByNation.get(nationId) || 0) + 1);
  }

  let donorPool = 0;
  let totalLandCells = 0;
  for (const size of sizeByNation.values()) {
    totalLandCells += size;
    donorPool += Math.max(0, size - minNationCells);
  }
  if (donorPool <= 0) return;

  const random = createSeededRandom(`${seed}:nation-size-diversify:v3`);
  const nationCount = Math.max(1, sizeByNation.size);
  const averageSize = totalLandCells / nationCount;
  const hardCapTargetSize = Math.max(minNationCells + 12, Math.floor(averageSize * 1.85));
  const allNationIds = Array.from(sizeByNation.keys());
  const shuffledNationIds = allNationIds.sort(() => random() - 0.5);
  const smallNationIds = allNationIds
    .filter((nationId) => (sizeByNation.get(nationId) || 0) <= minNationCells + 3)
    .sort((leftId, rightId) => (sizeByNation.get(leftId) || 0) - (sizeByNation.get(rightId) || 0));

  // Phase 0: specifically reduce "stuck at exactly 10 cells" nations first.
  const exactFloorNationIds = shuffledNationIds.filter(
    (nationId) => (sizeByNation.get(nationId) || 0) === minNationCells
  );
  for (const nationId of exactFloorNationIds) {
    if (donorPool <= 0) break;
    const targetSize = Math.min(hardCapTargetSize, minNationCells + 2 + Math.floor(random() * 5));
    while ((sizeByNation.get(nationId) || 0) < targetSize && donorPool > 0) {
      const visited = new Set<number>([nationId]);
      const grew = borrowCellForNation(
        cells,
        owner,
        sizeByNation,
        nationId,
        minNationCells,
        visited
      );
      if (!grew) break;
      donorPool -= 1;
    }
  }

  // Phase 1: lift many tiny nations out of the 10-13 bucket.
  for (const nationId of smallNationIds) {
    if (donorPool <= 0) break;
    if (random() < 0.1) continue;
    const targetSize = Math.min(hardCapTargetSize, 13 + Math.floor(random() * 12));

    while ((sizeByNation.get(nationId) || 0) < targetSize && donorPool > 0) {
      const visited = new Set<number>([nationId]);
      const grew = borrowCellForNation(
        cells,
        owner,
        sizeByNation,
        nationId,
        minNationCells,
        visited
      );
      if (!grew) break;
      donorPool -= 1;
    }
  }

  // Phase 2: randomly pick some nations to become medium-sized (20+), without extreme outliers.
  for (const nationId of shuffledNationIds) {
    if (donorPool <= 0) break;
    if (random() < 0.7) continue;
    const currentSize = sizeByNation.get(nationId) || minNationCells;
    if (currentSize >= hardCapTargetSize) continue;

    const mediumTarget = 20 + Math.floor(random() * 30);
    const targetSize = Math.min(hardCapTargetSize, mediumTarget);
    if (targetSize <= currentSize) continue;

    while ((sizeByNation.get(nationId) || 0) < targetSize && donorPool > 0) {
      const visited = new Set<number>([nationId]);
      const grew = borrowCellForNation(
        cells,
        owner,
        sizeByNation,
        nationId,
        minNationCells,
        visited
      );
      if (!grew) break;
      donorPool -= 1;
    }
  }
}
