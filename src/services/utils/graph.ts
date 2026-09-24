import { TCell } from 'src/types/global';
import { TDeterministicMinHeap, TFifoQueue } from './collections';

type TTraversalWorkspace = {
  visitedStamp?: Uint32Array;
  stack?: number[];
  stamp?: number;
};

function prepareWorkspace(
  cellCount: number,
  workspace?: TTraversalWorkspace
): { visitedStamp: Uint32Array; stack: number[]; stamp: number } {
  if (!workspace) return { visitedStamp: new Uint32Array(cellCount), stack: [], stamp: 1 };

  if (!workspace.visitedStamp || workspace.visitedStamp.length !== cellCount) {
    workspace.visitedStamp = new Uint32Array(cellCount);
    workspace.stamp = 1;
  }
  if (!workspace.stack) workspace.stack = [];
  const nextStamp = (workspace.stamp ?? 1) + 1;
  workspace.stamp = nextStamp;
  return { visitedStamp: workspace.visitedStamp, stack: workspace.stack, stamp: nextStamp };
}

export function collectConnectedComponents(
  cells: TCell[],
  shouldInclude: (cell: TCell) => boolean,
  canTraverse: (current: TCell, neighbor: TCell) => boolean,
  sortBySizeDesc = false,
  workspace?: TTraversalWorkspace
) {
  const { visitedStamp, stack, stamp } = prepareWorkspace(cells.length, workspace);
  const components: number[][] = [];

  for (const cell of cells) {
    if (visitedStamp[cell.id] === stamp) continue;
    if (!shouldInclude(cell)) continue;

    stack.length = 0;
    stack.push(cell.id);
    const component: number[] = [];
    visitedStamp[cell.id] = stamp;

    while (stack.length > 0) {
      const currentId = stack.pop() as number;
      const current = cells[currentId];
      component.push(currentId);

      for (const neighborId of current.neighbors) {
        if (visitedStamp[neighborId] === stamp) continue;
        const neighbor = cells[neighborId];
        if (!shouldInclude(neighbor)) continue;
        if (!canTraverse(current, neighbor)) continue;
        visitedStamp[neighborId] = stamp;
        stack.push(neighborId);
      }
    }
    components.push(component);
  }
  if (sortBySizeDesc) components.sort((a, b) => b.length - a.length);
  return components;
}

export function floodFromSeeds(
  cells: TCell[],
  seeds: number[],
  canTraverse: (current: TCell, neighbor: TCell) => boolean,
  workspace?: TTraversalWorkspace
) {
  const { visitedStamp, stack, stamp } = prepareWorkspace(cells.length, workspace);
  const visited = new Uint8Array(cells.length);

  for (const seedId of seeds) {
    if (seedId < 0 || seedId >= cells.length) continue;
    visitedStamp[seedId] = stamp;
    stack.push(seedId);
  }

  while (stack.length > 0) {
    const currentId = stack.pop() as number;
    visited[currentId] = 1;
    const current = cells[currentId];
    for (const neighborId of current.neighbors) {
      if (visitedStamp[neighborId] === stamp) continue;
      if (!canTraverse(current, cells[neighborId])) continue;
      visitedStamp[neighborId] = stamp;
      stack.push(neighborId);
    }
  }
  return visited;
}

type TBuildDistanceMapOptions = {
  isSeed: (cellId: number) => boolean;
  canTraverse?: (currentId: number, neighborId: number) => boolean;
  canVisit?: (neighborId: number) => boolean;
};

export function buildDistanceMap(
  cells: Pick<TCell, 'neighbors'>[],
  options: TBuildDistanceMapOptions
) {
  const distances = new Int32Array(cells.length);
  distances.fill(-1);
  const queue = new TFifoQueue<number>();

  for (let cellId = 0; cellId < cells.length; cellId += 1) {
    if (!options.isSeed(cellId)) continue;
    distances[cellId] = 0;
    queue.enqueue(cellId);
  }

  while (queue.size > 0) {
    const currentId = queue.dequeue() as number;
    const nextDistance = distances[currentId] + 1;
    const current = cells[currentId];
    for (const neighborId of current.neighbors) {
      if (distances[neighborId] >= 0) continue;
      if (options.canVisit && !options.canVisit(neighborId)) continue;
      if (options.canTraverse && !options.canTraverse(currentId, neighborId)) continue;
      distances[neighborId] = nextDistance;
      queue.enqueue(neighborId);
    }
  }
  return distances;
}

type TExpandOptions<TState> = {
  seeds: TState[];
  getPriority: (state: TState) => number;
  isStale: (state: TState) => boolean;
  expand: (state: TState, push: (next: TState) => void) => void;
};

export function runMultiSourceExpansion<TState>({
  seeds,
  getPriority,
  isStale,
  expand,
}: TExpandOptions<TState>) {
  const frontier = new TDeterministicMinHeap<TState>();

  for (const seedState of seeds) {
    frontier.push(seedState, getPriority(seedState));
  }

  while (frontier.size > 0) {
    const current = frontier.pop();
    if (current === undefined) break;
    if (isStale(current)) continue;
    expand(current, (next) => {
      frontier.push(next, getPriority(next));
    });
  }
}
