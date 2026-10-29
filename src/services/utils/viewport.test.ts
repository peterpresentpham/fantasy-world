import { describe, expect, it } from 'vitest';
import {
  centerViewportOn,
  clampViewport,
  IDENTITY_VIEWPORT,
  panViewport,
  visibleFraction,
  zoomViewportAt,
} from './viewport';

const size = { width: 1000, height: 600 };
const limits = { minScale: 1, maxScale: 8 };

describe('clampViewport', () => {
  it('keeps the layer covering the frame', () => {
    expect(clampViewport({ scale: 2, x: 100, y: 100 }, size, limits)).toEqual({
      scale: 2,
      x: 0,
      y: 0,
    });
    expect(clampViewport({ scale: 2, x: -5000, y: -5000 }, size, limits)).toEqual({
      scale: 2,
      x: -1000,
      y: -600,
    });
  });

  it('limits the scale and pins the layer at scale 1', () => {
    expect(clampViewport({ scale: 20, x: 0, y: 0 }, size, limits).scale).toBe(8);
    expect(clampViewport({ scale: 0.2, x: -50, y: -50 }, size, limits)).toEqual(IDENTITY_VIEWPORT);
  });
});

describe('zoomViewportAt', () => {
  it('keeps the point under the anchor fixed', () => {
    const start = { scale: 2, x: -400, y: -200 };
    const anchor = { x: 300, y: 250 };
    const before = { x: (anchor.x - start.x) / start.scale, y: (anchor.y - start.y) / start.scale };
    const next = zoomViewportAt(start, anchor, 1.5, size, limits);
    expect(next.scale).toBeCloseTo(3);
    expect((anchor.x - next.x) / next.scale).toBeCloseTo(before.x);
    expect((anchor.y - next.y) / next.scale).toBeCloseTo(before.y);
  });

  it('returns to the identity when zooming all the way out', () => {
    const zoomed = zoomViewportAt(IDENTITY_VIEWPORT, { x: 700, y: 100 }, 4, size, limits);
    expect(zoomViewportAt(zoomed, { x: 700, y: 100 }, 0.01, size, limits)).toEqual(
      IDENTITY_VIEWPORT
    );
  });

  it('never exceeds the max scale', () => {
    let view = IDENTITY_VIEWPORT;
    for (let i = 0; i < 20; i += 1) view = zoomViewportAt(view, { x: 0, y: 0 }, 2, size, limits);
    expect(view.scale).toBe(8);
  });
});

describe('panViewport / centerViewportOn / visibleFraction', () => {
  it('pans within bounds', () => {
    const zoomed = { scale: 2, x: -100, y: -100 };
    expect(panViewport(zoomed, 30, -20, size, limits)).toEqual({ scale: 2, x: -70, y: -120 });
    expect(panViewport(zoomed, 1e6, 1e6, size, limits)).toEqual({ scale: 2, x: 0, y: 0 });
  });

  it('centers on a fraction of the layer', () => {
    const view = centerViewportOn({ scale: 4, x: 0, y: 0 }, { x: 0.5, y: 0.5 }, size, limits);
    expect(visibleFraction(view, size).left).toBeCloseTo(0.375);
    expect(visibleFraction(view, size).width).toBeCloseTo(0.25);
  });

  it('reports the whole layer at scale 1', () => {
    expect(visibleFraction(IDENTITY_VIEWPORT, size)).toEqual({
      left: -0,
      top: -0,
      width: 1,
      height: 1,
    });
  });
});
