import { describe, expect, it } from 'vitest';
import { clampPosition, isSamePosition } from './floatingPosition';

const element = { width: 100, height: 40 };
const container = { width: 500, height: 300 };

describe('clampPosition', () => {
  it('leaves an in-bounds position alone', () => {
    expect(clampPosition({ x: 10, y: 20 }, element, container)).toEqual({ x: 10, y: 20 });
  });

  it('pulls a position back inside on every side', () => {
    expect(clampPosition({ x: -5, y: -5 }, element, container)).toEqual({ x: 0, y: 0 });
    expect(clampPosition({ x: 999, y: 999 }, element, container)).toEqual({ x: 400, y: 260 });
  });

  it('pins to the origin when the element is larger than the container', () => {
    expect(clampPosition({ x: 50, y: 50 }, { width: 800, height: 400 }, container)).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('isSamePosition', () => {
  it('compares both axes', () => {
    expect(isSamePosition({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(isSamePosition({ x: 1, y: 2 }, { x: 1, y: 3 })).toBe(false);
  });
});
