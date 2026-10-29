import { TCell } from 'src/types/global';
import { describe, expect, it } from 'vitest';
import {
  buildDistanceMap,
  collectConnectedComponents,
  floodFromSeeds,
  runMultiSourceExpansion,
} from './graph';

// Path graph 0-1-2-3-4 plus an isolated pair 5-6.
const EDGES: number[][] = [[1], [0, 2], [1, 3], [2, 4], [3], [6], [5]];
const cells = EDGES.map((neighbors, id) => ({ id, neighbors })) as unknown as TCell[];

describe('collectConnectedComponents', () => {
  it('finds each component once', () => {
    const components = collectConnectedComponents(
      cells,
      () => true,
      () => true
    );
    expect(components.map((c) => [...c].sort())).toEqual([
      [0, 1, 2, 3, 4],
      [5, 6],
    ]);
  });

  it('honors shouldInclude and canTraverse', () => {
    const skipTwo = collectConnectedComponents(
      cells,
      (c) => c.id !== 2,
      () => true
    );
    expect(skipTwo.map((c) => [...c].sort())).toEqual([
      [0, 1],
      [3, 4],
      [5, 6],
    ]);

    const cutBetween = collectConnectedComponents(
      cells,
      () => true,
      (a, b) => !(a.id === 1 && b.id === 2) && !(a.id === 2 && b.id === 1)
    );
    expect(cutBetween.length).toBe(3);
  });

  it('sorts by size descending when asked', () => {
    const sorted = collectConnectedComponents(
      cells,
      () => true,
      () => true,
      true
    );
    expect(sorted[0].length).toBeGreaterThanOrEqual(sorted[1].length);
  });

  it('can reuse a workspace across calls', () => {
    const workspace = {};
    const run = () =>
      collectConnectedComponents(
        cells,
        () => true,
        () => true,
        false,
        workspace
      ).length;
    expect(run()).toBe(2);
    expect(run()).toBe(2);
  });
});

describe('floodFromSeeds', () => {
  it('marks the reachable set and ignores invalid seeds', () => {
    const visited = floodFromSeeds(cells, [0, -1, 99], () => true);
    expect(Array.from(visited)).toEqual([1, 1, 1, 1, 1, 0, 0]);
  });
});

describe('buildDistanceMap', () => {
  it('computes BFS distances and -1 for unreachable cells', () => {
    const dist = buildDistanceMap(cells, { isSeed: (id) => id === 0 });
    expect(Array.from(dist)).toEqual([0, 1, 2, 3, 4, -1, -1]);
  });

  it('supports multiple seeds and canVisit', () => {
    const dist = buildDistanceMap(cells, {
      isSeed: (id) => id === 0 || id === 4,
      canVisit: (id) => id !== 3,
    });
    expect(Array.from(dist.slice(0, 5))).toEqual([0, 1, 2, -1, 0]);
  });
});

describe('runMultiSourceExpansion', () => {
  it('expands in priority order and skips stale states', () => {
    const order: number[] = [];
    const seen = new Set<number>();
    runMultiSourceExpansion<{ id: number; cost: number }>({
      seeds: [{ id: 0, cost: 0 }],
      getPriority: (s) => s.cost,
      isStale: (s) => seen.has(s.id),
      expand: (s, push) => {
        seen.add(s.id);
        order.push(s.id);
        for (const n of EDGES[s.id]) push({ id: n, cost: s.cost + 1 });
      },
    });
    expect(order).toEqual([0, 1, 2, 3, 4]);
  });
});
