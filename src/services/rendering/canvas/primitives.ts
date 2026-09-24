import { type MouseEvent, type PointerEvent } from 'react';
import { TCell, TPoint } from 'src/types/global';
import { drawPolygon } from './shared';

export function getCanvasPoint(
  event: MouseEvent<HTMLCanvasElement> | PointerEvent<HTMLCanvasElement>,
  width: number,
  height: number
) {
  const rect = event.currentTarget.getBoundingClientRect();
  const scaleX = width / rect.width;
  const scaleY = height / rect.height;

  return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
}

export function setupCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  pixelRatio: number
) {
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;

  const context = canvas.getContext('2d');
  if (!context) return null;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  return context;
}

export function drawCellShape(
  context: CanvasRenderingContext2D,
  cell: TCell,
  fillStyle: string,
  fillOpacity: number,
  strokeStyle: string,
  strokeWidth: number
) {
  drawPolygon(context, cell.polygon);
  context.fillStyle = fillStyle;
  context.globalAlpha = fillOpacity;
  context.fill();
  context.globalAlpha = 1;
  context.strokeStyle = strokeStyle;
  context.lineWidth = strokeWidth;
  context.stroke();
}

export function drawSiteMarker(
  context: CanvasRenderingContext2D,
  cell: TCell,
  radius: number,
  fillStyle: string,
  opacity: number
) {
  context.beginPath();
  context.arc(cell.site[0], cell.site[1], radius, 0, Math.PI * 2);
  context.fillStyle = fillStyle;
  context.globalAlpha = opacity;
  context.fill();
  context.globalAlpha = 1;
}

export function drawRiverCurve(context: CanvasRenderingContext2D, from: TCell, to: TCell) {
  const end = getRiverSegmentEndPoint(from, to);
  const dx = end[0] - from.site[0];
  const dy = end[1] - from.site[1];
  const length = Math.hypot(dx, dy);
  if (length < 0.0001) return;

  const nx = -dy / length;
  const ny = dx / length;
  const idHash = ((from.id * 73856093) ^ (to.id * 19349663)) >>> 0;
  const sign = (idHash & 1) === 0 ? 1 : -1;
  const bend = Math.min(14, Math.max(3, length * 0.22)) * sign;

  const cx = (from.site[0] + end[0]) * 0.5 + nx * bend;
  const cy = (from.site[1] + end[1]) * 0.5 + ny * bend;

  context.beginPath();
  context.moveTo(from.site[0], from.site[1]);
  context.quadraticCurveTo(cx, cy, end[0], end[1]);
}

export function getRiverSegmentEndPoint(from: TCell, to: TCell): TPoint {
  if (!to.isWater) return [to.site[0], to.site[1]];

  const startX = from.site[0];
  const startY = from.site[1];
  const endX = to.site[0];
  const endY = to.site[1];
  const dx = endX - startX;
  const dy = endY - startY;
  const eps = 1e-6;

  let bestT = Number.POSITIVE_INFINITY;
  let bestPoint: TPoint | null = null;

  const polygon = from.polygon;
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index] as TPoint;
    const b = polygon[(index + 1) % polygon.length] as TPoint;
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < eps) continue;

    const qpx = a[0] - startX;
    const qpy = a[1] - startY;
    const t = (qpx * ey - qpy * ex) / denom;
    const u = (qpx * dy - qpy * dx) / denom;
    if (t <= eps || t > 1 + eps) continue;
    if (u < -eps || u > 1 + eps) continue;
    if (t < bestT) {
      bestT = t;
      bestPoint = [startX + dx * t, startY + dy * t];
    }
  }
  return bestPoint ?? [to.site[0], to.site[1]];
}
