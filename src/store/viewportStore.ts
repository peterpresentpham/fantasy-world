'use client';

import { MAX_ZOOM, MIN_ZOOM, STEP_ZOOM_FACTOR } from 'src/configs/map/viewport';
import {
  centerViewportOn,
  clampViewport,
  IDENTITY_VIEWPORT,
  panViewport,
  restViewport,
  TViewport,
  TViewportPoint,
  TViewportSize,
  zoomViewportAt,
} from 'src/services/utils/viewport';
import { create } from 'zustand';

const LIMITS = { minScale: MIN_ZOOM, maxScale: MAX_ZOOM };

// Zoom/pan of the map frame. Transient UI state: never persisted.
type TViewportStore = {
  viewport: TViewport;
  /** the visible area */
  frameSize: TViewportSize;
  /** the map layer; larger than the frame when the map covers a tall frame */
  layerSize: TViewportSize;
  /** bumped after every base-canvas render so the minimap can refresh its copy */
  renderTick: number;
  setSizes: (frame: TViewportSize, layer: TViewportSize) => void;
  zoomAt: (anchor: TViewportPoint, factor: number) => void;
  zoomStep: (direction: 1 | -1) => void;
  panBy: (dx: number, dy: number) => void;
  centerOn: (fraction: TViewportPoint) => void;
  /** zoom to `scale` with the point in the middle of the frame */
  focusOn: (fraction: TViewportPoint, scale: number) => void;
  reset: () => void;
  bumpRender: () => void;
};

export const useViewportStore = create<TViewportStore>()((set, get) => ({
  viewport: IDENTITY_VIEWPORT,
  frameSize: { width: 1, height: 1 },
  layerSize: { width: 1, height: 1 },
  renderTick: 0,
  setSizes(frameSize, layerSize) {
    set((s) => ({
      frameSize,
      layerSize,
      viewport:
        s.viewport.scale <= 1
          ? restViewport(layerSize, frameSize)
          : clampViewport(s.viewport, layerSize, LIMITS, frameSize),
    }));
  },
  zoomAt(anchor, factor) {
    const { viewport, frameSize, layerSize } = get();
    set({ viewport: zoomViewportAt(viewport, anchor, factor, layerSize, LIMITS, frameSize) });
  },
  zoomStep(direction) {
    const { frameSize } = get();
    const center = { x: frameSize.width / 2, y: frameSize.height / 2 };
    get().zoomAt(center, direction === 1 ? STEP_ZOOM_FACTOR : 1 / STEP_ZOOM_FACTOR);
  },
  panBy(dx, dy) {
    const { viewport, frameSize, layerSize } = get();
    set({ viewport: panViewport(viewport, dx, dy, layerSize, LIMITS, frameSize) });
  },
  centerOn(fraction) {
    const { viewport, frameSize, layerSize } = get();
    set({ viewport: centerViewportOn(viewport, fraction, layerSize, LIMITS, frameSize) });
  },
  focusOn(fraction, scale) {
    const { frameSize, layerSize } = get();
    set({
      viewport: centerViewportOn({ scale, x: 0, y: 0 }, fraction, layerSize, LIMITS, frameSize),
    });
  },
  reset() {
    const { frameSize, layerSize } = get();
    set({ viewport: restViewport(layerSize, frameSize) });
  },
  bumpRender() {
    set((s) => ({ renderTick: s.renderTick + 1 }));
  },
}));
