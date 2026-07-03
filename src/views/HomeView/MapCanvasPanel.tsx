'use client';

import { MouseEvent, useCallback, useRef, useState } from 'react';
import CellDetailDialog from 'src/components/AppDialog/CellDetailDialog';
import { useMapContext } from 'src/contexts/map.context';
import useMapCanvas from 'src/hooks/useMapCanvas';
import useMapOverlay from 'src/hooks/useMapOverlay';
import useThreeMap from 'src/hooks/useThreeMap';
import { getCanvasPoint } from 'src/services/rendering/canvas/primitives';
import { useLogisticsGameStore } from 'src/store/logisticsGameStore';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';
import { useTerrainEditorStore } from 'src/store/terrainEditorStore';

export default function MapCanvasPanel() {
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const threeContainerRef = useRef<HTMLDivElement | null>(null);
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
  const { mesh, isGenerating, handlePointerMove, paintTerrain } = useMapContext();
  const { cells, width, height } = mesh;
  const show2D = !isThree;

  useMapCanvas({ canvasRef: baseCanvasRef });
  useMapOverlay({ canvasRef: overlayCanvasRef });
  useThreeMap({ containerRef: threeContainerRef });

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
            />
            <canvas
              ref={overlayCanvasRef}
              width={width}
              height={height}
              className={`absolute inset-0 h-full w-full ${editMode && selectedLandform ? 'cursor-crosshair' : 'cursor-pointer'}`}
              onPointerMove={(event) => {
                const point = resolveCanvasPoint(event);
                handlePointerMove(point.x, point.y);
                // Drag-to-paint: primary button held
                if (editMode && selectedLandform !== null && event.buttons === 1) {
                  const cellId = mesh.delaunay.find(point.x, point.y);
                  if (cellId >= 0) paintTerrain(cellId, selectedLandform);
                }
              }}
              onPointerLeave={() => {
                setHoverIndex(null);
                setHoverClientPoint(null);
              }}
              onClick={onCanvasPanelClick}
            />
          </>
        )}

        {isThree && (
          <div
            ref={threeContainerRef}
            className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
          />
        )}

        {isGenerating && (
          <div className="fantasy-glass-strong absolute inset-0 z-20 flex items-center justify-center">
            <div className="fantasy-panel px-4 py-2 text-sm">Generating map...</div>
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
