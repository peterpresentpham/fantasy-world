'use client';

import { PointerEvent, RefObject, useCallback, useEffect, useRef } from 'react';
import { DRAG_THRESHOLD_PX, WHEEL_ZOOM_SENSITIVITY } from 'src/configs/map/viewport';
import { useViewportStore } from 'src/store/viewportStore';

type TProps = {
  frameRef: RefObject<HTMLElement | null>;
  /** wheel zoom; off in 3D mode where the 3D controls own the wheel */
  zoomEnabled: boolean;
  /** drag pan / pinch; off while a tool owns the pointer (terrain painting) */
  panEnabled: boolean;
};

type TPointer = { x: number; y: number };

/**
 * Wheel zoom, drag pan and two-finger pinch for the map frame. Pointer handlers return `true` when
 * the gesture is a pan/pinch, so the caller can skip hover/paint; `consumeDrag()` tells a click
 * handler that the press it is about to handle was really a drag.
 */
export default function useMapViewport({ frameRef, zoomEnabled, panEnabled }: TProps) {
  const pointers = useRef(new Map<number, TPointer>());
  const startRef = useRef<TPointer | null>(null);
  const gestureRef = useRef(false);
  const draggedRef = useRef(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const publishSize = () => {
      const rect = frame.getBoundingClientRect();
      useViewportStore.getState().setFrameSize({ width: rect.width, height: rect.height });
    };
    publishSize();
    const observer = new ResizeObserver(publishSize);
    observer.observe(frame);

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = frame.getBoundingClientRect();
      const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      useViewportStore.getState().zoomAt(anchor, Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY));
    };
    if (zoomEnabled) frame.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      observer.disconnect();
      frame.removeEventListener('wheel', onWheel);
    };
  }, [frameRef, zoomEnabled]);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!panEnabled) return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      draggedRef.current = false;
      gestureRef.current = false;
      if (pointers.current.size === 1) startRef.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [panEnabled]
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>): boolean => {
      const previous = pointers.current.get(event.pointerId);
      if (!panEnabled || !previous) return false;
      const current = { x: event.clientX, y: event.clientY };
      const store = useViewportStore.getState();
      const frame = frameRef.current;

      if (pointers.current.size >= 2 && frame) {
        const others = [...pointers.current.entries()].filter(([id]) => id !== event.pointerId);
        const other = others[0][1];
        const before = Math.hypot(previous.x - other.x, previous.y - other.y);
        const after = Math.hypot(current.x - other.x, current.y - other.y);
        const rect = frame.getBoundingClientRect();
        const midX = (current.x + other.x) / 2 - rect.left;
        const midY = (current.y + other.y) / 2 - rect.top;
        pointers.current.set(event.pointerId, current);
        gestureRef.current = true;
        draggedRef.current = true;
        if (before > 0 && after > 0) store.zoomAt({ x: midX, y: midY }, after / before);
        store.panBy((current.x - previous.x) / 2, (current.y - previous.y) / 2);
        return true;
      }

      pointers.current.set(event.pointerId, current);
      if (store.viewport.scale <= 1 || (event.buttons & 1) === 0) return false;
      const start = startRef.current;
      if (!gestureRef.current && start) {
        if (Math.hypot(current.x - start.x, current.y - start.y) < DRAG_THRESHOLD_PX) return false;
        gestureRef.current = true;
      }
      if (!gestureRef.current) return false;
      draggedRef.current = true;
      store.panBy(current.x - previous.x, current.y - previous.y);
      return true;
    },
    [frameRef, panEnabled]
  );

  const onPointerEnd = useCallback((event: PointerEvent<HTMLElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) {
      startRef.current = null;
      gestureRef.current = false;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const consumeDrag = useCallback(() => {
    const dragged = draggedRef.current;
    draggedRef.current = false;
    return dragged;
  }, []);

  return { onPointerDown, onPointerMove, onPointerEnd, consumeDrag };
}
