'use client';

import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import CellDetailDialog from 'src/components/AppDialog/CellDetailDialog';
import { useMapContext } from 'src/contexts/map.context';
import useMapCanvas from 'src/hooks/useMapCanvas';
import useMapOverlay from 'src/hooks/useMapOverlay';
import { getCanvasPoint } from 'src/services/rendering/canvas/primitives';
import { useLogisticsGameStore } from 'src/store/logisticsGameStore';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';
import { useTerrainEditorStore } from 'src/store/terrainEditorStore';

// three.js (~600KB+) is only needed when 3D mode is actually toggled on —
// loading it dynamically keeps it out of the initial page bundle.
const ThreeMapView = dynamic(() => import('./ThreeMapView'), { ssr: false });

export default function MapCanvasPanel() {
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedNationId, setSelectedNationId] = useState<number | null>(null);
  const [selectedEthnicId, setSelectedEthnicId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const setHoverIndex = useMapExplorerStore((s) => s.setHoverIndex);
  const setHoverClientPoint = useMapExplorerStore((s) => s.setHoverClientPoint);
  const isIso = useMapExplorerStore((s) => s.displaySettings.isometric);
  const isThree = useMapExplorerStore((s) => s.displaySettings.threeDim);
  const {
    enabled: logisticsEnabled,
    handleMapCellClick,
    recalculateRoute,
  } = useLogisticsGameStore();
  const { editMode, selectedLandform } = useTerrainEditorStore();
  const { mesh, isGenerating, paintTerrain } = useMapContext();
  const { cells, width, height } = mesh;
  const show2D = !isThree;

  useMapCanvas({ canvasRef: baseCanvasRef });
  useMapOverlay({ canvasRef: overlayCanvasRef });

  const resolveCanvasPoint = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      const point = getCanvasPoint(event, width, height);
      if (isIso) {
        return { x: point.x, y: point.y };
      }
      return point;
    },
    [width, height, isIso]
  );

  // Coalesce pointermove processing to once per animation frame instead of
  // running a delaunay lookup + state update on every raw browser event.
  const pendingPointRef = useRef<{ x: number; y: number; buttons: number } | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const flushPointerMove = useCallback(() => {
    rafIdRef.current = null;
    const pending = pendingPointRef.current;
    pendingPointRef.current = null;
    if (!pending || cells.length === 0) return;

    const cellId = mesh.delaunay.find(pending.x, pending.y);
    setHoverIndex(cellId);

    if (editMode && selectedLandform !== null && pending.buttons === 1 && cellId >= 0) {
      paintTerrain(cellId, selectedLandform);
    }
  }, [cells.length, mesh.delaunay, setHoverIndex, editMode, selectedLandform, paintTerrain]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) window.cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const onOverlayPointerMove = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      const point = resolveCanvasPoint(event);
      pendingPointRef.current = { x: point.x, y: point.y, buttons: event.buttons };
      if (rafIdRef.current === null) {
        rafIdRef.current = window.requestAnimationFrame(flushPointerMove);
      }
    },
    [resolveCanvasPoint, flushPointerMove]
  );

  const onCanvasPanelClick = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      const point = resolveCanvasPoint(event);
      const clickedId = mesh.delaunay.find(point.x, point.y);
      if (clickedId < 0) return;

      // Terrain edit mode takes priority
      if (editMode && selectedLandform !== null) {
        paintTerrain(clickedId, selectedLandform);
        return;
      }

      if (cells[clickedId]?.isWater) return;
      const clickedCell = cells[clickedId];
      if (!clickedCell) return;

      if (logisticsEnabled) {
        handleMapCellClick(clickedId);
        queueMicrotask(() => {
          recalculateRoute(mesh);
        });
        return;
      }

      const nationId = clickedCell.nationId ?? null;
      const ethnicId = clickedCell.ethnicId ?? null;
      if (nationId === null && ethnicId === null) return;
      setSelectedNationId(nationId);
      setSelectedEthnicId(ethnicId);
      setDialogOpen(true);
    },
    [
      resolveCanvasPoint,
      mesh,
      cells,
      editMode,
      selectedLandform,
      paintTerrain,
      logisticsEnabled,
      handleMapCellClick,
      recalculateRoute,
      setSelectedNationId,
      setSelectedEthnicId,
      setDialogOpen,
    ]
  );

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden p-2 sm:p-0">
      <div
        className="relative max-h-full w-full max-w-full"
        style={{
          aspectRatio: show2D ? `${width}/${height}` : undefined,
          minHeight: show2D ? undefined : '80vh',
        }}
      >
        {show2D && (
          <>
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
              className={`absolute inset-0 h-full w-full ${editMode && selectedLandform ? 'cursor-crosshair' : 'cursor-pointer'}`}
              role="img"
              aria-label="Interactive fantasy world map. Click a cell to view its nation or ethnic group details."
              onPointerMove={onOverlayPointerMove}
              onPointerLeave={() => {
                pendingPointRef.current = null;
                if (rafIdRef.current !== null) {
                  window.cancelAnimationFrame(rafIdRef.current);
                  rafIdRef.current = null;
                }
                setHoverIndex(null);
                setHoverClientPoint(null);
              }}
              onClick={onCanvasPanelClick}
            />
          </>
        )}

        {isThree && <ThreeMapView />}

        {isGenerating && (
          <div
            role="status"
            aria-live="polite"
            className="fantasy-glass-strong absolute inset-0 z-20 flex items-center justify-center"
          >
            <div className="fantasy-panel flex items-center gap-2 px-4 py-2 text-sm">
              <Loader2 className="fantasy-text-gold size-4 animate-spin" aria-hidden="true" />
              <span>Generating map&hellip;</span>
            </div>
          </div>
        )}
      </div>
      <CellDetailDialog
        open={dialogOpen}
        onOpenAction={setDialogOpen}
        nationId={selectedNationId}
        ethnicId={selectedEthnicId}
        mesh={mesh}
      />
    </div>
  );
}
