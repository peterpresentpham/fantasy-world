import { TPoint } from 'src/global';

export type TRgbColor = { r: number; g: number; b: number };

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function interpolateChannel(start: number, end: number, factor: number) {
  return Math.round(start + (end - start) * factor);
}

export function toRgbString(color: TRgbColor) {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

export function interpolateColor(start: TRgbColor, end: TRgbColor, factor: number) {
  return toRgbString({
    r: interpolateChannel(start.r, end.r, factor),
    g: interpolateChannel(start.g, end.g, factor),
    b: interpolateChannel(start.b, end.b, factor),
  });
}

export function edgeNoiseValue(edgeKey: string, salt: number) {
  let hash = 2166136261 ^ salt;
  for (let index = 0; index < edgeKey.length; index += 1) {
    hash ^= edgeKey.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function hexToRgb(hex: string): TRgbColor {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

export function drawPolygon(context: CanvasRenderingContext2D, polygon: TPoint[]) {
  if (polygon.length === 0) return;

  context.beginPath();
  context.moveTo(polygon[0][0], polygon[0][1]);

  for (let pointIndex = 1; pointIndex < polygon.length; pointIndex += 1) {
    context.lineTo(polygon[pointIndex][0], polygon[pointIndex][1]);
  }
  context.closePath();
}
