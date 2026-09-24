'use client';

import { RefObject, useEffect, useMemo } from 'react';
import { useMapContext } from 'src/contexts/map.context';
import {
  DEFAULT_ELEV_SCALE,
  getIsoBoundingBox,
  isoProjectCellPolygon,
} from 'src/services/rendering/canvas/isometric';
import {
  drawCellShape,
  drawSiteMarker,
  setupCanvas,
} from 'src/services/rendering/canvas/primitives';
import { drawPolygon } from 'src/services/rendering/canvas/shared';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';

type TProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
};

export default function useMapOverlay({ canvasRef }: TProps) {
  const hoverIndex = useMapExplorerStore((s) => s.hoverIndex);
  const displaySettings = useMapExplorerStore((s) => s.displaySettings);
  const { mesh } = useMapContext();
  const { cells } = mesh;
  const isIso = displaySettings.isometric;
  const elevScale = DEFAULT_ELEV_SCALE;

  const isoBbox = useMemo(
    () => (isIso ? getIsoBoundingBox(cells, elevScale) : null),
    [cells, elevScale, isIso]
  );
  const isoCanvasWidth = isoBbox ? Math.ceil(isoBbox.width) : mesh.width || 1200;
  const isoCanvasHeight = isoBbox ? Math.ceil(isoBbox.height) : mesh.height || 760;
  const isoOffsetX = isIso && isoBbox ? -isoBbox.minX : 0;
  const isoOffsetY = isIso && isoBbox ? -isoBbox.minY : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pixelRatio = window.devicePixelRatio || 1;
    const context = setupCanvas(
      canvas,
      !isIso ? mesh.width : isoCanvasWidth,
      !isIso ? mesh.height : isoCanvasHeight,
      pixelRatio
    );
    if (!context) return;

    context.clearRect(
      0,
      0,
      !isIso ? mesh.width : isoCanvasWidth,
      !isIso ? mesh.height : isoCanvasHeight
    );

    const hoveredCell = hoverIndex !== null ? cells[hoverIndex] : null;
    if (!hoveredCell) return;

    if (isIso) {
      const ox = isoOffsetX;
      const oy = isoOffsetY;
      const es = elevScale;
      const isoPoly = isoProjectCellPolygon(hoveredCell.polygon, hoveredCell.elevation, ox, oy, es);
      drawPolygon(context, isoPoly);
      context.fillStyle = 'rgba(56, 189, 248, 0.84)';
      context.fill();
      context.strokeStyle = '#e0f2fe';
      context.lineWidth = 1.5;
      context.stroke();
    } else {
      drawCellShape(context, hoveredCell, '#38bdf8', 0.84, '#e0f2fe', 1.5);
      drawSiteMarker(context, hoveredCell, 2.75, hoveredCell.isWater ? '#dbeafe' : '#fef3c7', 0.95);
    }
  }, [
    canvasRef,
    cells,
    hoverIndex,
    isIso,
    isoCanvasWidth,
    isoCanvasHeight,
    isoOffsetX,
    isoOffsetY,
    elevScale,
    mesh.width,
    mesh.height,
  ]);
}
