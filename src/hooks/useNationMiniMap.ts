'use client';

import { RefObject, useEffect, useMemo } from 'react';
import { NATION_COLORS } from 'src/configs/map/common';
import { BIOME_CONFIG, LANDFORM_CONFIG } from 'src/configs/map/landform-biome';
import {
  MINI_MAP_BIOME_DISPLAY,
  MINI_MAP_TERRAIN_DISPLAY,
} from 'src/configs/map/miniMapDisplayModes';
import { TCell, TDelaunayMesh, TDisplaySettings } from 'src/global';
import { drawPolygon } from 'src/services/rendering/canvas/shared';
import { computeMiniMapBounds, getNationColor } from 'src/services/utils';
import { toEdgeKey } from 'src/services/utils/geometry';

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

  const { nationCells, cellColorMap, bgCells } = useMemo(() => {
    const nCells: TCell[] = [];
    const colorMap = new Map<number, string>();
    const bCells: TCell[] = [];

    for (const cell of mesh.cells) {
      if (cell.isWater) continue;

      if (cell.nationId === nationId) {
        nCells.push(cell);
        if (displaySettings.landform) {
          colorMap.set(cell.id, LANDFORM_CONFIG[cell.landform].color);
        } else if (displaySettings.biome) {
          colorMap.set(cell.id, BIOME_CONFIG[cell.biome].color);
        } else if (displaySettings.nationFill) {
          // Each province gets a distinct color from NATION_COLORS
          const pId = cell.provinceId ?? 0;
          colorMap.set(cell.id, NATION_COLORS[Math.abs(pId) % NATION_COLORS.length]);
        } else if (displaySettings.ethnicFill) {
          colorMap.set(cell.id, getNationColor(cell.ethnicId ?? 0));
        } else {
          colorMap.set(cell.id, '#3f3f46');
        }
      } else {
        for (const nbId of cell.neighbors) {
          const nb = mesh.cells[nbId];
          if (nb && nb.nationId === nationId) {
            bCells.push(cell);
            break;
          }
        }
      }
    }

    return { nationCells: nCells, cellColorMap: colorMap, bgCells: bCells };
  }, [mesh.cells, nationId, displaySettings]);

  const { canvasW, canvasH, scale, worldCX, worldCY } = useMemo(() => {
    return computeMiniMapBounds([...nationCells, ...bgCells]);
  }, [nationCells, bgCells]);

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

    // Draw background (bordering) cells first
    for (const cell of bgCells) {
      const poly = cell.polygon.map(([px, py]) => toCanvas(px, py));
      drawPolygon(ctx, poly);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
    }

    // Draw nation cells — fill only, no cell borders
    for (const cell of nationCells) {
      const poly = cell.polygon.map(([px, py]) => toCanvas(px, py));
      drawPolygon(ctx, poly);
      ctx.fillStyle = cellColorMap.get(cell.id) ?? '#3f3f46';
      ctx.fill();
    }

    // --- Draw borders based on display mode ---

    function buildEdgeKeySet(polygon: TCell['polygon']) {
      const keys = new Set<string>();
      for (let i = 0; i < polygon.length; i++) {
        keys.add(toEdgeKey(polygon[i], polygon[(i + 1) % polygon.length], { precision: 3 }));
      }
      return keys;
    }

    if (displaySettings.provinceBorders) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.0;
      for (const cell of nationCells) {
        if (cell.provinceId === null) continue;
        for (const nbId of cell.neighbors) {
          const nb = mesh.cells[nbId];
          if (!nb || nb.nationId !== nationId || nb.provinceId === cell.provinceId) continue;
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

    if (displaySettings.ethnicBorders) {
      ctx.strokeStyle = 'rgba(255,200,100,0.5)';
      ctx.lineWidth = 1.2;
      for (const cell of nationCells) {
        if (cell.ethnicId === null) continue;
        for (const nbId of cell.neighbors) {
          const nb = mesh.cells[nbId];
          if (!nb || nb.nationId !== nationId || nb.ethnicId === cell.ethnicId) continue;
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

    // Outer nation border
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    for (const cell of nationCells) {
      for (const nbId of cell.neighbors) {
        const nb = mesh.cells[nbId];
        if (!nb || nb.nationId === nationId) continue;
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
    nationCells,
    bgCells,
    cellColorMap,
    canvasW,
    canvasH,
    scale,
    worldCX,
    worldCY,
    displaySettings,
    mesh.cells,
    nationId,
  ]);
}
