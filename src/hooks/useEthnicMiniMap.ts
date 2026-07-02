'use client';

import { RefObject, useEffect, useMemo } from 'react';
import { BIOME_CONFIG, LANDFORM_CONFIG } from 'src/configs/map/landform-biome';
import {
  MINI_MAP_BIOME_DISPLAY,
  MINI_MAP_TERRAIN_DISPLAY,
} from 'src/configs/map/miniMapDisplayModes';
import { TCell, TDelaunayMesh, TDisplaySettings, TEthnicMiniMapDisplay } from 'src/global';
import { drawPolygon } from 'src/services/rendering/canvas/shared';
import { computeMiniMapBounds, getNationColor } from 'src/services/utils';
import { toEdgeKey } from 'src/services/utils/geometry';

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

  const { ethnicCells, cellColorMap, borderCells } = useMemo(() => {
    const eCells: TCell[] = [];
    const colorMap = new Map<number, string>();
    const bCells: TCell[] = [];

    // First pass: collect ethnic cells
    for (const cell of mesh.cells) {
      if (cell.isWater) continue;
      if (cell.ethnicId === ethnicId) {
        eCells.push(cell);
      }
    }

    // Second pass: find bordering cells (neighbors of ethnic cells that belong to other nations)
    const ethnicCellSet = new Set(eCells.map((c) => c.id));
    for (const cell of mesh.cells) {
      if (cell.isWater || ethnicCellSet.has(cell.id)) continue;
      for (const nbId of cell.neighbors) {
        if (ethnicCellSet.has(nbId)) {
          bCells.push(cell);
          break;
        }
      }
    }

    // Determine colors
    for (const cell of eCells) {
      if (displaySettings.landform) {
        colorMap.set(cell.id, LANDFORM_CONFIG[cell.landform].color);
      } else if (displaySettings.biome) {
        colorMap.set(cell.id, BIOME_CONFIG[cell.biome].color);
      } else if (displaySettings.nationFill) {
        colorMap.set(cell.id, getNationColor(cell.nationId));
      } else {
        colorMap.set(cell.id, '#3f3f46');
      }
    }

    return { ethnicCells: eCells, cellColorMap: colorMap, borderCells: bCells };
  }, [mesh.cells, ethnicId, displaySettings]);

  const { canvasW, canvasH, scale, worldCX, worldCY } = useMemo(() => {
    return computeMiniMapBounds([...ethnicCells, ...borderCells]);
  }, [ethnicCells, borderCells]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasW === 0 || canvasH === 0) return;

    const pixelRatio = window.devicePixelRatio || 1;
    const ctx = (() => {
      canvas.width = canvasW * pixelRatio;
      canvas.height = canvasH * pixelRatio;
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      return context;
    })();
    if (!ctx) return;

    const toCanvas = (px: number, py: number): [number, number] => [
      canvasW / 2 + (px - worldCX) * scale,
      canvasH / 2 + (py - worldCY) * scale,
    ];

    // Background
    ctx.fillStyle = '#09131f';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Draw border cells first
    for (const cell of borderCells) {
      const poly = cell.polygon.map(([px, py]) => toCanvas(px, py));
      drawPolygon(ctx, poly);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
    }

    // Draw ethnic cells
    for (const cell of ethnicCells) {
      const poly = cell.polygon.map(([px, py]) => toCanvas(px, py));
      drawPolygon(ctx, poly);
      ctx.fillStyle = cellColorMap.get(cell.id) ?? '#3f3f46';
      ctx.fill();
    }

    function buildEdgeKeySet(polygon: TCell['polygon']) {
      const keys = new Set<string>();
      for (let i = 0; i < polygon.length; i++) {
        keys.add(toEdgeKey(polygon[i], polygon[(i + 1) % polygon.length], { precision: 3 }));
      }
      return keys;
    }

    // Draw nation borders (only in nation mode)
    if (displaySettings.nationBorders) {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1.2;
      for (const cell of ethnicCells) {
        if (cell.nationId === null) continue;
        for (const nbId of cell.neighbors) {
          const nb = mesh.cells[nbId];
          if (!nb || nb.nationId === cell.nationId) continue;
          const nbEdgeKeys = buildEdgeKeySet(nb.polygon);
          const poly = cell.polygon;
          for (let i = 0; i < poly.length; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % poly.length];
            if (nbEdgeKeys.has(toEdgeKey(a, b, { precision: 3 }))) {
              const [ax, ay] = toCanvas(a[0], a[1]);
              const [bx, by] = toCanvas(b[0], b[1]);
              ctx.beginPath();
              ctx.moveTo(ax, ay);
              ctx.lineTo(bx, by);
              ctx.stroke();
            }
          }
        }
      }
    }

    // Outer ethnic border
    ctx.strokeStyle = 'rgba(255,200,100,0.5)';
    ctx.lineWidth = 1.5;
    for (const cell of ethnicCells) {
      for (const nbId of cell.neighbors) {
        const nb = mesh.cells[nbId];
        if (!nb || nb.ethnicId === ethnicId) continue;
        const nbEdgeKeys = buildEdgeKeySet(nb.polygon);
        const poly = cell.polygon;
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i];
          const b = poly[(i + 1) % poly.length];
          if (nbEdgeKeys.has(toEdgeKey(a, b, { precision: 3 }))) {
            const [ax, ay] = toCanvas(a[0], a[1]);
            const [bx, by] = toCanvas(b[0], b[1]);
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }
        }
      }
    }
  }, [
    canvasRef,
    ethnicCells,
    borderCells,
    cellColorMap,
    canvasW,
    canvasH,
    scale,
    worldCX,
    worldCY,
    displaySettings,
    mesh.cells,
    ethnicId,
  ]);
}
