import Cost from 'src/services/geopolitics/cost';
import { TDeterministicMinHeap } from 'src/services/utils/collections';
import { TCell } from 'src/global';

type TLogisticsRouteResult = {
  pathCellIds: number[];
  totalCost: number;
  distance: number;
  riskScore: number;
  score: number;
};

type TLogisticsRouteInput = {
  cells: TCell[];
  startCellId: number;
  goalCellId: number;
  roadEdges: Set<string>;
};

function edgeKey(a: number, b: number) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function stepCost(from: TCell, to: TCell, hasRoad: boolean) {
  let cost = (Cost.logistics(from) + Cost.logistics(to)) * 0.5;

  if (from.isRiver || to.isRiver) cost += 1.6;
  if (from.nationId !== to.nationId) cost += 1.2;
  if (from.landform === 'mountain' || to.landform === 'mountain') cost += 1;
  if (from.biome === 'wetland' || to.biome === 'wetland') cost += 0.8;
  if (from.landform === 'coast' || to.landform === 'coast') cost += 0.15;
  if (hasRoad) cost *= 0.55;
  return Math.max(0.25, cost);
}

function estimateRisk(pathCellIds: number[], cells: TCell[]) {
  function cellRisk(cell: TCell) {
    if (cell.landform === 'mountain' || cell.landform === 'volcanic_field') return 1.4;
    if (cell.biome === 'wetland') return 1.1;
    if (cell.biome === 'desert_hot' || cell.biome === 'desert_cold') return 0.7;
    if (cell.landform === 'coast') return 0.25;
    if (cell.landform === 'valley' || cell.landform === 'plain') return 0.2;
    return 0.4;
  }

  let risk = 0;
  for (let index = 0; index < pathCellIds.length; index += 1) {
    const cell = cells[pathCellIds[index]];
    risk += cellRisk(cell);
    if (index > 0) {
      const prev = cells[pathCellIds[index - 1]];
      if (prev.nationId !== cell.nationId) risk += 0.8;
    }
  }
  return Number(risk.toFixed(2));
}

function reconstructPath(previous: Int32Array, start: number, goal: number) {
  const path: number[] = [];
  let cursor = goal;
  while (cursor >= 0) {
    path.push(cursor);
    if (cursor === start) break;
    cursor = previous[cursor];
  }
  path.reverse();
  if (path[0] !== start) return [];
  return path;
}

export function findLogisticsRoute({
  cells,
  startCellId,
  goalCellId,
  roadEdges,
}: TLogisticsRouteInput): TLogisticsRouteResult | null {
  if (startCellId === goalCellId) {
    return { pathCellIds: [startCellId], totalCost: 0, distance: 0, riskScore: 0, score: 100 };
  }

  const distances = new Float64Array(cells.length);
  const previous = new Int32Array(cells.length);
  const visited = new Uint8Array(cells.length);
  distances.fill(Number.POSITIVE_INFINITY);
  previous.fill(-1);
  distances[startCellId] = 0;

  const frontier = new TDeterministicMinHeap<number>();
  frontier.push(startCellId, 0);

  while (frontier.size > 0) {
    const currentId = frontier.pop() as number;
    if (visited[currentId] === 1) continue;
    visited[currentId] = 1;

    if (currentId === goalCellId) break;

    const from = cells[currentId];
    for (const neighborId of from.neighbors) {
      const to = cells[neighborId];
      if (to.isWater) continue;

      const hasRoad = roadEdges.has(edgeKey(currentId, neighborId));
      const nextCost = distances[currentId] + stepCost(from, to, hasRoad);

      if (nextCost < distances[neighborId]) {
        distances[neighborId] = nextCost;
        previous[neighborId] = currentId;
        frontier.push(neighborId, nextCost);
      }
    }
  }

  if (!Number.isFinite(distances[goalCellId])) return null;

  const pathCellIds = reconstructPath(previous, startCellId, goalCellId);
  if (pathCellIds.length === 0) return null;

  const totalCost = Number(distances[goalCellId].toFixed(2));
  const distance = pathCellIds.length;
  const riskScore = estimateRisk(pathCellIds, cells);
  const score = Number(Math.max(0, 180 - totalCost * 7 - riskScore * 3).toFixed(1));

  return { pathCellIds, totalCost, distance, riskScore, score };
}

export function buildRoadEdgeKey(pathCellIds: number[]) {
  const keys: string[] = [];
  for (let index = 1; index < pathCellIds.length; index += 1) {
    keys.push(edgeKey(pathCellIds[index - 1], pathCellIds[index]));
  }
  return keys;
}
