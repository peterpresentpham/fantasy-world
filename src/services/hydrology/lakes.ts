import { HYDROLOGY_CONFIG, LAKE_CONFIG } from 'src/configs/map/hydrology';
import { TFifoQueue } from 'src/services/utils/collections';
import { collectConnectedComponents, floodFromSeeds } from 'src/services/utils/graph';
import { TCell } from 'src/types/global';

const T_COAST_OUTLET = HYDROLOGY_CONFIG.coastOutletId;
const traversalWorkspace = {};
const expansion = LAKE_CONFIG.expansion;
function expandLakes(cells: TCell[], flow: Float32Array, downstream: Int32Array) {
  const candidateLakeSeeds: number[] = [];
  const visitMark = new Uint32Array(cells.length);
  let stamp = 1;

  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    const cell = cells[cellIndex];
    if (!cell.isLake) continue;
    if (cell.rainShadow > expansion.rainShadowMax) continue;
    if (cell.precipitation < expansion.precipMin) continue;
    candidateLakeSeeds.push(cellIndex);
  }

  for (const seedId of candidateLakeSeeds) {
    const seedCell = cells[seedId];
    const targetMax = Math.min(expansion.maxCells, 2 + Math.floor(Math.log2(flow[seedId] + 1) * 2));
    let expanded = 1;
    const queue = new TFifoQueue<number>();
    queue.enqueue(seedId);
    stamp += 1;
    visitMark[seedId] = stamp;

    while (queue.size > 0 && expanded < targetMax) {
      const currentId = queue.dequeue() as number;
      const currentCell = cells[currentId];

      for (const neighborId of currentCell.neighbors) {
        if (visitMark[neighborId] === stamp) continue;
        visitMark[neighborId] = stamp;

        const neighbor = cells[neighborId];
        if (neighbor.isWater || neighbor.isLake) continue;
        if (neighbor.rainShadow > expansion.rainShadowMax) continue;
        if (neighbor.precipitation < expansion.precipMin) continue;
        if (neighbor.elevation > seedCell.elevation + expansion.elevationSlack) {
          continue;
        }
        if (downstream[neighborId] === T_COAST_OUTLET) continue;

        neighbor.isLake = true;
        neighbor.isWater = true;
        neighbor.landform = 'lake';
        neighbor.biome = 'freshwater';
        neighbor.suitability = 0.12;
        expanded += 1;
        queue.enqueue(neighborId);

        if (expanded >= targetMax) break;
      }
    }
  }

  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    const cell = cells[cellIndex];
    if (!cell.isLake) continue;
    cell.landform = 'lake';
    cell.biome = 'freshwater';
    cell.suitability = 0.12;
  }
}

function buildLakeRegions(cells: TCell[]) {
  return collectConnectedComponents(
    cells,
    (cell) => cell.isLake,
    (_current, neighbor) => neighbor.isLake,
    false,
    traversalWorkspace
  );
}

function isMarineLandform(cell: TCell) {
  return cell.landform === 'marine_deep' || cell.landform === 'marine_shallow';
}

function touchesMapBoundary(cell: TCell, width: number, height: number) {
  const epsilon = 1;
  if (cell.site[0] <= epsilon || cell.site[0] >= width - epsilon) return true;
  if (cell.site[1] <= epsilon || cell.site[1] >= height - epsilon) return true;
  for (const [x, y] of cell.polygon) {
    if (x <= epsilon || x >= width - epsilon) return true;
    if (y <= epsilon || y >= height - epsilon) return true;
  }
  return false;
}

function buildOceanWaterMask(cells: TCell[], width: number, height: number) {
  const seedIds: number[] = [];
  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    if (!cells[cellIndex].isWater) continue;
    if (!touchesMapBoundary(cells[cellIndex], width, height)) continue;
    seedIds.push(cellIndex);
  }
  return floodFromSeeds(
    cells,
    seedIds,
    (_current, neighbor) => neighbor.isWater,
    traversalWorkspace
  );
}

const enclosedWater = LAKE_CONFIG.enclosedWater;
function classifyInlandWater(
  cells: TCell[],
  width: number,
  height: number,
  seaLevel: number,
  downstream: Int32Array
) {
  const oceanConnected = buildOceanWaterMask(cells, width, height);
  const threshold = seaLevel + enclosedWater.elevationBuffer;
  const visited = new Uint8Array(cells.length);
  const stack: number[] = [];

  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    if (visited[cellIndex] === 1) continue;
    if (oceanConnected[cellIndex] === 1) continue;
    const isEnclosedSeedCandidate =
      cells[cellIndex].isWater || cells[cellIndex].isLake || downstream[cellIndex] === -1;
    if (!isEnclosedSeedCandidate) continue;
    if (cells[cellIndex].elevation > threshold) continue;

    stack.length = 0;
    stack.push(cellIndex);
    const component: number[] = [];
    visited[cellIndex] = 1;
    let minElevation = cells[cellIndex].elevation;

    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined) continue;
      const currentCell = cells[current];
      component.push(current);
      minElevation = Math.min(minElevation, currentCell.elevation);

      for (const neighborId of currentCell.neighbors) {
        if (visited[neighborId] === 1) continue;
        if (oceanConnected[neighborId] === 1) continue;
        if (cells[neighborId].elevation > threshold) continue;
        visited[neighborId] = 1;
        stack.push(neighborId);
      }
    }

    const basinDepth = seaLevel - minElevation;
    const shouldPersistWater =
      basinDepth >= enclosedWater.depthMin || component.some((id) => cells[id].isWater);
    if (!shouldPersistWater) continue;

    const isLake = component.length <= enclosedWater.maxLakeCells;
    const shorelineRise = Math.min(
      enclosedWater.shoreRiseMax,
      basinDepth * enclosedWater.shoreRiseFactor
    );
    const waterSurface = seaLevel + Math.max(0, shorelineRise);

    for (const waterCellId of component) {
      const waterCell = cells[waterCellId];
      if (waterCell.elevation > waterSurface) continue;
      waterCell.isWater = true;
      waterCell.isLake = isLake;
      waterCell.isRiver = false;
      waterCell.landform = isLake ? 'lake' : 'marine_deep';
      waterCell.biome = isLake ? 'freshwater' : 'marine';
      waterCell.suitability = isLake ? 0.12 : 0;
    }
  }
}

function filterAndLimitLakes(cells: TCell[], flow: Float32Array) {
  const regions = buildLakeRegions(cells);
  const candidateRegions: number[][] = [];

  for (const region of regions) {
    let touchesSea = false;

    for (const cellId of region) {
      for (const neighborId of cells[cellId].neighbors) {
        if (isMarineLandform(cells[neighborId])) {
          touchesSea = true;
          break;
        }
      }
      if (touchesSea) break;
    }

    if (touchesSea) {
      for (const cellId of region) {
        const cell = cells[cellId];
        cell.isLake = false;
        cell.isWater = false;
        cell.landform = 'coast';
        cell.biome = 'savanna';
        cell.suitability = 0.6;
      }
      continue;
    }

    candidateRegions.push(region);
  }

  const regionScore = candidateRegions.map((region) => {
    let maxFlow = 0;
    for (const cellId of region) {
      maxFlow = Math.max(maxFlow, flow[cellId]);
    }
    return { region, score: maxFlow + region.length * 0.8 };
  });

  regionScore.sort((a, b) => b.score - a.score);
  const keptRegions = new Set(
    regionScore.slice(0, LAKE_CONFIG.limits.maxCount).map((v) => v.region)
  );

  for (const entry of regionScore) {
    if (keptRegions.has(entry.region)) continue;
    for (const cellId of entry.region) {
      const cell = cells[cellId];
      cell.isLake = false;
      cell.isWater = false;
      cell.landform = 'valley';
      cell.biome = 'wetland';
      cell.suitability = 0.52;
    }
  }
}

export { classifyInlandWater, expandLakes, filterAndLimitLakes };
