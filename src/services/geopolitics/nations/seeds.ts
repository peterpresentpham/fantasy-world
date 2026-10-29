import { TCell } from 'src/types/global';
import { sortDescStable } from 'src/services/utils';
import { clamp } from 'src/services/utils/math';
import { getNationSeedSuitability } from '../cost';
import { isLand, makeFrontierHash } from '../shared';

const LARGE_LAND_COMPONENT_MIN_CELLS = 200;

type TConnectivityContext = {
  cellId: Int32Array;
  componentSizes: number[];
  largeComponentIds: Set<number>;
  boundaryCells: number[][];
};

export function buildConnectivityContext(cells: TCell[]): TConnectivityContext {
  const cellId = new Int32Array(cells.length);
  cellId.fill(-1);
  const componentSizes: number[] = [];
  const boundaryCells: number[][] = [];
  const visited = new Uint8Array(cells.length);
  const stack: number[] = [];

  let componentId = 0;
  for (const cell of cells) {
    if (!isLand(cell) || visited[cell.id] === 1) continue;

    stack.length = 0;
    stack.push(cell.id);
    const component: number[] = [];
    const boundaries: number[] = [];
    visited[cell.id] = 1;
    cellId[cell.id] = componentId;

    while (stack.length > 0) {
      const currentId = stack.pop() as number;
      component.push(currentId);

      let touchesWater = false;
      for (const neighborId of cells[currentId].neighbors) {
        if (!isLand(cells[neighborId])) {
          touchesWater = true;
          continue;
        }
        if (visited[neighborId] === 1) continue;
        visited[neighborId] = 1;
        cellId[neighborId] = componentId;
        stack.push(neighborId);
      }
      if (touchesWater) boundaries.push(currentId);
    }

    componentSizes.push(component.length);
    boundaryCells.push(boundaries.length > 0 ? boundaries : [component[0] as number]);
    componentId += 1;
  }

  const largeComponentIds = new Set<number>();
  for (let id = 0; id < componentSizes.length; id += 1) {
    if (componentSizes[id] >= LARGE_LAND_COMPONENT_MIN_CELLS) largeComponentIds.add(id);
  }

  return { cellId, componentSizes, largeComponentIds, boundaryCells };
}

function estimateWaterCells(
  cells: TCell[],
  context: TConnectivityContext,
  leftComponentId: number,
  rightComponentId: number
) {
  if (leftComponentId === rightComponentId) return 0;
  const leftBoundaries = context.boundaryCells[leftComponentId] || [];
  const rightBoundaries = context.boundaryCells[rightComponentId] || [];
  if (leftBoundaries.length === 0 || rightBoundaries.length === 0) return 0;

  const sampleLeft = leftBoundaries.slice(0, Math.min(24, leftBoundaries.length));
  const sampleRight = rightBoundaries.slice(0, Math.min(24, rightBoundaries.length));

  let minDistance = Number.POSITIVE_INFINITY;
  for (const leftId of sampleLeft) {
    for (const rightId of sampleRight) {
      const dx = cells[leftId].site[0] - cells[rightId].site[0];
      const dy = cells[leftId].site[1] - cells[rightId].site[1];
      const distance = Math.hypot(dx, dy);
      if (distance < minDistance) minDistance = distance;
    }
  }
  if (!Number.isFinite(minDistance)) return 0;

  const left = cells[sampleLeft[0] as number];
  const avgNeighborDistance =
    left.neighbors.length > 0
      ? left.neighbors.reduce((sum, neighborId) => {
          const neighbor = cells[neighborId];
          return sum + Math.hypot(left.site[0] - neighbor.site[0], left.site[1] - neighbor.site[1]);
        }, 0) / left.neighbors.length
      : 1;

  return Math.max(0, Math.round(minDistance / Math.max(1, avgNeighborDistance)));
}

export function selectNationSeeds(
  cells: TCell[],
  nationCount: number,
  seed: string,
  connectivity: TConnectivityContext,
  minComponentSize = 1
) {
  const allLandCandidates = sortDescStable(
    cells
      .map((_, cellId) => ({
        cellId,
        score: getNationSeedSuitability(cellId, cells),
        componentId: connectivity.cellId[cellId],
      }))
      .filter((entry) => isLand(cells[entry.cellId]))
  );
  const candidates =
    minComponentSize > 1
      ? allLandCandidates.filter(
          (entry) => (connectivity.componentSizes[entry.componentId] || 0) >= minComponentSize
        )
      : allLandCandidates;
  const sourceCandidates =
    candidates.length >= nationCount || minComponentSize <= 1 ? candidates : allLandCandidates;

  if (sourceCandidates.length === 0) return [];
  const seeds: number[] = [sourceCandidates[0].cellId];
  const seededLargeComponentIds = new Set<number>();
  const firstComponentId = connectivity.cellId[sourceCandidates[0].cellId];
  if (connectivity.largeComponentIds.has(firstComponentId)) {
    seededLargeComponentIds.add(firstComponentId);
  }
  const seedHash = makeFrontierHash(seed, 'nation-seed-soft-geo');

  while (seeds.length < nationCount) {
    let bestCellId = -1;
    let bestScore = -Infinity;
    let bestComponentId = -1;

    // `alreadySeededInComponent` and the nearest-seeded-component/water-gap
    // pair only depend on a candidate's componentId, not its cellId — cache
    // them per component (there are far fewer land components than land
    // cells) instead of recomputing per candidate every outer iteration.
    const seedSet = new Set(seeds);
    const alreadySeededByComponent = new Map<number, boolean>();
    const nearestSeededGapByComponent = new Map<
      number,
      { nearestSeededComponentId: number; nearestWaterGap: number }
    >();

    const getAlreadySeededInComponent = (componentId: number) => {
      let value = alreadySeededByComponent.get(componentId);
      if (value === undefined) {
        value = seeds.some((seedCellId) => connectivity.cellId[seedCellId] === componentId);
        alreadySeededByComponent.set(componentId, value);
      }
      return value;
    };

    const getNearestSeededGap = (componentId: number) => {
      let value = nearestSeededGapByComponent.get(componentId);
      if (value === undefined) {
        let nearestSeededComponentId = -1;
        let nearestWaterGap = Number.POSITIVE_INFINITY;
        for (const seedCellId of seeds) {
          const seededComponentId = connectivity.cellId[seedCellId];
          if (seededComponentId < 0 || seededComponentId === componentId) continue;
          const gap = estimateWaterCells(cells, connectivity, componentId, seededComponentId);
          if (gap < nearestWaterGap) {
            nearestWaterGap = gap;
            nearestSeededComponentId = seededComponentId;
          }
        }
        value = { nearestSeededComponentId, nearestWaterGap };
        nearestSeededGapByComponent.set(componentId, value);
      }
      return value;
    };

    for (const candidate of sourceCandidates) {
      if (seedSet.has(candidate.cellId)) continue;
      if (candidate.componentId < 0) continue;

      const point = cells[candidate.cellId].site;
      let minDistance = Infinity;
      for (const seedCellId of seeds) {
        const seedPoint = cells[seedCellId].site;
        minDistance = Math.min(
          minDistance,
          Math.hypot(point[0] - seedPoint[0], point[1] - seedPoint[1])
        );
      }

      let totalScore = candidate.score * 1.15 + Math.sqrt(minDistance) * 0.18;

      const isLargeComponent = connectivity.largeComponentIds.has(candidate.componentId);
      const componentSize = connectivity.componentSizes[candidate.componentId] || 0;
      const alreadySeededInComponent = getAlreadySeededInComponent(candidate.componentId);

      const { nearestSeededComponentId, nearestWaterGap } = getNearestSeededGap(
        candidate.componentId
      );

      // Soft geography bias:
      // - Large + far disconnected components: moderately prefer separate seeds.
      // - Small + close/similar components: prefer sharing nations (fewer seeds across islands).
      if (isLargeComponent && !alreadySeededInComponent) {
        const gapFactor = Number.isFinite(nearestWaterGap)
          ? clamp((nearestWaterGap - 6) / 18, 0, 1)
          : 0.5;
        totalScore += 1.8 + gapFactor * 3.2;
      } else if (isLargeComponent && alreadySeededInComponent) {
        totalScore -= 0.7;
      }

      // In balanced mode we still want seeds on small islands occasionally,
      // but avoid over-seeding tiny components which later collapse to min-size nations.
      if (minComponentSize > 1) {
        if (componentSize < minComponentSize + 4) {
          totalScore -= (minComponentSize + 4 - componentSize) * 0.45;
        } else if (componentSize < minComponentSize + 16) {
          totalScore -= (minComponentSize + 16 - componentSize) * 0.18;
        }
      }

      if (!isLargeComponent && !alreadySeededInComponent && nearestSeededComponentId >= 0) {
        const nearestSize = connectivity.componentSizes[nearestSeededComponentId] || 1;
        const sizeSimilarity =
          1 - Math.abs(componentSize - nearestSize) / Math.max(componentSize, nearestSize);
        const similarity = clamp(sizeSimilarity, 0, 1);
        const closeGapFactor = Number.isFinite(nearestWaterGap)
          ? clamp(1 - nearestWaterGap / 12, 0, 1)
          : 0;

        // Nearby and similarly-sized small islands should often stay under the same nation.
        const groupingBias = closeGapFactor * (0.55 + similarity * 0.45);
        totalScore -= groupingBias * 2.4;

        // If small island is far from existing seeded components, allow new nation seed more easily.
        if (nearestWaterGap > 16) totalScore += 0.65;
      }

      const noise = Math.sin((candidate.cellId * 2654435761 + seedHash) * 0.000001) * 0.35;
      totalScore += noise;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestCellId = candidate.cellId;
        bestComponentId = candidate.componentId;
      }
    }
    if (bestCellId < 0) break;
    seeds.push(bestCellId);
    if (connectivity.largeComponentIds.has(bestComponentId)) {
      seededLargeComponentIds.add(bestComponentId);
    }
  }
  return seeds;
}
