import { TCell } from 'src/types/global';

type TTerrainWaterClass = 'lake' | 'deep-water' | 'shallow-water';
type TLandformWaterClass = 'lake' | 'marine_deep' | 'marine_shallow';

export function isWaterOrRiverCell(cell: Pick<TCell, 'isWater' | 'isRiver' | 'isLake'>) {
  return cell.isWater || cell.isRiver || cell.isLake;
}

export function classifyTerrainWater(
  cell: Pick<TCell, 'isLake' | 'elevation'>,
  seaLevel: number,
  deepSeaLevel: number
): TTerrainWaterClass | null {
  if (cell.isLake) return 'lake';
  if (cell.elevation < seaLevel - deepSeaLevel) return 'deep-water';
  if (cell.elevation < seaLevel) return 'shallow-water';
  return null;
}

export function classifyLandformWater(
  cell: Pick<TCell, 'isWater' | 'isLake' | 'elevation'>,
  seaLevel: number,
  deepSeaLevel: number
): TLandformWaterClass | null {
  if (!cell.isWater) return null;
  if (cell.isLake) return 'lake';
  if (cell.elevation < seaLevel - deepSeaLevel) return 'marine_deep';
  return 'marine_shallow';
}

export function getAvgNeighbor(cell: TCell, cells: TCell[]) {
  if (cell.neighbors.length === 0) return cell.elevation;

  let total = 0;
  for (const neighborId of cell.neighbors) {
    total += cells[neighborId].elevation;
  }
  return total / cell.neighbors.length;
}
