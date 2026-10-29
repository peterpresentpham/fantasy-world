import { HYDROLOGY_CONFIG, RIVER_CONFIG } from 'src/configs/map/hydrology';
import { TDeterministicMinHeap } from 'src/services/utils/collections';
import { TBiome, TCell } from 'src/types/global';

export const T_COAST_OUTLET = HYDROLOGY_CONFIG.coastOutletId;

const BIOME_WATER_RETENTION: Partial<Record<TBiome, number>> = {
  wetland: 1.5,
  tropical_forest: 1.4,
  temperate_forest: 1.1,
  plain: 0.9,
  boreal_forest: 0.85,
  grassland: 0.8,
  montane_shrub: 0.6,
  savanna: 0.45,
  steppe: 0.35,
  tundra: 0.35,
  ice: 0.45,
  desert_cold: 0.15,
  desert_hot: 0.08,
};

export function sortIndicesByElevation(elevation: Float32Array) {
  const indices = Array.from({ length: elevation.length }, (_, index) => index);
  indices.sort((left, right) => {
    if (elevation[right] !== elevation[left]) return elevation[right] - elevation[left];
    return left - right;
  });
  return indices;
}

export function prepareTerrain(cells: TCell[], elevation: Float32Array, isLand: Uint8Array) {
  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    const cell = cells[cellIndex];
    const land = !cell.isWater && cell.elevation >= RIVER_CONFIG.landWaterThreshold;
    isLand[cellIndex] = land ? 1 : 0;
    elevation[cellIndex] = cell.elevation;

    if (!land) continue;
    const hasWaterNeighbor = cell.neighbors.some((neighborId) => cells[neighborId].isWater);
    if (hasWaterNeighbor) {
      elevation[cellIndex] += RIVER_CONFIG.depression.coastLift;
    }
  }
}

/**
 * Priority-flood depression filling (Barnes et al. 2014, with epsilon). Floods inward from the
 * outlets (land cells touching non-land) in order of increasing elevation, raising every pit to
 * just above the lowest rim that lets it drain. Afterwards each land cell has a strictly lower
 * neighbour on its way to an outlet, so no depression is left unresolved.
 */
export function fillDepressions(cells: TCell[], elevation: Float32Array, isLand: Uint8Array) {
  const filled = new Float32Array(elevation);
  const epsilon = RIVER_CONFIG.depression.epsilon;
  const queued = new Uint8Array(cells.length);
  const heap = new TDeterministicMinHeap<number>();

  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    if (isLand[cellIndex] === 0) continue;
    if (!cells[cellIndex].neighbors.some((neighborId) => isLand[neighborId] === 0)) continue;
    queued[cellIndex] = 1;
    heap.push(cellIndex, filled[cellIndex]);
  }

  let raisedCells = 0;
  while (heap.size > 0) {
    const current = heap.pop() as number;
    for (const neighborId of cells[current].neighbors) {
      if (isLand[neighborId] === 0 || queued[neighborId] === 1) continue;
      queued[neighborId] = 1;
      const floor = filled[current] + epsilon;
      if (filled[neighborId] < floor) {
        filled[neighborId] = floor;
        raisedCells += 1;
      }
      heap.push(neighborId, filled[neighborId]);
    }
  }

  return { filledElevation: filled, raisedCells };
}

export function accumulateFlow(
  cells: TCell[],
  filledElevation: Float32Array,
  isLand: Uint8Array,
  precipitation: Float32Array,
  seaLevel: number
) {
  const downstream = new Int32Array(cells.length);
  downstream.fill(-1);

  const cellModifier = Math.pow(cells.length / 10000, RIVER_CONFIG.cellsNumberModifierExp);
  const flow = new Float32Array(cells.length);
  const effectiveFlow = new Float32Array(cells.length);

  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    if (isLand[cellIndex] === 0) continue;
    const cell = cells[cellIndex];
    const biomeRetention = BIOME_WATER_RETENTION[cell.biome] ?? 0.8;
    const aridityDamp = Math.max(0, 1 - (cell.aridityIndex ?? 0) * 0.55);
    const precipContribution = precipitation[cellIndex] * 16 * biomeRetention * aridityDamp;
    flow[cellIndex] = (1.5 + precipContribution) * cellModifier;
  }

  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    if (isLand[cellIndex] === 0) continue;
    const cell = cells[cellIndex];
    let nextCell = -1;
    let nextElevation = filledElevation[cellIndex];
    let hasWaterNeighbor = false;

    for (const neighborId of cell.neighbors) {
      if (isLand[neighborId] === 0) {
        hasWaterNeighbor = true;
        continue;
      }
      const neighborElevation = filledElevation[neighborId];
      if (
        neighborElevation < nextElevation ||
        (neighborElevation === nextElevation && neighborId < nextCell)
      ) {
        nextElevation = neighborElevation;
        nextCell = neighborId;
      }
    }

    if (nextCell >= 0) {
      downstream[cellIndex] = nextCell;
    } else if (hasWaterNeighbor || cell.elevation <= seaLevel + 0.02) {
      downstream[cellIndex] = T_COAST_OUTLET;
    }
  }

  const sorted = sortIndicesByElevation(filledElevation);
  for (const cellIndex of sorted) {
    if (isLand[cellIndex] === 0) continue;
    const next = downstream[cellIndex];
    if (next >= 0) flow[next] += flow[cellIndex];
  }

  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    if (isLand[cellIndex] === 0) continue;
    const next = downstream[cellIndex];
    const slope =
      next >= 0
        ? Math.max(0, filledElevation[cellIndex] - filledElevation[next])
        : Math.max(0, filledElevation[cellIndex]);
    effectiveFlow[cellIndex] = flow[cellIndex] * (1 + slope * 2.5);
  }

  return { downstream, flow, effectiveFlow };
}
