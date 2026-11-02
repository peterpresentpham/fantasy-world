import { TMesh } from 'src/types/global';
import { describe, expect, it } from 'vitest';
import { buildWorldName, buildWorldSummary, formatCount } from './worldSummary';

const mesh = {
  cells: [
    { isWater: false, population: 100, nationId: 0 },
    { isWater: false, population: 900, nationId: 1 },
    { isWater: false, population: 50, nationId: 1 },
    { isWater: true, population: 0, nationId: null },
  ],
  nations: [
    { id: 0, name: 'Small' },
    { id: 1, name: 'Big' },
  ],
  ethnics: [{ id: 0, name: 'Folk' }],
  rivers: [
    { name: 'Short', length: 3 },
    { name: 'Long', length: 9 },
  ],
} as unknown as TMesh;

describe('worldSummary', () => {
  it('names a world the same way every time', () => {
    expect(buildWorldName('abc')).toBe(buildWorldName('abc'));
    expect(buildWorldName('abc')).toMatch(/^[A-Z][a-z]+$/);
  });

  it('totals the map and ranks nations by population', () => {
    const summary = buildWorldSummary(mesh, 'abc');
    expect(summary.landPercent).toBe(75);
    expect(summary.population).toBe(1050);
    expect(summary.nations.map((n) => n.name)).toEqual(['Big', 'Small']);
    expect(summary.longestRiver).toEqual({ name: 'Long', length: 9 });
  });

  it('formats large numbers', () => {
    expect(formatCount(950)).toBe('950');
    expect(formatCount(12_500)).toBe('12.5K');
    expect(formatCount(3_400_000)).toBe('3.4M');
  });
});
