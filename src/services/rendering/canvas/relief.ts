import { TCell } from 'src/global';
import { drawPolygon } from './shared';

type TShadedReliefOptions = {
  intensity?: number;
  verticalExaggeration?: number;
};

const T_LIGHT_DIR_X = -0.65;
const T_LIGHT_DIR_Y = -0.65;
const T_LIGHT_DIR_Z = 0.4;

function normalize3(x: number, y: number, z: number) {
  const length = Math.hypot(x, y, z);
  if (length <= 0.000001) return [0, 0, 1] as const;
  return [x / length, y / length, z / length] as const;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getCellSlopeVector(cell: TCell, cells: TCell[]) {
  if (cell.neighbors.length === 0) return { gx: 0, gy: 0 };

  let gx = 0;
  let gy = 0;
  let totalWeight = 0;

  for (const neighborId of cell.neighbors) {
    const neighbor = cells[neighborId];
    if (!neighbor) continue;
    const dx = neighbor.site[0] - cell.site[0];
    const dy = neighbor.site[1] - cell.site[1];
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.000001) continue;
    const deltaElevation = neighbor.elevation - cell.elevation;
    const ux = dx / distance;
    const uy = dy / distance;
    const weight = 1 / distance;
    gx += deltaElevation * ux * weight;
    gy += deltaElevation * uy * weight;
    totalWeight += weight;
  }

  if (totalWeight <= 0.000001) return { gx: 0, gy: 0 };
  return { gx: gx / totalWeight, gy: gy / totalWeight };
}

export function applyShadedRelief(
  context: CanvasRenderingContext2D,
  cells: TCell[],
  options: TShadedReliefOptions = {}
) {
  const intensity = options.intensity ?? 0.62;
  const verticalExaggeration = options.verticalExaggeration ?? 10.5;
  const light = normalize3(T_LIGHT_DIR_X, T_LIGHT_DIR_Y, T_LIGHT_DIR_Z);
  const shadowOffsetX = -light[0] * 5.2;
  const shadowOffsetY = -light[1] * 5.2;

  let minElevation = Number.POSITIVE_INFINITY;
  let maxElevation = Number.NEGATIVE_INFINITY;
  for (const cell of cells) {
    if (cell.isWater) continue;
    if (cell.elevation < minElevation) minElevation = cell.elevation;
    if (cell.elevation > maxElevation) maxElevation = cell.elevation;
  }
  const elevationSpan = Math.max(0.0001, maxElevation - minElevation);

  type TReliefCell = {
    cell: TCell;
    dropShadowAlpha: number;
    dropOffset: number;
    shadowAlpha: number;
    lightAlpha: number;
  };

  const reliefCells: TReliefCell[] = [];
  for (const cell of cells) {
    if (cell.isWater) continue;
    const elevationNorm = clamp((cell.elevation - minElevation) / elevationSpan, 0, 1);
    const { gx, gy } = getCellSlopeVector(cell, cells);
    const normal = normalize3(-gx * verticalExaggeration, -gy * verticalExaggeration, 1);
    const lambert = normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2];
    reliefCells.push({
      cell,
      dropShadowAlpha: clamp(elevationNorm * 0.16 + Math.max(0, -lambert) * 0.12, 0.05, 0.22),
      dropOffset: 0.5 + elevationNorm * 1.45,
      shadowAlpha: clamp(
        (Math.max(0, -lambert) * 0.5 + (1 - elevationNorm) * 0.16) * intensity,
        0,
        0.34
      ),
      lightAlpha: clamp((Math.max(0, lambert) * 0.45 + elevationNorm * 0.24) * intensity, 0, 0.29),
    });
  }

  // Pass 1: Drop shadow — per-cell translate requires per-cell save/restore
  for (const { cell, dropShadowAlpha, dropOffset } of reliefCells) {
    context.save();
    context.translate(shadowOffsetX * dropOffset, shadowOffsetY * dropOffset);
    drawPolygon(context, cell.polygon);
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = `rgba(3, 7, 18, ${dropShadowAlpha})`;
    context.fill();
    context.restore();
  }

  // Pass 2: Multiply shadow — one save/restore for the whole pass
  context.save();
  context.globalCompositeOperation = 'multiply';
  for (const { cell, shadowAlpha } of reliefCells) {
    drawPolygon(context, cell.polygon);
    context.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
    context.fill();
  }
  context.restore();

  // Pass 3: Screen highlight — one save/restore for the whole pass
  context.save();
  context.globalCompositeOperation = 'screen';
  for (const { cell, lightAlpha } of reliefCells) {
    drawPolygon(context, cell.polygon);
    context.fillStyle = `rgba(255, 255, 255, ${lightAlpha})`;
    context.fill();
  }
  context.restore();
}
