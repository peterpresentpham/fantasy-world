import { TCell } from 'src/types/global';
import { findNearestCell } from 'src/services/utils/geometry';
import { isLand } from '../shared';

export function tryGrowNation(
  cells: TCell[],
  owner: Int32Array,
  nationId: number,
  sizeByNation: Map<number, number>,
  minNationCells: number
) {
  let currentSize = sizeByNation.get(nationId) || 0;
  if (currentSize >= minNationCells) return true;

  const nationCellIds = new Set<number>();
  for (let cellId = 0; cellId < cells.length; cellId += 1) {
    if (owner[cellId] === nationId && isLand(cells[cellId])) nationCellIds.add(cellId);
  }
  if (nationCellIds.size === 0) return false;

  while (currentSize < minNationCells) {
    let bestCandidateCellId = -1;
    let bestDonorNationId = -1;
    let bestScore = -Infinity;

    for (const nationCellId of nationCellIds) {
      for (const neighborId of cells[nationCellId].neighbors) {
        if (!isLand(cells[neighborId])) continue;
        if (owner[neighborId] === nationId) continue;
        const donorNationId = owner[neighborId];
        if (donorNationId < 0) continue;
        const donorSize = sizeByNation.get(donorNationId) || 0;
        if (donorSize <= minNationCells) continue;

        let sharedBorder = 0;
        for (const nearId of cells[neighborId].neighbors) {
          if (owner[nearId] === nationId) sharedBorder += 1;
        }
        const score = sharedBorder * 10 - cells[neighborId].elevation * 0.1;
        if (score > bestScore) {
          bestScore = score;
          bestCandidateCellId = neighborId;
          bestDonorNationId = donorNationId;
        }
      }
    }

    if (bestCandidateCellId < 0 || bestDonorNationId < 0) break;
    owner[bestCandidateCellId] = nationId;
    nationCellIds.add(bestCandidateCellId);
    currentSize += 1;
    sizeByNation.set(nationId, currentSize);
    sizeByNation.set(
      bestDonorNationId,
      Math.max(0, (sizeByNation.get(bestDonorNationId) || 0) - 1)
    );
  }

  return currentSize >= minNationCells;
}

export function buildLandNationSizeMap(landCellIds: number[], owner: Int32Array) {
  const sizeByNation = new Map<number, number>();
  for (const cellId of landCellIds) {
    if (owner[cellId] < 0) continue;
    sizeByNation.set(owner[cellId], (sizeByNation.get(owner[cellId]) || 0) + 1);
  }
  return sizeByNation;
}

export function getSmallNationIds(sizeByNation: Map<number, number>, minNationCells: number) {
  return Array.from(sizeByNation.entries())
    .filter(([, size]) => size < minNationCells)
    .sort((a, b) => a[1] - b[1])
    .map(([nationId]) => nationId);
}

export function findNearestForeignNation(
  cells: TCell[],
  owner: Int32Array,
  landCellIds: number[],
  sourceCellId: number,
  sourceNationId: number
) {
  const nearestCellId = findNearestCell(cells, cells[sourceCellId].site, landCellIds, (cellId) => {
    const candidateNationId = owner[cellId];
    return candidateNationId >= 0 && candidateNationId !== sourceNationId;
  });
  return nearestCellId >= 0 ? owner[nearestCellId] : -1;
}

function getNeighborNationIds(cells: TCell[], owner: Int32Array, nationId: number) {
  const neighbors = new Set<number>();
  for (let cellId = 0; cellId < cells.length; cellId += 1) {
    if (!isLand(cells[cellId])) continue;
    if (owner[cellId] !== nationId) continue;
    for (const neighborId of cells[cellId].neighbors) {
      if (!isLand(cells[neighborId])) continue;
      const neighborNationId = owner[neighborId];
      if (neighborNationId >= 0 && neighborNationId !== nationId) neighbors.add(neighborNationId);
    }
  }
  return Array.from(neighbors);
}

function transferBorderCell(
  cells: TCell[],
  owner: Int32Array,
  sizeByNation: Map<number, number>,
  fromNationId: number,
  toNationId: number
) {
  let bestCellId = -1;
  let bestScore = -1;

  for (let cellId = 0; cellId < cells.length; cellId += 1) {
    if (!isLand(cells[cellId])) continue;
    if (owner[cellId] !== fromNationId) continue;

    let touchesTarget = false;
    let targetNeighborCount = 0;
    for (const neighborId of cells[cellId].neighbors) {
      if (!isLand(cells[neighborId])) continue;
      if (owner[neighborId] === toNationId) {
        touchesTarget = true;
        targetNeighborCount += 1;
      }
    }
    if (!touchesTarget) continue;

    if (targetNeighborCount > bestScore) {
      bestScore = targetNeighborCount;
      bestCellId = cellId;
    }
  }

  if (bestCellId < 0) return false;
  owner[bestCellId] = toNationId;
  sizeByNation.set(fromNationId, Math.max(0, (sizeByNation.get(fromNationId) || 0) - 1));
  sizeByNation.set(toNationId, (sizeByNation.get(toNationId) || 0) + 1);
  return true;
}

export function borrowCellForNation(
  cells: TCell[],
  owner: Int32Array,
  sizeByNation: Map<number, number>,
  targetNationId: number,
  minNationCells: number,
  visited: Set<number>,
  donorFloor = minNationCells
): boolean {
  const neighborNationIds = getNeighborNationIds(cells, owner, targetNationId).sort(
    (left, right) => {
      return (sizeByNation.get(right) || 0) - (sizeByNation.get(left) || 0);
    }
  );

  for (const neighborNationId of neighborNationIds) {
    const neighborSize = sizeByNation.get(neighborNationId) || 0;
    if (neighborSize > donorFloor) {
      if (transferBorderCell(cells, owner, sizeByNation, neighborNationId, targetNationId))
        return true;
      continue;
    }
    if (visited.has(neighborNationId)) continue;
    visited.add(neighborNationId);
    const grown = borrowCellForNation(
      cells,
      owner,
      sizeByNation,
      neighborNationId,
      minNationCells,
      visited,
      donorFloor
    );
    if (grown && (sizeByNation.get(neighborNationId) || 0) > donorFloor) {
      if (transferBorderCell(cells, owner, sizeByNation, neighborNationId, targetNationId))
        return true;
    }
  }
  return false;
}

export function buildLandCellIds(cells: TCell[]): number[] {
  const ids: number[] = [];
  for (const cell of cells) {
    if (isLand(cell)) ids.push(cell.id);
  }
  return ids;
}
