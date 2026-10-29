'use client';

import { MAX_ZOOM, MIN_ZOOM, STEP_ZOOM_FACTOR } from 'src/configs/map/viewport';
import {
  centerViewportOn,
  clampViewport,
  IDENTITY_VIEWPORT,
  panViewport,
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
  frameSize: TViewportSize;
  /** bumped after every base-canvas render so the minimap can refresh its copy */
  renderTick: number;
  setFrameSize: (size: TViewportSize) => void;
  zoomAt: (anchor: TViewportPoint, factor: number) => void;
  zoomStep: (direction: 1 | -1) => void;
  panBy: (dx: number, dy: number) => void;
  centerOn: (fraction: TViewportPoint) => void;
  reset: () => void;
  bumpRender: () => void;
};

export const useViewportStore = create<TViewportStore>()((set, get) => ({
  viewport: IDENTITY_VIEWPORT,
  frameSize: { width: 1, height: 1 },
  renderTick: 0,
  setFrameSize(frameSize) {
    set((s) => ({ frameSize, viewport: clampViewport(s.viewport, frameSize, LIMITS) }));
  },
  zoomAt(anchor, factor) {
    const { viewport, frameSize } = get();
    set({ viewport: zoomViewportAt(viewport, anchor, factor, frameSize, LIMITS) });
  },
  zoomStep(direction) {
    const { frameSize } = get();
    const center = { x: frameSize.width / 2, y: frameSize.height / 2 };
    get().zoomAt(center, direction === 1 ? STEP_ZOOM_FACTOR : 1 / STEP_ZOOM_FACTOR);
  },
  panBy(dx, dy) {
    const { viewport, frameSize } = get();
    set({ viewport: panViewport(viewport, dx, dy, frameSize, LIMITS) });
  },
  centerOn(fraction) {
    const { viewport, frameSize } = get();
    set({ viewport: centerViewportOn(viewport, fraction, frameSize, LIMITS) });
  },
  reset() {
    set({ viewport: IDENTITY_VIEWPORT });
  },
  bumpRender() {
    set((s) => ({ renderTick: s.renderTick + 1 }));
  },
}));
