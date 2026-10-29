import { clamp } from './math';

export type TViewport = { scale: number; x: number; y: number };
export type TViewportSize = { width: number; height: number };
export type TViewportPoint = { x: number; y: number };
export type TViewportLimits = { minScale: number; maxScale: number };

export const IDENTITY_VIEWPORT: TViewport = { scale: 1, x: 0, y: 0 };

/**
 * The viewport is a CSS `translate(x, y) scale(scale)` applied to a layer that fills a frame of
 * `size`, with the origin at the top-left. Coordinates are frame-local pixels. The scaled layer is
 * never allowed to leave a gap inside the frame.
 */
export function clampViewport(
  viewport: TViewport,
  size: TViewportSize,
  { minScale, maxScale }: TViewportLimits
): TViewport {
  const scale = clamp(viewport.scale, minScale, maxScale);
  const minX = Math.min(0, size.width - size.width * scale);
  const minY = Math.min(0, size.height - size.height * scale);
  return { scale, x: clamp(viewport.x, minX, 0), y: clamp(viewport.y, minY, 0) };
}

/** Zoom by `factor`, keeping the layer point under `anchor` fixed on screen. */
export function zoomViewportAt(
  viewport: TViewport,
  anchor: TViewportPoint,
  factor: number,
  size: TViewportSize,
  limits: TViewportLimits
): TViewport {
  const scale = clamp(viewport.scale * factor, limits.minScale, limits.maxScale);
  const ratio = scale / viewport.scale;
  return clampViewport(
    {
      scale,
      x: anchor.x - (anchor.x - viewport.x) * ratio,
      y: anchor.y - (anchor.y - viewport.y) * ratio,
    },
    size,
    limits
  );
}

export function panViewport(
  viewport: TViewport,
  dx: number,
  dy: number,
  size: TViewportSize,
  limits: TViewportLimits
): TViewport {
  return clampViewport({ ...viewport, x: viewport.x + dx, y: viewport.y + dy }, size, limits);
}

/** Center the frame on a point of the layer given as fractions (0..1) of its width/height. */
export function centerViewportOn(
  viewport: TViewport,
  fraction: TViewportPoint,
  size: TViewportSize,
  limits: TViewportLimits
): TViewport {
  return clampViewport(
    {
      scale: viewport.scale,
      x: size.width / 2 - fraction.x * size.width * viewport.scale,
      y: size.height / 2 - fraction.y * size.height * viewport.scale,
    },
    size,
    limits
  );
}

/** The visible part of the layer as fractions of its width/height. */
export function visibleFraction(viewport: TViewport, size: TViewportSize) {
  return {
    left: -viewport.x / (viewport.scale * size.width),
    top: -viewport.y / (viewport.scale * size.height),
    width: 1 / viewport.scale,
    height: 1 / viewport.scale,
  };
}
