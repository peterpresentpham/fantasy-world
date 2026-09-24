'use client';

import { RefObject, useEffect, useMemo } from 'react';
import {
  MINI_MAP_BIOME_DISPLAY,
  MINI_MAP_TERRAIN_DISPLAY,
} from 'src/configs/map/miniMapDisplayModes';
import { TDelaunayMesh, TDisplaySettings } from 'src/types/global';
import {
  drawMiniMap,
  selectNationMiniMapCells,
  setupMiniMapCanvas,
} from 'src/services/rendering/miniMap';
import type { TMiniMapBorderRule } from 'src/services/rendering/miniMap';

type TNationMiniMapDisplay = 'terrain' | 'biome' | 'nation' | 'ethnic';

const DISPLAY_MAP: Record<TNationMiniMapDisplay, TDisplaySettings> = {
  terrain: MINI_MAP_TERRAIN_DISPLAY,
  biome: MINI_MAP_BIOME_DISPLAY,
  nation: {
    landform: false,
    biome: false,
    nationFill: true,
    nationBorders: false,
    ethnicFill: false,
    ethnicBorders: false,
    provinceBorders: true,
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
  ethnic: {
    landform: false,
    biome: false,
    nationFill: false,
    nationBorders: false,
    ethnicFill: true,
    ethnicBorders: true,
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
  nationId: number;
  displayMode: TNationMiniMapDisplay;
};

export { type TNationMiniMapDisplay };

export default function useNationMiniMap({ canvasRef, mesh, nationId, displayMode }: TProps) {
  const displaySettings = DISPLAY_MAP[displayMode];

  const { nationCells, cellColorMap, bgCells, bounds } = useMemo(
    () => selectNationMiniMapCells(mesh, nationId, displaySettings),
    [mesh, nationId, displaySettings]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || bounds.canvasW === 0 || bounds.canvasH === 0) return;

    const ctx = setupMiniMapCanvas(canvas, bounds);
    if (!ctx) return;

    const borderRules: TMiniMapBorderRule[] = [];
    if (displaySettings.provinceBorders) {
      borderRules.push({
        color: 'rgba(255,255,255,0.35)',
        lineWidth: 1.0,
        cells: nationCells,
        shouldDrawEdge: (cell, nb) =>
          cell.provinceId !== null && nb.nationId === nationId && nb.provinceId !== cell.provinceId,
      });
    }
    if (displaySettings.ethnicBorders) {
      borderRules.push({
        color: 'rgba(255,200,100,0.5)',
        lineWidth: 1.2,
        cells: nationCells,
        shouldDrawEdge: (cell, nb) =>
          cell.ethnicId !== null && nb.nationId === nationId && nb.ethnicId !== cell.ethnicId,
      });
    }
    // Outer nation border
    borderRules.push({
      color: 'rgba(255,255,255,0.5)',
      lineWidth: 1.5,
      cells: nationCells,
      shouldDrawEdge: (_cell, nb) => nb.nationId !== nationId,
    });

    drawMiniMap(
      ctx,
      bounds,
      { backgroundCells: bgCells, foregroundCells: nationCells, colorMap: cellColorMap },
      borderRules,
      mesh.cells
    );
  }, [
    canvasRef,
    nationCells,
    bgCells,
    cellColorMap,
    bounds,
    displaySettings,
    mesh.cells,
    nationId,
  ]);
}
