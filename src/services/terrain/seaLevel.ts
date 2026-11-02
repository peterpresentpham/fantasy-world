import { LAND_FRACTION } from 'src/configs/map/topography';
import { clamp } from 'src/services/utils/math';
import { TTopography } from 'src/types/global';

/** Share of cells that should be land for a preset and a sea level slider value. */
export function getTargetLandFraction(topography: TTopography, seaLevel: number) {
  const base = LAND_FRACTION.target[topography];
  const shifted = base + (LAND_FRACTION.neutralSeaLevel - seaLevel) * LAND_FRACTION.sliderSlope;
  return clamp(shifted, LAND_FRACTION.min, LAND_FRACTION.max);
}

/**
 * Re-scales elevations (keeping their order) so that exactly `landFraction` of the cells lie above
 * `seaLevel`. Everything downstream keeps using `seaLevel` as the shoreline height; only the land
 * share stops depending on how tall a seed's noise happened to come out.
 */
export function remapToLandFraction(
  elevations: Float32Array,
  seaLevel: number,
  landFraction: number
) {
  if (elevations.length === 0) return elevations;
  const sorted = Float32Array.from(elevations).sort();
  const index = clamp(Math.floor(sorted.length * (1 - landFraction)), 0, sorted.length - 1);
  const shore = sorted[index];
  if (!(shore > 0) || !(shore < 1)) return elevations;

  const remapped = new Float32Array(elevations.length);
  for (let i = 0; i < elevations.length; i += 1) {
    const elevation = elevations[i];
    remapped[i] =
      elevation < shore
        ? (elevation / shore) * seaLevel
        : seaLevel + ((elevation - shore) / (1 - shore)) * (1 - seaLevel);
  }
  return remapped;
}
