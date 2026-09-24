import { TCell, TPoint } from 'src/types/global';

export const DEFAULT_ELEV_SCALE = 3.5;

export function projectToIso(
  x: number,
  y: number,
  elevation: number,
  elevScale = DEFAULT_ELEV_SCALE
): TPoint {
  return [x, y - elevation * elevScale];
}

export function projectPolygonToIso(
  polygon: TPoint[],
  elevation: number,
  elevScale = DEFAULT_ELEV_SCALE
): TPoint[] {
  return polygon.map(([px, py]) => projectToIso(px, py, elevation, elevScale));
}

export function getIsoBoundingBox(
  cells: TCell[],
  elevScale: number = DEFAULT_ELEV_SCALE
): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const cell of cells) {
    const isoPoly = projectPolygonToIso(cell.polygon, cell.elevation, elevScale);
    for (const [ix, iy] of isoPoly) {
      if (ix < minX) minX = ix;
      if (iy < minY) minY = iy;
      if (ix > maxX) maxX = ix;
      if (iy > maxY) maxY = iy;
    }
  }

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function getCellDepth(cell: TCell): number {
  return cell.site[1] + cell.elevation;
}

export function sortByDepth(cells: TCell[]): TCell[] {
  return [...cells].sort((a, b) => getCellDepth(a) - getCellDepth(b));
}

export function findSharedEdge(polyA: TPoint[], polyB: TPoint[]): [TPoint, TPoint] | null {
  const EPS = 0.5;
  const shared: TPoint[] = [];

  for (const a of polyA) {
    const found = polyB.some((b) => Math.hypot(b[0] - a[0], b[1] - a[1]) < EPS);
    if (found) shared.push(a);
  }
  if (shared.length >= 2) return [shared[0], shared[1]];
  return null;
}

export type TIsoCanvasDims = {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
};

export function getIsoCanvasDims(
  cells: TCell[],
  elevScale: number,
  isIso: boolean
): TIsoCanvasDims | null {
  if (!isIso) return null;

  const bbox = getIsoBoundingBox(cells, elevScale);
  return {
    width: Math.ceil(bbox.width),
    height: Math.ceil(bbox.height),
    offsetX: -bbox.minX,
    offsetY: -bbox.minY,
  };
}

export function isoProjectCellPolygon(
  polygon: TPoint[],
  elevation: number,
  offsetX: number,
  offsetY: number,
  elevScale: number
): TPoint[] {
  return polygon.map(([px, py]) => [offsetX + px, offsetY + py - elevation * elevScale]);
}
