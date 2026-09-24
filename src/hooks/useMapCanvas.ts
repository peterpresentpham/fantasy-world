'use client';

import { RefObject, useEffect, useMemo } from 'react';
import { useMapContext } from 'src/contexts/map.context';
import { renderIsometric, renderTopDown } from 'src/services/rendering';
import { createLayerPlan } from 'src/services/rendering/canvas';
import { isLandCell } from 'src/services/rendering/canvas/borders';
import {
  DEFAULT_ELEV_SCALE,
  getIsoCanvasDims,
  sortByDepth,
} from 'src/services/rendering/canvas/isometric';
import { setupCanvas } from 'src/services/rendering/canvas/primitives';
import { computeCellStats } from 'src/services/rendering/canvas/stats';
import { useLogisticsGameStore } from 'src/store/logisticsGameStore';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';

type TProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
};

export default function useMapCanvas({ canvasRef }: TProps) {
  const displaySettings = useMapExplorerStore((s) => s.displaySettings);
  const seaLevel = useMapExplorerStore((s) => s.seaLevel);
  const {
    enabled: logisticsEnabled,
    startCellId,
    goalCellId,
    routeCellIds,
  } = useLogisticsGameStore();
  const { mesh, paintVersion } = useMapContext();
  const { cells, width, height, nations, ethnics } = mesh;
  const isIso = displaySettings.isometric;
  const isThree = displaySettings.threeDim;
  const elevScale = DEFAULT_ELEV_SCALE;

  // `cells` keeps the same array reference across terrain-paint strokes
  // (cells are mutated in place) — paintVersion is an intentional extra dep
  // that forces these to recompute when painted content changes, without
  // copying the whole cells array on every stroke.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const waterCells = useMemo(() => cells.filter((c) => !isLandCell(c)), [cells, paintVersion]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const landCells = useMemo(() => cells.filter((c) => isLandCell(c)), [cells, paintVersion]);

  const layerPlan = useMemo(
    () => createLayerPlan(displaySettings, cells.length),
    [cells.length, displaySettings]
  );

  const isoDims = useMemo(
    () => getIsoCanvasDims(cells, elevScale, isIso),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cells, elevScale, isIso, paintVersion]
  );

  const sortedLandCells = useMemo(
    () => (isIso ? sortByDepth(landCells) : landCells),
    [landCells, isIso]
  );
  const sortedWaterCells = useMemo(
    () => (isIso ? sortByDepth(waterCells) : waterCells),
    [waterCells, isIso]
  );

  const mapCellStats = useMemo(
    () => computeCellStats(displaySettings, landCells),
    [displaySettings, landCells]
  );

  useEffect(() => {
    // Three.js mode → clear base canvas and bail
    if (isThree) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, width, height);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasW = isIso && isoDims ? isoDims.width : width;
    const canvasH = isIso && isoDims ? isoDims.height : height;
    const pixelRatio = window.devicePixelRatio || 1;
    const ctx = setupCanvas(canvas, canvasW, canvasH, pixelRatio);
    if (!ctx) return;

    if (isIso && isoDims) {
      renderIsometric(ctx, canvasW, canvasH, isoDims, elevScale, {
        sortedWaterCells,
        sortedLandCells,
        displaySettings,
        mapCellStats,
        cells,
        landCells,
        nations,
        ethnics,
        logisticsEnabled,
        routeCellIds,
        startCellId,
        goalCellId,
      });
    } else {
      renderTopDown(ctx, width, height, {
        waterCells,
        landCells,
        displaySettings,
        layerPlan,
        mapCellStats,
        cells,
        nations,
        ethnics,
        logisticsEnabled,
        routeCellIds,
        startCellId,
        goalCellId,
        seaLevel,
      });
    }
  }, [
    canvasRef,
    cells,
    displaySettings,
    ethnics,
    goalCellId,
    height,
    width,
    isIso,
    isThree,
    isoDims,
    elevScale,
    logisticsEnabled,
    nations,
    routeCellIds,
    startCellId,
    landCells,
    waterCells,
    sortedLandCells,
    sortedWaterCells,
    layerPlan,
    mapCellStats,
    seaLevel,
  ]);
}
