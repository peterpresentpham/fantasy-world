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
  { minScale, maxScale }: TViewportLimits,
  frame: TViewportSize = size
): TViewport {
  const scale = clamp(viewport.scale, minScale, maxScale);
  const minX = Math.min(0, frame.width - size.width * scale);
  const minY = Math.min(0, frame.height - size.height * scale);
  return { scale, x: clamp(viewport.x, minX, 0), y: clamp(viewport.y, minY, 0) };
}

/** Zoom by `factor`, keeping the layer point under `anchor` fixed on screen. */
export function zoomViewportAt(
  viewport: TViewport,
  anchor: TViewportPoint,
  factor: number,
  size: TViewportSize,
  limits: TViewportLimits,
  frame: TViewportSize = size
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
    limits,
    frame
  );
}

export function panViewport(
  viewport: TViewport,
  dx: number,
  dy: number,
  size: TViewportSize,
  limits: TViewportLimits,
  frame: TViewportSize = size
): TViewport {
  return clampViewport(
    { ...viewport, x: viewport.x + dx, y: viewport.y + dy },
    size,
    limits,
    frame
  );
}

/** Center the frame on a point of the layer given as fractions (0..1) of its width/height. */
export function centerViewportOn(
  viewport: TViewport,
  fraction: TViewportPoint,
  size: TViewportSize,
  limits: TViewportLimits,
  frame: TViewportSize = size
): TViewport {
  return clampViewport(
    {
      scale: viewport.scale,
      x: frame.width / 2 - fraction.x * size.width * viewport.scale,
      y: frame.height / 2 - fraction.y * size.height * viewport.scale,
    },
    size,
    limits,
    frame
  );
}

/** The visible part of the layer as fractions of its width/height. */
export function visibleFraction(
  viewport: TViewport,
  size: TViewportSize,
  frame: TViewportSize = size
) {
  return {
    left: -viewport.x / (viewport.scale * size.width),
    top: -viewport.y / (viewport.scale * size.height),
    width: frame.width / (viewport.scale * size.width),
    height: frame.height / (viewport.scale * size.height),
  };
}

/**
 * The size of the map layer for a frame: the largest of "fits the frame" and "covers the frame"
 * that keeps the map's aspect ratio. In a frame that already has the map's aspect ratio the layer
 * equals the frame; in a taller frame (a phone held upright) it is wider than the frame and the
 * sides are reached by panning.
 */
export function coverLayerSize(frame: TViewportSize, aspect: number): TViewportSize {
  if (frame.width <= 0 || frame.height <= 0 || aspect <= 0) return frame;
  if (frame.width / frame.height < aspect) {
    return { width: frame.height * aspect, height: frame.height };
  }
  return { width: frame.width, height: frame.width / aspect };
}

/** Unzoomed viewport that centres the layer in the frame. */
export function restViewport(size: TViewportSize, frame: TViewportSize): TViewport {
  return {
    scale: 1,
    x: Math.min(0, (frame.width - size.width) / 2),
    y: Math.min(0, (frame.height - size.height) / 2),
  };
}
