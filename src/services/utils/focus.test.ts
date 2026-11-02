import { describe, expect, it } from 'vitest';
import { TCell } from 'src/types/global';
import { getNationFocus } from './focus';

const cell = (x: number, y: number, nationId: number | null, isWater = false) =>
  ({ site: [x, y], nationId, isWater }) as unknown as TCell;

describe('getNationFocus', () => {
  const cells = [cell(100, 100, 1), cell(300, 200, 1), cell(900, 700, 2), cell(500, 500, 1, true)];

  it('centres on the land of the nation and ignores water and other nations', () => {
    const focus = getNationFocus(cells, 1, 1000, 800, 8)!;
    expect(focus.fraction).toEqual({ x: 0.2, y: 0.1875 });
  });

  it('zooms in until the nation fills most of the frame, within the zoom limit', () => {
    const focus = getNationFocus(cells, 1, 1000, 800, 8)!;
    expect(focus.scale).toBeCloseTo(0.7 * Math.min(1000 / 200, 800 / 100));
    expect(getNationFocus(cells, 1, 1000, 800, 2)!.scale).toBe(2);
  });

  it('never zooms out below the whole map and returns null without land', () => {
    expect(getNationFocus([cell(0, 0, 1), cell(1000, 800, 1)], 1, 1000, 800, 8)!.scale).toBe(1);
    expect(getNationFocus(cells, 9, 1000, 800, 8)).toBeNull();
  });
});
