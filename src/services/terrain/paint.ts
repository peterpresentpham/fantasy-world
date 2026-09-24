import { TCell, TLandform, TTerrainOverride } from 'src/types/global';
import { computeTargetElevation, inferBiomeForLandform } from './terrainPainter';

const NEIGHBOR_BLEND_WEIGHT = 0.12;

/**
 * Mutates `cellId` and its unpainted neighbors in `cells` in place to reflect
 * a terrain paint stroke, blending elevation into neighbors to avoid hard
 * cliff edges. Returns the override to track for this cell, or null if the
 * cell doesn't exist.
 */
export function paintCellTerrain(
  cells: TCell[],
  cellId: number,
  landform: TLandform,
  seaLevel: number,
  seed: string,
  worldWidth: number,
  worldHeight: number,
  alreadyOverriddenIds: ReadonlyMap<number, number>
): TTerrainOverride | null {
  const cell = cells[cellId];
  if (!cell) return null;

  const newElevation = computeTargetElevation(
    landform,
    seaLevel,
    cell.site,
    worldWidth,
    worldHeight,
    seed,
    cellId
  );
  const newIsWater = newElevation < seaLevel;

  cell.elevation = newElevation;
  cell.isWater = newIsWater;
  cell.landform = landform;
  cell.biome = inferBiomeForLandform(landform, cell.temperature, cell.precipitation, cell.biome);

  for (const neighborId of cell.neighbors) {
    const neighbor = cells[neighborId];
    if (!neighbor || alreadyOverriddenIds.has(neighborId)) continue;
    neighbor.elevation =
      neighbor.elevation * (1 - NEIGHBOR_BLEND_WEIGHT) + newElevation * NEIGHBOR_BLEND_WEIGHT;
  }

  return { elevation: newElevation, landform, isWater: newIsWater };
}
