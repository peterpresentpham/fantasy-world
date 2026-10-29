'use client';

import { PointerEvent, useEffect, useRef } from 'react';
import { visibleFraction } from 'src/services/utils/viewport';
import { useViewportStore } from 'src/store/viewportStore';

const MINIMAP_WIDTH = 176;

export default function MapViewportMinimap() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewport = useViewportStore((s) => s.viewport);
  const frameSize = useViewportStore((s) => s.frameSize);
  const renderTick = useViewportStore((s) => s.renderTick);
  const centerOn = useViewportStore((s) => s.centerOn);
  const height = Math.round((MINIMAP_WIDTH * frameSize.height) / Math.max(1, frameSize.width));
  const view = visibleFraction(viewport, frameSize);

  // Copy of the already rendered base canvas, refreshed whenever it is redrawn.
  useEffect(() => {
    const canvas = canvasRef.current;
    const source = document.getElementById('map-base-canvas');
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !(source instanceof HTMLCanvasElement)) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
  }, [renderTick, height]);

  function jumpTo(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    centerOn({
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    });
  }

  return (
    <div
      role="img"
      aria-label="Map overview. Click or drag to move the view."
      className="fantasy-glass-strong pointer-events-auto relative cursor-pointer touch-none overflow-hidden rounded-lg p-0"
      style={{ width: MINIMAP_WIDTH, height }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        jumpTo(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons & 1) jumpTo(event);
      }}
    >
      <canvas
        ref={canvasRef}
        width={MINIMAP_WIDTH}
        height={height}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      />
      <div
        className="border-accent bg-accent/10 pointer-events-none absolute border"
        style={{
          left: `${view.left * 100}%`,
          top: `${view.top * 100}%`,
          width: `${view.width * 100}%`,
          height: `${view.height * 100}%`,
        }}
      />
    </div>
  );
}
