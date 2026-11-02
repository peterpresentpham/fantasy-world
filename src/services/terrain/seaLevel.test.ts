import { describe, expect, it } from 'vitest';
import { getTargetLandFraction, remapToLandFraction } from './seaLevel';

const ramp = () => Float32Array.from({ length: 1000 }, (_, i) => (i + 1) / 1001);
const landShare = (elevations: Float32Array, seaLevel: number) =>
  elevations.filter((e) => e >= seaLevel).length / elevations.length;

describe('remapToLandFraction', () => {
  it('puts the requested share of cells above the sea level', () => {
    for (const fraction of [0.15, 0.4, 0.7]) {
      const out = remapToLandFraction(ramp(), 0.5, fraction);
      expect(landShare(out, 0.5)).toBeCloseTo(fraction, 1);
    }
  });

  it('keeps the order of cells and stays within 0..1', () => {
    const input = Float32Array.from([0.1, 0.9, 0.3, 0.5, 0.7, 0.2]);
    const out = remapToLandFraction(input, 0.5, 0.5);
    const order = (a: Float32Array) => [...a.keys()].sort((x, y) => a[x] - a[y]);
    expect(order(out)).toEqual(order(input));
    expect(Math.min(...out)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...out)).toBeLessThanOrEqual(1);
  });

  it('gives the same land share whatever the original elevation scale', () => {
    const low = ramp().map((e) => e * 0.4);
    const high = ramp().map((e) => 0.6 + e * 0.4);
    expect(landShare(remapToLandFraction(low, 0.5, 0.4), 0.5)).toBeCloseTo(0.4, 1);
    expect(landShare(remapToLandFraction(high, 0.5, 0.4), 0.5)).toBeCloseTo(0.4, 1);
  });
});

describe('getTargetLandFraction', () => {
  it('is the preset target at the default slider and shrinks as the sea rises', () => {
    const base = getTargetLandFraction('balanced', 0.5);
    expect(getTargetLandFraction('balanced', 0.7)).toBeLessThan(base);
    expect(getTargetLandFraction('balanced', 0.3)).toBeGreaterThan(base);
  });

  it('keeps every preset between the limits at the slider extremes', () => {
    for (const preset of [
      'balanced',
      'continental',
      'ranges',
      'rifted',
      'archipelago',
      'volcanic',
    ] as const) {
      for (const sea of [0.1, 0.9]) {
        const value = getTargetLandFraction(preset, sea);
        expect(value).toBeGreaterThanOrEqual(0.05);
        expect(value).toBeLessThanOrEqual(0.85);
      }
    }
  });
});
