import { TCell } from 'src/types/global';

export type TFocus = { fraction: { x: number; y: number }; scale: number };

/** How much of the frame the focused area fills. */
const FILL = 0.7;

/**
 * Where to look to show a nation: the middle of its land, and the zoom at which that land fills
 * `FILL` of the map frame. Returns null when the nation has no land.
 */
export function getNationFocus(
  cells: TCell[],
  nationId: number,
  mapWidth: number,
  mapHeight: number,
  maxScale: number
): TFocus | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const cell of cells) {
    if (cell.isWater || cell.nationId !== nationId) continue;
    minX = Math.min(minX, cell.site[0]);
    maxX = Math.max(maxX, cell.site[0]);
    minY = Math.min(minY, cell.site[1]);
    maxY = Math.max(maxY, cell.site[1]);
  }
  if (!Number.isFinite(minX)) return null;
  const spanX = Math.max(maxX - minX, mapWidth * 0.05);
  const spanY = Math.max(maxY - minY, mapHeight * 0.05);
  const fit = FILL * Math.min(mapWidth / spanX, mapHeight / spanY);
  return {
    fraction: { x: (minX + maxX) / 2 / mapWidth, y: (minY + maxY) / 2 / mapHeight },
    scale: Math.min(maxScale, Math.max(1, fit)),
  };
}
