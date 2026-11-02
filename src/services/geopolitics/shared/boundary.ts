import { BORDER_CONFIG, MARITIME_CONFIG } from 'src/configs/map/geopolitics';
import { TBorderType, TCell, TLandform, TZoneType } from 'src/types/global';
import { collectConnectedComponents } from 'src/services/utils/graph';
import Cost from '../cost';

export function edgeNoise(seedHash: number, leftId: number, rightId: number) {
  const low = Math.min(leftId, rightId);
  const high = Math.max(leftId, rightId);
  const mix = (low * 73856093) ^ (high * 19349663) ^ seedHash;
  const s = Math.sin(mix * 0.000173) * 43758.5453;
  return Math.abs(s - Math.floor(s));
}

function isRidgeBarrier(left: TCell, right: TCell) {
  const ruggedLeft =
    left.landform === 'mountain' || left.landform === 'hills' || left.landform === 'volcanic_field';
  const ruggedRight =
    right.landform === 'mountain' ||
    right.landform === 'hills' ||
    right.landform === 'volcanic_field';
  return ruggedLeft && ruggedRight;
}

function isRuggedTerrain(cell: TCell) {
  return (
    cell.landform === 'mountain' || cell.landform === 'hills' || cell.landform === 'volcanic_field'
  );
}

function getNaturalBarrierPenalty(left: TCell, right: TCell, borderType: TBorderType) {
  const profile = BORDER_CONFIG[borderType];
  let penalty = 0;
  if (left.isRiver || right.isRiver) {
    penalty += profile.penalty.riverCross + Math.log2(Math.max(left.flow, right.flow) + 1) * 0.7;
  }
  if (left.isLake || right.isLake || left.isWater || right.isWater) {
    penalty += profile.penalty.lakeCross;
  }
  if (isRidgeBarrier(left, right)) {
    penalty += profile.penalty.ridgeCross + Math.abs(left.elevation - right.elevation) * 6;
  } else {
    const leftRugged = isRuggedTerrain(left);
    const rightRugged = isRuggedTerrain(right);
    if (leftRugged !== rightRugged) {
      penalty += profile.penalty.ridgeCross * 0.35;
    }
  }
  return penalty;
}

function isCoastalLand(cell: TCell, cells: TCell[]) {
  if (cell.isWater) return false;
  if (cell.landform === 'coast') return true;
  for (const neighborId of cell.neighbors) {
    const neighbor = cells[neighborId];
    if (neighbor.isWater || neighbor.isLake || neighbor.landform === 'coast') return true;
  }
  return false;
}

function countOwnedNeighbors(cells: TCell[], owner: Int32Array, cellId: number, ownerId: number) {
  let count = 0;
  for (const neighborId of cells[cellId].neighbors) {
    if (owner[neighborId] === ownerId) count += 1;
  }
  return count;
}

export function getBoundaryStepCost(
  cells: TCell[],
  owner: Int32Array,
  currentId: number,
  neighborId: number,
  ownerId: number,
  seedHash: number,
  borderType: TBorderType
) {
  const profile = BORDER_CONFIG[borderType];
  const currentCell = cells[currentId];
  const neighbor = cells[neighborId];
  let step = Cost.border(neighbor, borderType);
  step += getNaturalBarrierPenalty(currentCell, neighbor, borderType);
  if (isCoastalLand(neighbor, cells)) step += profile.penalty.shorelineEdgeBias;
  const sameOwnerNeighbors = countOwnedNeighbors(cells, owner, neighborId, ownerId);
  step += (2 - Math.min(2, sameOwnerNeighbors)) * profile.smoothness.jaggedPenalty;
  // Peoples exist before nations, so a border prefers to follow where one people ends.
  if (
    currentCell.ethnicId !== null &&
    neighbor.ethnicId !== null &&
    currentCell.ethnicId !== neighbor.ethnicId
  ) {
    step += profile.penalty.ethnicCross;
  }
  const noise = (edgeNoise(seedHash, currentId, neighborId) - 0.5) * 2;
  step += noise * profile.smoothness.edgeNoiseWeight;
  return Math.max(0.25, step);
}

function collectTerrainClusters(cells: TCell[], landform: TLandform) {
  return collectConnectedComponents(
    cells,
    (cell) => cell.landform === landform && !cell.isWater,
    (_current, neighbor) => neighbor.landform === landform && !neighbor.isWater
  );
}

export function limitMountainSplit(
  cells: TCell[],
  owner: Int32Array,
  borderType: TBorderType,
  nationOwner?: Int32Array
) {
  const profile = BORDER_CONFIG[borderType];
  const clusters = collectTerrainClusters(cells, 'mountain');
  for (const cluster of clusters) {
    if (cluster.length < profile.fragmentation.largeMountainClusterMinCells) continue;
    const byOwner = new Map<number, number[]>();
    for (const cellId of cluster) {
      const ownerId = owner[cellId];
      if (ownerId < 0) continue;
      if (!byOwner.has(ownerId)) byOwner.set(ownerId, []);
      (byOwner.get(ownerId) as number[]).push(cellId);
    }
    const ownerEntries = Array.from(byOwner.entries()).sort((a, b) => b[1].length - a[1].length);
    const allowed = new Set(
      ownerEntries.slice(0, profile.fragmentation.maxMountainOwnersPerCluster).map(([id]) => id)
    );
    for (const [ownerId, cellsToMove] of ownerEntries) {
      if (allowed.has(ownerId)) continue;
      for (const cellId of cellsToMove) {
        const counts = new Map<number, number>();
        for (const neighborId of cells[cellId].neighbors) {
          const candidateId = owner[neighborId];
          if (candidateId < 0 || !allowed.has(candidateId)) continue;
          if (nationOwner && nationOwner[neighborId] !== nationOwner[cellId]) continue;
          counts.set(candidateId, (counts.get(candidateId) || 0) + 1);
        }
        let bestOwnerId = ownerId;
        let bestCount = -1;
        for (const [candidateId, count] of counts) {
          if (count > bestCount) {
            bestCount = count;
            bestOwnerId = candidateId;
          }
        }
        if (bestOwnerId !== ownerId && bestCount >= profile.fragmentation.clusterSplitPenalty) {
          owner[cellId] = bestOwnerId;
        }
      }
    }
  }
}

export function isLand(cell: TCell) {
  return !cell.isWater;
}

export function getNationNeighborCounts(cells: TCell[], owner: Int32Array, cellId: number) {
  const counts = new Map<number, number>();
  for (const neighborId of cells[cellId].neighbors) {
    if (!isLand(cells[neighborId])) continue;
    const neighborNationId = owner[neighborId];
    if (neighborNationId < 0) continue;
    counts.set(neighborNationId, (counts.get(neighborNationId) || 0) + 1);
  }
  return counts;
}

/**
 * Sea ownership. A lake inside a nation is its internal waters. Sea within `territorialWidth` of a
 * coast belongs to the nearest coast's nation (territorial waters); the rest is international.
 * Distance is counted in cells and scaled by the mean cell spacing, so it does not depend on the
 * cell count.
 */
export function assignMaritimeZones(
  cells: TCell[],
  nationOwner: Int32Array,
  width: number,
  height: number
) {
  const zoneType: TZoneType[] = Array.from({ length: cells.length }, () => 'international-waters');
  const waterOwner = new Int32Array(cells.length);
  waterOwner.fill(-1);
  const hops = new Int32Array(cells.length).fill(-1);
  const queue: number[] = [];

  for (let cellId = 0; cellId < cells.length; cellId += 1) {
    if (!isLand(cells[cellId])) continue;
    zoneType[cellId] = 'land';
    if (nationOwner[cellId] < 0) continue;
    hops[cellId] = 0;
    waterOwner[cellId] = nationOwner[cellId];
    queue.push(cellId);
  }

  const spacing = Math.sqrt((width * height) / Math.max(1, cells.length));
  const maxHops = Math.max(
    1,
    Math.round((Math.hypot(width, height) * MARITIME_CONFIG.territorialWidth) / spacing)
  );

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head] as number;
    // Lakes belong to the land around them however wide they are.
    if (hops[current] >= maxHops && !cells[current].isLake) continue;
    for (const neighborId of cells[current].neighbors) {
      if (hops[neighborId] >= 0 || isLand(cells[neighborId])) continue;
      hops[neighborId] = hops[current] + 1;
      waterOwner[neighborId] = waterOwner[current];
      zoneType[neighborId] = cells[neighborId].isLake ? 'internal-waters' : 'territorial-waters';
      queue.push(neighborId);
    }
  }
  return { waterOwner, zoneType };
}
