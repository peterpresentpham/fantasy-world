import { TCell, TPoint } from 'src/global';
import { getNationColor } from 'src/services/utils';
import { toEdgeKey } from 'src/services/utils/geometry';
import { drawPolygon, edgeNoiseValue } from './shared';

type TEdgeOwner = { start: TPoint; end: TPoint; cell: TCell };

export function isLandCell(cell: TCell) {
  return !cell.isWater && !cell.isLake;
}

function fillLandCells(
  context: CanvasRenderingContext2D,
  cells: TCell[],
  fillOpacity: number,
  getFillColor: (cell: TCell) => string
) {
  for (const cell of cells) {
    if (!isLandCell(cell)) continue;
    drawPolygon(context, cell.polygon);
    context.fillStyle = getFillColor(cell);
    context.globalAlpha = fillOpacity;
    context.fill();
    context.globalAlpha = 1;
  }
}

export function drawCountryFill(context: CanvasRenderingContext2D, cells: TCell[]) {
  fillLandCells(context, cells, 0.86, (cell) => getNationColor(cell.nationId));
}

export function drawEthnicFill(
  context: CanvasRenderingContext2D,
  cells: TCell[],
  showTerrain: boolean
) {
  fillLandCells(context, cells, showTerrain ? 0.3 : 0.86, (cell) => getNationColor(cell.ethnicId));
}

function drawNaturalBorderSegment(
  context: CanvasRenderingContext2D,
  start: TPoint,
  end: TPoint,
  edgeKey: string
) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  if (length < 0.0001) return;

  const nx = -dy / length;
  const ny = dx / length;
  const amplitudeBase = Math.min(8.5, Math.max(1.6, length * 0.2));
  const wobbleA = (edgeNoiseValue(edgeKey, 0x9e3779b9) - 0.5) * 2;
  const wobbleB = (edgeNoiseValue(edgeKey, 0x85ebca6b) - 0.5) * 2;
  const cp1Amplitude = amplitudeBase * wobbleA;
  const cp2Amplitude = amplitudeBase * wobbleB;

  const cp1: TPoint = [
    start[0] + dx * 0.33 + nx * cp1Amplitude,
    start[1] + dy * 0.33 + ny * cp1Amplitude,
  ];
  const cp2: TPoint = [
    start[0] + dx * 0.66 + nx * cp2Amplitude,
    start[1] + dy * 0.66 + ny * cp2Amplitude,
  ];

  context.beginPath();
  context.moveTo(start[0], start[1]);
  context.bezierCurveTo(cp1[0], cp1[1], cp2[0], cp2[1], end[0], end[1]);
}

function shouldDrawNationBorder(cellA: TCell, cellB: TCell) {
  if (!isLandCell(cellA) || !isLandCell(cellB)) return false;
  if (cellA.nationId === null || cellB.nationId === null) return false;
  return cellA.nationId !== cellB.nationId;
}

function shouldDrawEthnicBorder(cellA: TCell, cellB: TCell) {
  if (!isLandCell(cellA) || !isLandCell(cellB)) return false;
  if (cellA.ethnicId === null || cellB.ethnicId === null) return false;
  return cellA.ethnicId !== cellB.ethnicId;
}

function forEachBorderEdge(
  cells: TCell[],
  shouldDraw: (leftCell: TCell, rightCell: TCell) => boolean,
  onDraw: (contextEdge: { start: TPoint; end: TPoint; edgeKey: string }) => void
) {
  const edgeOwner = new Map<string, TEdgeOwner>();

  for (const cell of cells) {
    if (cell.polygon.length < 2) continue;

    for (let index = 0; index < cell.polygon.length; index += 1) {
      const start = cell.polygon[index];
      const end = cell.polygon[(index + 1) % cell.polygon.length];
      const edgeKey = toEdgeKey(start, end, { precision: 3 });
      const existing = edgeOwner.get(edgeKey);

      if (!existing) {
        edgeOwner.set(edgeKey, { start, end, cell });
        continue;
      }

      if (!shouldDraw(existing.cell, cell)) continue;
      onDraw({ start: existing.start, end: existing.end, edgeKey });
    }
  }
}

function strokeNaturalBorder(
  context: CanvasRenderingContext2D,
  start: TPoint,
  end: TPoint,
  edgeKey: string
) {
  drawNaturalBorderSegment(context, start, end, edgeKey);
  context.strokeStyle = '#1f2937';
  context.lineWidth = 1;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.globalAlpha = 0.98;
  context.stroke();
  context.globalAlpha = 1;
}

export function drawBordersUnified(
  context: CanvasRenderingContext2D,
  cells: TCell[],
  flags: { nation: boolean; ethnic: boolean; province: boolean }
) {
  const edgeOwner = new Map<string, TEdgeOwner>();

  for (const cell of cells) {
    if (cell.polygon.length < 2) continue;
    for (let index = 0; index < cell.polygon.length; index += 1) {
      const start = cell.polygon[index];
      const end = cell.polygon[(index + 1) % cell.polygon.length];
      const edgeKey = toEdgeKey(start, end, { precision: 3 });
      const existing = edgeOwner.get(edgeKey);
      if (!existing) {
        edgeOwner.set(edgeKey, { start, end, cell });
        continue;
      }
      if (flags.nation && shouldDrawNationBorder(existing.cell, cell)) {
        strokeNaturalBorder(context, existing.start, existing.end, edgeKey);
      }
      if (flags.ethnic && shouldDrawEthnicBorder(existing.cell, cell)) {
        strokeNaturalBorder(context, existing.start, existing.end, edgeKey);
      }
      if (flags.province) {
        const lc = existing.cell;
        const rc = cell;
        if (
          isLandCell(lc) &&
          isLandCell(rc) &&
          lc.nationId !== null &&
          rc.nationId !== null &&
          lc.nationId === rc.nationId &&
          lc.provinceId !== null &&
          rc.provinceId !== null &&
          lc.provinceId !== rc.provinceId
        ) {
          context.beginPath();
          context.moveTo(existing.start[0], existing.start[1]);
          context.lineTo(existing.end[0], existing.end[1]);
          context.strokeStyle = '#1f2937';
          context.lineWidth = 0.5;
          context.setLineDash([3, 3]);
          context.globalAlpha = 1;
          context.shadowColor = '#030712';
          context.shadowBlur = 2.2;
          context.stroke();
          context.shadowBlur = 0;
          context.setLineDash([]);
          context.globalAlpha = 1;
        }
      }
    }
  }
}

export function drawGrayBorders(context: CanvasRenderingContext2D, cells: TCell[]) {
  forEachBorderEdge(cells, shouldDrawNationBorder, ({ start, end, edgeKey }) => {
    strokeNaturalBorder(context, start, end, edgeKey);
  });
}

export function drawEthnicBorders(context: CanvasRenderingContext2D, cells: TCell[]) {
  forEachBorderEdge(cells, shouldDrawEthnicBorder, ({ start, end, edgeKey }) => {
    strokeNaturalBorder(context, start, end, edgeKey);
  });
}

export function drawProvinceBorders(context: CanvasRenderingContext2D, cells: TCell[]) {
  forEachBorderEdge(
    cells,
    (leftCell, rightCell) => {
      if (!isLandCell(leftCell) || !isLandCell(rightCell)) return false;
      const sameNation =
        leftCell.nationId !== null &&
        rightCell.nationId !== null &&
        leftCell.nationId === rightCell.nationId;
      const differentProvince =
        leftCell.provinceId !== null &&
        rightCell.provinceId !== null &&
        leftCell.provinceId !== rightCell.provinceId;
      return sameNation && differentProvince;
    },
    ({ start, end }) => {
      context.beginPath();
      context.moveTo(start[0], start[1]);
      context.lineTo(end[0], end[1]);
      context.strokeStyle = '#1f2937';
      context.lineWidth = 0.5;
      context.setLineDash([3, 3]);
      context.globalAlpha = 1;
      context.shadowColor = '#030712';
      context.shadowBlur = 2.2;
      context.stroke();
      context.shadowBlur = 0;
      context.setLineDash([]);
      context.globalAlpha = 1;
    }
  );
}
