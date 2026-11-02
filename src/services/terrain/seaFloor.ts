import { SEA_FLOOR } from 'src/configs/map/topography';
import { clamp, smoothStep } from 'src/services/utils/math';

/** Depth below sea level for a given distance from land (fraction of the map diagonal). */
export function getSeaFloorDepth(distance: number) {
  const { shelfWidth, slopeWidth, shelfDepth, basinDepth } = SEA_FLOOR;
  const shelf = shelfDepth * (0.5 + 0.5 * clamp(distance / shelfWidth, 0, 1));
  if (distance <= shelfWidth) return shelf;
  const slope = smoothStep(clamp((distance - shelfWidth) / slopeWidth, 0, 1));
  return shelfDepth + (basinDepth - shelfDepth) * slope;
}

/**
 * Gives the sea a shelf, slope and basin by distance from the nearest land. Land and the water/land
 * boundary are left alone: water cells only get deeper or shallower, never turn into land.
 */
export function applySeaFloor(
  elevations: Float32Array,
  neighbors: ReadonlyArray<ReadonlyArray<number>>,
  seaLevel: number,
  cellSpacing: number,
  diagonal: number
) {
  const count = elevations.length;
  const hops = new Int32Array(count).fill(-1);
  const queue: number[] = [];
  for (let i = 0; i < count; i += 1) {
    if (elevations[i] >= seaLevel) {
      hops[i] = 0;
      queue.push(i);
    }
  }
  if (queue.length === 0 || queue.length === count) return elevations;

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head] as number;
    for (const next of neighbors[current]) {
      if (hops[next] >= 0) continue;
      hops[next] = hops[current] + 1;
      queue.push(next);
    }
  }

  const result = Float32Array.from(elevations);
  for (let i = 0; i < count; i += 1) {
    if (elevations[i] >= seaLevel) continue;
    const distance = (hops[i] * cellSpacing) / diagonal;
    const oldDepth = seaLevel - elevations[i];
    const depth =
      getSeaFloorDepth(distance) * (1 - SEA_FLOOR.keepNoise) + oldDepth * SEA_FLOOR.keepNoise;
    result[i] = clamp(seaLevel - Math.max(SEA_FLOOR.minDepth, depth), 0, seaLevel - 1e-4);
  }
  return result;
}
