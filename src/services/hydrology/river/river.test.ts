import { DEFAULT_CONFIG } from 'src/configs/map/common';
import { MapGenerator } from 'src/services/pipeline/MapGenerator';
import { TCell, TGenerationConfig, TRiver } from 'src/types/global';
import { describe, expect, it } from 'vitest';
import { fillDepressions } from './flow';
import { computeStrahlerOrders } from './graph';

// A strip of cells: 0 (outlet, touches non-land cell 5) - 1 - 2 - 3 - 4, with a pit at 3.
function makeStrip(): { cells: TCell[]; elevation: Float32Array; isLand: Uint8Array } {
  const neighbors = [[1, 5], [0, 2], [1, 3], [2, 4], [3], [0]];
  const cells = neighbors.map((list) => ({ neighbors: list })) as unknown as TCell[];
  return {
    cells,
    elevation: Float32Array.from([0.3, 0.4, 0.6, 0.35, 0.7, 0]),
    isLand: Uint8Array.from([1, 1, 1, 1, 1, 0]),
  };
}

describe('fillDepressions (priority-flood)', () => {
  it('raises a pit above its lowest rim and leaves everything else alone', () => {
    const { cells, elevation, isLand } = makeStrip();
    const { filledElevation, raisedCells } = fillDepressions(cells, elevation, isLand);
    expect(raisedCells).toBe(1);
    expect(filledElevation[3]).toBeGreaterThan(elevation[2]);
    expect(filledElevation[3]).toBeLessThan(elevation[2] + 0.001);
    expect([0, 1, 2, 4].map((id) => filledElevation[id])).toEqual(
      [0, 1, 2, 4].map((id) => elevation[id])
    );
  });

  it('gives every non-outlet land cell a strictly lower neighbour', () => {
    const { cells, elevation, isLand } = makeStrip();
    const { filledElevation } = fillDepressions(cells, elevation, isLand);
    for (const id of [1, 2, 3, 4]) {
      const lower = cells[id].neighbors.some(
        (neighborId) =>
          isLand[neighborId] === 1 && filledElevation[neighborId] < filledElevation[id]
      );
      expect(lower).toBe(true);
    }
  });
});

describe('computeStrahlerOrders', () => {
  it('raises the order only when two equal-order tributaries meet', () => {
    const rivers = [0, 1, 2, 3].map((id) => ({ id })) as TRiver[];
    // 0 is the trunk; 1 and 2 are headwater tributaries of it; 3 joins tributary 1
    const tributaries = new Map([
      [0, new Set([1, 2])],
      [1, new Set([3])],
    ]);
    const orders = computeStrahlerOrders(rivers, tributaries);
    expect(orders.get(2)).toBe(1);
    expect(orders.get(3)).toBe(1);
    expect(orders.get(1)).toBe(1);
    expect(orders.get(0)).toBe(2);
  });
});

describe('generated rivers', () => {
  const config: TGenerationConfig = {
    ...DEFAULT_CONFIG,
    seed: 'world-deterministic-001',
    cellCount: 15000,
  };
  const stages = new MapGenerator(config, true).generate();
  const { cells, rivers } = stages.hydrology;

  it('creates rivers', () => {
    expect(rivers.length).toBeGreaterThan(0);
  });

  it('every river reaches the sea, a lake, another river or the map edge', () => {
    for (const river of rivers) {
      expect(['sea', 'lake', 'confluence', 'offscreen']).toContain(river.endType);
    }
  });

  it('a river that joins another ends on a river cell', () => {
    for (const river of rivers.filter((candidate) => candidate.endType === 'confluence')) {
      const last = cells[river.cells[river.cells.length - 1]];
      expect(last.isRiver).toBe(true);
      expect(river.parentRiverId).not.toBeNull();
    }
  });

  it('assigns stream orders to river cells only', () => {
    for (const cell of cells) {
      if (cell.isRiver) expect(cell.riverOrder).toBeGreaterThanOrEqual(1);
      else expect(cell.riverOrder).toBe(0);
    }
  });
});
