import { TERRAIN_GUIDE } from 'src/configs/map/topography';
import { TMesh, TPoint } from 'src/types/global';
import { TBoundaryField } from './boundaryField';

export type TTerrainGuide = {
  /** sites well inside a plate, where hotspots can sit */
  interior: TPoint[];
};

/** Where plate tectonics says hotspots belong, for the volcanic preset to use. */
export function buildTerrainGuide(mesh: TMesh, field: TBoundaryField): TTerrainGuide {
  const interior: TPoint[] = [];
  for (let i = 0; i < mesh.cells.length; i += 1) {
    if (field.distance[i] >= TERRAIN_GUIDE.interiorMinDistance) interior.push(mesh.cells[i].site);
  }
  if (interior.length <= TERRAIN_GUIDE.maxInterior) return { interior };
  const stride = interior.length / TERRAIN_GUIDE.maxInterior;
  return {
    interior: Array.from(
      { length: TERRAIN_GUIDE.maxInterior },
      (_, i) => interior[Math.floor(i * stride)] as TPoint
    ),
  };
}
