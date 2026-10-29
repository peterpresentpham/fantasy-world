import { TCell } from 'src/types/global';
import { hashSeed } from 'src/services/utils/math';
import { isLand } from './boundary';

export const CAPITAL_VIEWPORT_MARGIN = 14;

export function getNationCount(nationCount: number, landCellCount: number) {
  if (landCellCount <= 0) return 0;
  const maxNationsByMinLandRule = Math.floor(landCellCount / 10) - 2;
  const maxNations = Math.max(1, Math.min(40, maxNationsByMinLandRule));
  const requested = Math.max(2, Math.floor(nationCount));
  return Math.min(requested, maxNations);
}

export function makeFrontierHash(seed: string, suffix: string) {
  return hashSeed(`${seed}:${suffix}`);
}

/**
 * Collect land cell IDs belonging to a specific owner (nation, province, or ethnic group).
 * Uses for-loop for performance (avoids creating intermediate arrays from filter+map).
 */
export function getOwnerLandCellIds(cells: TCell[], owner: Int32Array, ownerId: number): number[] {
  const ids: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (isLand(cells[i]) && owner[i] === ownerId) ids.push(i);
  }
  return ids;
}

/**
 * Build a map of owner ID → list of its cell IDs from a set of candidate cells.
 */
export function groupOwnerCells(ownerCellIds: number[], owner: Int32Array): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const cellId of ownerCellIds) {
    const ownerId = owner[cellId];
    if (ownerId < 0) continue;
    if (!map.has(ownerId)) map.set(ownerId, []);
    (map.get(ownerId) as number[]).push(cellId);
  }
  return map;
}

/**
 * Find all disconnected fragments of an entity (province/nation) and reassign
 * the smaller fragments to the best neighboring entity.
 *
 * Uses stack-based DFS to find connected components within a single entity's territory.
 * Sorts components by size (descending), keeps the largest, reassigns the rest.
 */
export function reassignDisconnectedFragments(
  cells: TCell[],
  entityOwner: Int32Array,
  entityIds: number[],
  options: {
    boundaryOwner?: Int32Array;
    pickBestOwner: (cellId: number, neighborCounts: Map<number, number>) => number;
    isSharedBoundary?: (cellId: number, neighborId: number) => boolean;
  }
) {
  const { boundaryOwner, pickBestOwner, isSharedBoundary } = options;
  const stack: number[] = [];

  for (const entityId of entityIds) {
    const entityCells = getOwnerLandCellIds(cells, entityOwner, entityId);
    if (entityCells.length <= 1) continue;

    const visited = new Set<number>();
    const components: number[][] = [];

    for (const startCellId of entityCells) {
      if (visited.has(startCellId)) continue;
      stack.length = 0;
      stack.push(startCellId);
      const component: number[] = [];
      visited.add(startCellId);

      while (stack.length > 0) {
        const current = stack.pop() as number;
        component.push(current);

        for (const neighborId of cells[current].neighbors) {
          if (entityOwner[neighborId] !== entityId) continue;
          if (!isLand(cells[neighborId])) continue;
          if (isSharedBoundary && !isSharedBoundary(current, neighborId)) continue;
          if (visited.has(neighborId)) continue;
          visited.add(neighborId);
          stack.push(neighborId);
        }
      }
      components.push(component);
    }

    if (components.length <= 1) continue;
    components.sort((a, b) => b.length - a.length);

    for (let index = 1; index < components.length; index += 1) {
      for (const cellId of components[index]) {
        const neighborCounts = new Map<number, number>();
        for (const neighborId of cells[cellId].neighbors) {
          if (!isLand(cells[neighborId])) continue;
          const candidateOwnerId = entityOwner[neighborId];
          if (candidateOwnerId < 0 || candidateOwnerId === entityId) continue;
          if (boundaryOwner && boundaryOwner[neighborId] !== boundaryOwner[cellId]) continue;
          if (isSharedBoundary && !isSharedBoundary(cellId, neighborId)) continue;
          neighborCounts.set(candidateOwnerId, (neighborCounts.get(candidateOwnerId) || 0) + 1);
        }
        const bestOwnerId = pickBestOwner(cellId, neighborCounts);
        if (bestOwnerId >= 0) entityOwner[cellId] = bestOwnerId;
      }
    }
  }
}

export {
  assignMaritimeZones,
  edgeNoise,
  getBoundaryStepCost,
  getNationNeighborCounts,
  isLand,
  limitMountainSplit,
} from './boundary';
export { createRegionalName } from './names';
