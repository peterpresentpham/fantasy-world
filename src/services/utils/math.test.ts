import { describe, expect, it } from 'vitest';
import { clamp, createSeededRandom, hashSeed, normalize, smoothStep, tentScore } from './math';

describe('clamp', () => {
  it('limits values to the range', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.4, 0, 1)).toBe(0.4);
  });
});

describe('smoothStep', () => {
  it('maps 0, 0.5, 1 to 0, 0.5, 1 and clamps outside', () => {
    expect(smoothStep(0)).toBe(0);
    expect(smoothStep(0.5)).toBe(0.5);
    expect(smoothStep(1)).toBe(1);
    expect(smoothStep(2)).toBe(1);
    expect(smoothStep(-1)).toBe(0);
  });
});

describe('normalize', () => {
  it('scales into roughly [0, 1]', () => {
    expect(normalize(5, 0, 10)).toBeCloseTo(0.5, 6);
    expect(normalize(0, 0, 10)).toBe(0);
  });
});

describe('tentScore', () => {
  it('peaks at the ideal and reaches 0 at the tolerance', () => {
    expect(tentScore(0.5, 0.5, 0.2)).toBe(1);
    expect(tentScore(0.7, 0.5, 0.2)).toBeCloseTo(0, 9);
    expect(tentScore(0.6, 0.5, 0.2)).toBeCloseTo(0.5, 9);
    expect(tentScore(5, 0.5, 0.2)).toBe(0);
  });
});

describe('hashSeed', () => {
  it('is stable and matches known FNV-1a vectors', () => {
    expect(hashSeed('')).toBe(2166136261);
    expect(hashSeed('a')).toBe(0xe40c292c);
    expect(hashSeed('world-001')).toBe(hashSeed('world-001'));
    expect(hashSeed('world-001')).not.toBe(hashSeed('world-002'));
  });
});

describe('createSeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createSeededRandom('seed');
    const b = createSeededRandom('seed');
    const seqA = Array.from({ length: 50 }, a);
    const seqB = Array.from({ length: 50 }, b);
    expect(seqA).toEqual(seqB);
  });

  it('differs between seeds and stays in [0, 1)', () => {
    const a = Array.from({ length: 20 }, createSeededRandom('one'));
    const b = Array.from({ length: 20 }, createSeededRandom('two'));
    expect(a).not.toEqual(b);
    for (const value of [...a, ...b]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('respects a custom max', () => {
    const next = createSeededRandom('seed', 4294967296 * 10);
    for (let i = 0; i < 50; i += 1) expect(next()).toBeLessThan(0.1 + 1e-9);
  });
});
