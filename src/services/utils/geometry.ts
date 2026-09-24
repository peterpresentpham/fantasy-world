import { TCell, TLine, TPoint } from 'src/types/global';
import { clamp } from './math';

type TPointKeyOptions = {
  precision?: number;
  separator?: string;
};

type TEdgeKeyOptions = {
  precision?: number;
  pointSeparator?: string;
  edgeSeparator?: string;
};

export function distanceToSegment(x: number, y: number, line: TLine): number {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const denominator = dx * dx + dy * dy;

  if (denominator === 0) return Math.sqrt((x - line.x1) ** 2 + (y - line.y1) ** 2);

  const t = clamp(((x - line.x1) * dx + (y - line.y1) * dy) / denominator, 0, 1);
  const projectionX = line.x1 + t * dx;
  const projectionY = line.y1 + t * dy;

  return Math.sqrt((x - projectionX) ** 2 + (y - projectionY) ** 2);
}

export function toPointKey(point: TPoint, options?: TPointKeyOptions) {
  const precision = options?.precision ?? 3;
  const separator = options?.separator ?? ':';
  return `${point[0].toFixed(precision)}${separator}${point[1].toFixed(precision)}`;
}

export function toEdgeKey(startPoint: TPoint, endPoint: TPoint, options?: TEdgeKeyOptions) {
  const precision = options?.precision ?? 3;
  const pointSeparator = options?.pointSeparator ?? ':';
  const edgeSeparator = options?.edgeSeparator ?? '|';
  const startKey = toPointKey(startPoint, { precision, separator: pointSeparator });
  const endKey = toPointKey(endPoint, { precision, separator: pointSeparator });
  return startKey < endKey
    ? `${startKey}${edgeSeparator}${endKey}`
    : `${endKey}${edgeSeparator}${startKey}`;
}

export function findNearestCell(
  cells: Pick<TCell, 'site'>[],
  sourcePoint: TPoint,
  candidateCellIds: number[],
  isEligible?: (cellId: number) => boolean
) {
  let nearestCellId = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidateCellId of candidateCellIds) {
    if (isEligible && !isEligible(candidateCellId)) continue;
    const candidatePoint = cells[candidateCellId].site;
    const distance = Math.hypot(
      sourcePoint[0] - candidatePoint[0],
      sourcePoint[1] - candidatePoint[1]
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      nearestCellId = candidateCellId;
    }
  }
  return nearestCellId;
}
