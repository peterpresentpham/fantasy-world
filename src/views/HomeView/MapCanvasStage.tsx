'use client';

import { MouseEvent, PointerEvent, useCallback, useEffect, useRef } from 'react';
import { useMapContext } from 'src/contexts/map.context';
import useMapCanvas from 'src/hooks/useMapCanvas';
import type useMapViewport from 'src/hooks/useMapViewport';
import useMapOverlay from 'src/hooks/useMapOverlay';
import { getCanvasPoint } from 'src/services/rendering/canvas/primitives';
import { useLogisticsGameStore } from 'src/store/logisticsGameStore';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';
import { useTerrainEditorStore } from 'src/store/terrainEditorStore';
import { useUiStore } from 'src/store/uiStore';
import { useViewportStore } from 'src/store/viewportStore';
import { useShallow } from 'zustand/react/shallow';

type TProps = {
  pan: ReturnType<typeof useMapViewport>;
};

type TPending = { x: number; y: number; clientX: number; clientY: number; buttons: number };

export default function MapCanvasStage({ pan }: TProps) {
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const setHoverIndex = useMapExplorerStore((s) => s.setHoverIndex);
  const setHoverClientPoint = useMapExplorerStore((s) => s.setHoverClientPoint);
  const openDetail = useUiStore((s) => s.openDetail);
  const viewport = useViewportStore((s) => s.viewport);
  const {
    enabled: logisticsEnabled,
    handleMapCellClick,
    recalculateRoute,
  } = useLogisticsGameStore(
    useShallow((s) => ({
      enabled: s.enabled,
      handleMapCellClick: s.handleMapCellClick,
      recalculateRoute: s.recalculateRoute,
    }))
  );
  const { editMode, selectedLandform } = useTerrainEditorStore(
    useShallow((s) => ({ editMode: s.editMode, selectedLandform: s.selectedLandform }))
  );
  const { mesh, paintTerrain } = useMapContext();
  const { cells, width, height } = mesh;

  useMapCanvas({ canvasRef: baseCanvasRef });
  useMapOverlay({ canvasRef: overlayCanvasRef });

  // Coalesce pointermove processing to once per animation frame instead of
  // running a delaunay lookup + state update on every raw browser event.
  const pendingRef = useRef<TPending | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const flushPointerMove = useCallback(() => {
    rafIdRef.current = null;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending || cells.length === 0) return;

    const cellId = mesh.delaunay.find(pending.x, pending.y);
    setHoverIndex(cellId);
    setHoverClientPoint({ x: pending.clientX, y: pending.clientY });

    if (editMode && selectedLandform !== null && pending.buttons === 1 && cellId >= 0) {
      paintTerrain(cellId, selectedLandform);
    }
  }, [
    cells.length,
    mesh.delaunay,
    setHoverIndex,
    setHoverClientPoint,
    editMode,
    selectedLandform,
    paintTerrain,
  ]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) window.cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const clearHover = useCallback(() => {
    pendingRef.current = null;
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setHoverIndex(null);
    setHoverClientPoint(null);
  }, [setHoverClientPoint, setHoverIndex]);

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (pan.onPointerMove(event)) {
        clearHover();
        return;
      }
      const point = getCanvasPoint(event, width, height);
      pendingRef.current = {
        ...point,
        clientX: event.clientX,
        clientY: event.clientY,
        buttons: event.buttons,
      };
      if (rafIdRef.current === null) {
        rafIdRef.current = window.requestAnimationFrame(flushPointerMove);
      }
    },
    [clearHover, flushPointerMove, height, pan, width]
  );

  const onClick = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      if (pan.consumeDrag()) return;
      const point = getCanvasPoint(event, width, height);
      const clickedId = mesh.delaunay.find(point.x, point.y);
      if (clickedId < 0) return;

      // Terrain edit mode takes priority
      if (editMode && selectedLandform !== null) {
        paintTerrain(clickedId, selectedLandform);
        return;
      }

      const clickedCell = cells[clickedId];
      if (!clickedCell || clickedCell.isWater) return;

      if (logisticsEnabled) {
        handleMapCellClick(clickedId);
        queueMicrotask(() => recalculateRoute(mesh));
        return;
      }

      const nationId = clickedCell.nationId ?? null;
      const ethnicId = clickedCell.ethnicId ?? null;
      if (nationId === null && ethnicId === null) return;
      openDetail(nationId, ethnicId);
    },
    [
      cells,
      editMode,
      handleMapCellClick,
      height,
      logisticsEnabled,
      mesh,
      openDetail,
      paintTerrain,
      pan,
      recalculateRoute,
      selectedLandform,
      width,
    ]
  );

  return (
    <div
      className="absolute inset-0 origin-top-left"
      style={{
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
      }}
    >
      <canvas
        id="map-base-canvas"
        ref={baseCanvasRef}
        width={width}
        height={height}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      />
      <canvas
        ref={overlayCanvasRef}
        width={width}
        height={height}
        className={`absolute inset-0 h-full w-full touch-none ${editMode && selectedLandform ? 'cursor-crosshair' : viewport.scale > 1 ? 'cursor-grab' : 'cursor-pointer'}`}
        role="img"
        aria-describedby="map-hover-description"
        aria-label="Interactive fantasy world map. Click a cell to view its nation or ethnic group details."
        onPointerDown={pan.onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={pan.onPointerEnd}
        onPointerCancel={pan.onPointerEnd}
        onPointerLeave={clearHover}
        onClick={onClick}
      />
    </div>
  );
}
