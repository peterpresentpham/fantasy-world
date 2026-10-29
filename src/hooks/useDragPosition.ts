'use client';

import { PointerEvent, RefObject, useCallback, useEffect, useRef } from 'react';
import {
  clampPosition,
  isSamePosition,
  TFloatingPosition,
} from 'src/services/utils/floatingPosition';

type TProps = {
  elementRef: RefObject<HTMLElement | null>;
  position: TFloatingPosition | null;
  onChange: (position: TFloatingPosition) => void;
};

type TDrag = { pointerId: number; offsetX: number; offsetY: number };

/**
 * Drag handle behaviour for an absolutely positioned element. Positions are pixels relative to the
 * element's offset parent and are always clamped inside it, also when the parent or the element
 * resizes (window resize, toolbar collapse).
 */
export default function useDragPosition({ elementRef, position, onChange }: TProps) {
  const dragRef = useRef<TDrag | null>(null);

  const measure = useCallback(() => {
    const element = elementRef.current;
    const parent = element?.offsetParent;
    if (!element || !(parent instanceof HTMLElement)) return null;
    return {
      element,
      parent,
      elementSize: { width: element.offsetWidth, height: element.offsetHeight },
      parentSize: { width: parent.clientWidth, height: parent.clientHeight },
    };
  }, [elementRef]);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const measured = measure();
      if (!measured) return;
      const rect = measured.element.getBoundingClientRect();
      dragRef.current = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [measure]
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      const measured = measure();
      if (!drag || drag.pointerId !== event.pointerId || !measured) return;
      const parentRect = measured.parent.getBoundingClientRect();
      onChange(
        clampPosition(
          {
            x: event.clientX - drag.offsetX - parentRect.left,
            y: event.clientY - drag.offsetY - parentRect.top,
          },
          measured.elementSize,
          measured.parentSize
        )
      );
    },
    [measure, onChange]
  );

  const endDrag = useCallback((event: PointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !position) return;

    function reclamp() {
      const measured = measure();
      if (!measured || !position) return;
      const next = clampPosition(position, measured.elementSize, measured.parentSize);
      if (!isSamePosition(next, position)) onChange(next);
    }

    reclamp();
    const observer = new ResizeObserver(reclamp);
    observer.observe(element);
    window.addEventListener('resize', reclamp);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', reclamp);
    };
  }, [elementRef, measure, onChange, position]);

  return { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag };
}
