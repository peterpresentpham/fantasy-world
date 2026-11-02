import { describe, expect, it } from 'vitest';
import { TCell } from 'src/types/global';
import { assignMaritimeZones } from './boundary';

/** A row of cells: `L` land, `S` sea, `K` lake. Cell i touches i-1 and i+1. */
function row(layout: string): TCell[] {
  return [...layout].map(
    (kind, id) =>
      ({
        id,
        isWater: kind !== 'L',
        isLake: kind === 'K',
        neighbors: [id - 1, id + 1].filter((n) => n >= 0 && n < layout.length),
      }) as unknown as TCell
  );
}

// 100 cells over 1000 x 100 gives a spacing of about 31.6 and a diagonal of about 1005, so with a
// reach of 0.028 of the diagonal the sea belongs to the coast for 1 cell.
const WIDTH = 1000;
const HEIGHT = 100;

describe('assignMaritimeZones', () => {
  it('gives the sea next to a coast to that nation and the far sea to nobody', () => {
    const layout = 'L' + 'S'.repeat(98) + 'L';
    const cells = row(layout);
    const owner = new Int32Array(cells.length).fill(-1);
    owner[0] = 0;
    owner[99] = 1;
    const { waterOwner, zoneType } = assignMaritimeZones(cells, owner, WIDTH, HEIGHT);
    expect(zoneType[0]).toBe('land');
    expect(zoneType[1]).toBe('territorial-waters');
    expect(waterOwner[1]).toBe(0);
    expect(zoneType[98]).toBe('territorial-waters');
    expect(waterOwner[98]).toBe(1);
    expect(zoneType[50]).toBe('international-waters');
    expect(waterOwner[50]).toBe(-1);
  });

  it('splits a strait between the two coasts', () => {
    const cells = row('LSSL');
    const owner = Int32Array.from([0, -1, -1, 1]);
    const { waterOwner } = assignMaritimeZones(cells, owner, WIDTH, HEIGHT);
    expect(waterOwner[1]).toBe(0);
    expect(waterOwner[2]).toBe(1);
  });

  it('keeps a lake as internal waters of the surrounding nation however wide it is', () => {
    const cells = row('L' + 'K'.repeat(20) + 'L');
    const owner = new Int32Array(cells.length).fill(-1);
    owner[0] = 3;
    owner[21] = 3;
    const { waterOwner, zoneType } = assignMaritimeZones(cells, owner, WIDTH, HEIGHT);
    for (let i = 1; i <= 20; i += 1) {
      expect(zoneType[i]).toBe('internal-waters');
      expect(waterOwner[i]).toBe(3);
    }
  });

  it('leaves the sea next to land that belongs to no nation international', () => {
    const cells = row('LSS');
    const owner = new Int32Array(3).fill(-1);
    const { zoneType, waterOwner } = assignMaritimeZones(cells, owner, WIDTH, HEIGHT);
    expect(zoneType[1]).toBe('international-waters');
    expect(waterOwner[1]).toBe(-1);
  });
});
