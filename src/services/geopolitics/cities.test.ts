import { describe, expect, it } from 'vitest';
import { TCell } from 'src/types/global';
import { getCityCells, keepCitiesWhole } from './cities';

/** A row of land cells with the given populations; cell i touches i-1 and i+1. */
function row(populations: number[]): TCell[] {
  return populations.map(
    (population, id) =>
      ({
        id,
        isWater: false,
        isLake: false,
        population,
        neighbors: [id - 1, id + 1].filter((n) => n >= 0 && n < populations.length),
      }) as unknown as TCell
  );
}

describe('getCityCells', () => {
  it('returns local population peaks that are big enough, biggest first', () => {
    const cells = row([1, 5, 1, 100, 1, 90, 1]);
    expect(getCityCells(cells)).toEqual([3, 5]);
  });

  it('ignores peaks that are only villages next to the biggest city', () => {
    const cells = row([1, 100, 1, 2, 1]);
    expect(getCityCells(cells)).toEqual([1]);
  });
});

describe('keepCitiesWhole', () => {
  it('gives everything within two steps of a city to the city nation', () => {
    const cells = row([1, 1, 1, 1, 100, 1, 1, 1, 1, 1]);
    const owner = Int32Array.from([0, 0, 0, 0, 0, 0, 1, 1, 1, 1]);
    // The border (5|6) lies one step from the city at 4.
    keepCitiesWhole(cells, owner);
    expect([...owner]).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 1, 1]);
  });

  it('does not take back land that a bigger city already settled', () => {
    const cells = row([1, 100, 1, 1, 1, 60, 1, 1]);
    const owner = Int32Array.from([0, 0, 0, 0, 1, 1, 1, 1]);
    keepCitiesWhole(cells, owner);
    expect(owner[1]).toBe(0);
    expect(owner[5]).toBe(1);
    expect(owner[3]).toBe(0);
  });
});
