'use client';

import { RefObject, useEffect, useMemo } from 'react';
import {
  MINI_MAP_BIOME_DISPLAY,
  MINI_MAP_TERRAIN_DISPLAY,
} from 'src/configs/map/miniMapDisplayModes';
import { TDelaunayMesh, TDisplaySettings, TEthnicMiniMapDisplay } from 'src/types/global';
import {
  drawMiniMap,
  selectEthnicMiniMapCells,
  setupMiniMapCanvas,
} from 'src/services/rendering/miniMap';
import type { TMiniMapBorderRule } from 'src/services/rendering/miniMap';

const DISPLAY_MAP: Record<TEthnicMiniMapDisplay, TDisplaySettings> = {
  terrain: MINI_MAP_TERRAIN_DISPLAY,
  biome: MINI_MAP_BIOME_DISPLAY,
  nation: {
    landform: false,
    biome: false,
    nationFill: true,
    nationBorders: true,
    ethnicFill: false,
    ethnicBorders: false,
    provinceBorders: false,
    population: false,
    temperature: false,
    precipitation: false,
    rainShadow: false,
    economy: false,
    rivers: false,
    labels: false,
    ethnicLabels: false,
    cellData: false,
    landformRelief: false,
    biomeRelief: false,
    isometric: false,
    threeDim: false,
  },
};

type TProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  mesh: TDelaunayMesh;
  ethnicId: number;
  displayMode: TEthnicMiniMapDisplay;
};

export default function useEthnicMiniMap({ canvasRef, mesh, ethnicId, displayMode }: TProps) {
  const displaySettings = DISPLAY_MAP[displayMode];

  const { ethnicCells, cellColorMap, borderCells, bounds } = useMemo(
    () => selectEthnicMiniMapCells(mesh, ethnicId, displaySettings),
    [mesh, ethnicId, displaySettings]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || bounds.canvasW === 0 || bounds.canvasH === 0) return;

    const ctx = setupMiniMapCanvas(canvas, bounds);
    if (!ctx) return;

    const borderRules: TMiniMapBorderRule[] = [];
    if (displaySettings.nationBorders) {
      borderRules.push({
        color: 'rgba(255,255,255,0.4)',
        lineWidth: 1.2,
        cells: ethnicCells,
        shouldDrawEdge: (cell, nb) => cell.nationId !== null && nb.nationId !== cell.nationId,
      });
    }
    // Outer ethnic border
    borderRules.push({
      color: 'rgba(255,200,100,0.5)',
      lineWidth: 1.5,
      cells: ethnicCells,
      shouldDrawEdge: (_cell, nb) => nb.ethnicId !== ethnicId,
    });

    drawMiniMap(
      ctx,
      bounds,
      { backgroundCells: borderCells, foregroundCells: ethnicCells, colorMap: cellColorMap },
      borderRules,
      mesh.cells
    );
  }, [
    canvasRef,
    ethnicCells,
    borderCells,
    cellColorMap,
    bounds,
    displaySettings,
    mesh.cells,
    ethnicId,
  ]);
}
