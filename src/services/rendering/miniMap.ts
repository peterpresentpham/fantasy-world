import { NATION_COLORS } from 'src/configs/map/common';
import { BIOME_CONFIG, LANDFORM_CONFIG } from 'src/configs/map/landform-biome';
import { TCell, TDelaunayMesh, TDisplaySettings } from 'src/types/global';
import { computeMiniMapBounds, getNationColor } from 'src/services/utils';
import { toEdgeKey } from 'src/services/utils/geometry';
import { drawPolygon } from './canvas/shared';

export type TMiniMapBounds = ReturnType<typeof computeMiniMapBounds>;

export type TMiniMapLayers = {
  backgroundCells: TCell[];
  foregroundCells: TCell[];
  colorMap: Map<number, string>;
};

export type TMiniMapBorderRule = {
  color: string;
  lineWidth: number;
  cells: TCell[];
  /** Whether to stroke the shared edge between `cell` and `neighbor`. */
  shouldDrawEdge: (cell: TCell, neighbor: TCell) => boolean;
};

function buildEdgeKeySet(polygon: TCell['polygon']): Set<string> {
  const keys = new Set<string>();
  for (let i = 0; i < polygon.length; i++) {
    keys.add(toEdgeKey(polygon[i], polygon[(i + 1) % polygon.length], { precision: 3 }));
  }
  return keys;
}

export function setupMiniMapCanvas(
  canvas: HTMLCanvasElement,
  bounds: TMiniMapBounds
): CanvasRenderingContext2D | null {
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = bounds.canvasW * pixelRatio;
  canvas.height = bounds.canvasH * pixelRatio;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  return context;
}

/**
 * Draws a nation/ethnic mini-map: background fill, bordering (context) cells,
 * the region's own cells colored by `colorMap`, then a series of border
 * rules stroked in order (e.g. subdivision borders under the outer border).
 */
export function drawMiniMap(
  ctx: CanvasRenderingContext2D,
  bounds: TMiniMapBounds,
  layers: TMiniMapLayers,
  borderRules: TMiniMapBorderRule[],
  cells: TCell[]
) {
  const { canvasW, canvasH, scale, worldCX, worldCY } = bounds;
  const toCanvas = (px: number, py: number): [number, number] => [
    canvasW / 2 + (px - worldCX) * scale,
    canvasH / 2 + (py - worldCY) * scale,
  ];

  ctx.fillStyle = '#09131f';
  ctx.fillRect(0, 0, canvasW, canvasH);

  for (const cell of layers.backgroundCells) {
    const poly = cell.polygon.map(([px, py]) => toCanvas(px, py));
    drawPolygon(ctx, poly);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
  }

  for (const cell of layers.foregroundCells) {
    const poly = cell.polygon.map(([px, py]) => toCanvas(px, py));
    drawPolygon(ctx, poly);
    ctx.fillStyle = layers.colorMap.get(cell.id) ?? '#3f3f46';
    ctx.fill();
  }

  for (const rule of borderRules) {
    ctx.strokeStyle = rule.color;
    ctx.lineWidth = rule.lineWidth;
    for (const cell of rule.cells) {
      for (const nbId of cell.neighbors) {
        const nb = cells[nbId];
        if (!nb || !rule.shouldDrawEdge(cell, nb)) continue;
        const nbEdgeKeys = buildEdgeKeySet(nb.polygon);
        const poly = cell.polygon;
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i];
          const b = poly[(i + 1) % poly.length];
          if (!nbEdgeKeys.has(toEdgeKey(a, b, { precision: 3 }))) continue;
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

export function selectNationMiniMapCells(
  mesh: TDelaunayMesh,
  nationId: number,
  displaySettings: TDisplaySettings
) {
  const nationCells: TCell[] = [];
  const colorMap = new Map<number, string>();
  const bgCells: TCell[] = [];

  for (const cell of mesh.cells) {
    if (cell.isWater) continue;

    if (cell.nationId === nationId) {
      nationCells.push(cell);
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
          bgCells.push(cell);
          break;
        }
      }
    }
  }

  return {
    nationCells,
    cellColorMap: colorMap,
    bgCells,
    bounds: computeMiniMapBounds([...nationCells, ...bgCells]),
  };
}

export function selectEthnicMiniMapCells(
  mesh: TDelaunayMesh,
  ethnicId: number,
  displaySettings: TDisplaySettings
) {
  const ethnicCells: TCell[] = [];
  const colorMap = new Map<number, string>();
  const borderCells: TCell[] = [];

  // First pass: collect ethnic cells
  for (const cell of mesh.cells) {
    if (cell.isWater) continue;
    if (cell.ethnicId === ethnicId) {
      ethnicCells.push(cell);
    }
  }

  // Second pass: find bordering cells (neighbors of ethnic cells that belong to other nations)
  const ethnicCellSet = new Set(ethnicCells.map((c) => c.id));
  for (const cell of mesh.cells) {
    if (cell.isWater || ethnicCellSet.has(cell.id)) continue;
    for (const nbId of cell.neighbors) {
      if (ethnicCellSet.has(nbId)) {
        borderCells.push(cell);
        break;
      }
    }
  }

  // Determine colors
  for (const cell of ethnicCells) {
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

  return {
    ethnicCells,
    cellColorMap: colorMap,
    borderCells,
    bounds: computeMiniMapBounds([...ethnicCells, ...borderCells]),
  };
}
