import { DEFAULT_CONFIG } from 'src/configs/map/common';
import { describe, expect, it } from 'vitest';
import { buildWorldSearch, parseWorldParams } from './worldUrl';

const defaults = {
  seed: 'abc',
  topography: DEFAULT_CONFIG.topography,
  seaLevel: DEFAULT_CONFIG.seaLevel,
  nationCount: DEFAULT_CONFIG.nationCount,
  cellCount: DEFAULT_CONFIG.cellCount,
};

describe('worldUrl', () => {
  it('only puts the seed in the link when everything else is default', () => {
    expect(buildWorldSearch(defaults)).toBe('?seed=abc');
  });

  it('round-trips a custom world', () => {
    const world = {
      seed: 'my world',
      topography: 'archipelago' as const,
      seaLevel: 0.55,
      nationCount: 7,
      cellCount: 8000,
    };
    expect(parseWorldParams(buildWorldSearch(world))).toEqual(world);
  });

  it('ignores unknown or out-of-range values', () => {
    expect(parseWorldParams('?seed=&topo=nope&sea=3&nations=1&cells=10&nations=2.5')).toEqual({});
    expect(parseWorldParams(`?seed=${'x'.repeat(65)}`)).toEqual({});
    expect(parseWorldParams('?sea=abc&cells=')).toEqual({});
  });

  it('trims the seed and keeps valid settings next to invalid ones', () => {
    expect(parseWorldParams('?seed=%20hello%20&topo=ranges&cells=99999')).toEqual({
      seed: 'hello',
      topography: 'ranges',
    });
  });
});
