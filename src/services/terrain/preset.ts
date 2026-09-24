import { TOPOGRAPHY_PRESET_CONFIG } from 'src/configs/map/topography';
import { clamp, createSeededRandom, hashSeed } from 'src/services/utils/math';
import { TMesh, TTopography } from 'src/types/global';
import {
  applyArchipelago,
  applyEdgeShelf,
  applyEscarpments,
  applyHillBands,
  applyPlateaus,
  applyRangeBands,
  applyRangeChains,
  applyValleyBands,
  applyHotspots,
  smoothElevations,
} from './shape';

interface TApplyTopographyParams {
  mesh: TMesh;
  seed: string;
  topography: TTopography;
  elevations: Float32Array;
}

function applyGlobalScale(elevations: Float32Array, offset: number, scale: number) {
  for (let index = 0; index < elevations.length; index += 1) {
    elevations[index] = clamp(elevations[index] * scale + offset, 0, 1);
  }
}

const ranges = TOPOGRAPHY_PRESET_CONFIG.ranges;
const balanced = TOPOGRAPHY_PRESET_CONFIG.balanced;
const rifted = TOPOGRAPHY_PRESET_CONFIG.rifted;
const archipelago = TOPOGRAPHY_PRESET_CONFIG.archipelago;
const volcanic = TOPOGRAPHY_PRESET_CONFIG.volcanic;
const continental = TOPOGRAPHY_PRESET_CONFIG.continental;

export function applyTopography({ mesh, seed, topography, elevations }: TApplyTopographyParams) {
  const random = createSeededRandom(`${seed}:${topography}:terrain-tools`);
  const nextElevations = Float32Array.from(elevations);

  // ── Balanced ───────────────────────────────────────────────────────────────
  // Moderate terrain with mixed ridges, valleys, and hills.
  if (topography === 'balanced') {
    // Primary ridge bands
    applyRangeBands(mesh, random, nextElevations, balanced.rangeBands);
    // Valleys between ridges
    applyValleyBands(mesh, random, nextElevations, balanced.valleyBands);
    // Rolling hills fill the spaces
    applyHillBands(mesh, random, nextElevations, 6, 0.065, 0.14);
    // Edge shelf
    applyEdgeShelf(
      mesh,
      nextElevations,
      balanced.edgeShelfStrength,
      hashSeed(`${seed}:${topography}:shelf`)
    );
    // Smooth
    smoothElevations(mesh, nextElevations, balanced.smoothFactor);
    return nextElevations;
  }

  // ── Ranges ─────────────────────────────────────────────────────────────────
  // Long folded mountain chains (like Himalayas / Andes) with foothills.
  if (topography === 'ranges') {
    // Primary chain ranges
    applyRangeChains(mesh, random, nextElevations, ranges.rangeBands);
    // Foothills at base of ranges
    applyHillBands(mesh, random, nextElevations, 8, 0.07, 0.18);
    // Secondary linear bands
    applyRangeBands(mesh, random, nextElevations, {
      ...ranges.rangeBands,
      count: Math.max(4, Math.floor(ranges.rangeBands.count * 0.45)),
      amplitude: ranges.rangeBands.amplitude * 0.62,
      width: ranges.rangeBands.width * 0.82,
    });
    // Deeper valleys
    const { count, depth, width } = ranges.valleyBands;
    applyValleyBands(mesh, random, nextElevations, {
      ...ranges.valleyBands,
      count: count + 4,
      depth: depth * 1.28,
      width: width * 0.84,
    });
    applyEdgeShelf(
      mesh,
      nextElevations,
      ranges.edgeShelfStrength,
      hashSeed(`${seed}:${topography}:shelf`)
    );
    smoothElevations(mesh, nextElevations, ranges.smoothFactor);
    return nextElevations;
  }

  // ── Rifted ─────────────────────────────────────────────────────────────────
  // Continental rifts with escarpments, plateaus, and rift valleys.
  if (topography === 'rifted') {
    // Escarpments create dramatic elevation changes
    applyEscarpments(mesh, random, nextElevations);
    // Plateaus on the high side
    applyPlateaus(mesh, random, nextElevations, 2, 0.15, 0.1);
    // Ridge bands
    applyRangeBands(mesh, random, nextElevations, rifted.rangeBands);
    // Deep rift valleys
    applyValleyBands(mesh, random, nextElevations, rifted.valleyBands);
    // Global scale
    if (rifted.globalScale) {
      applyGlobalScale(nextElevations, rifted.globalScale.offset, rifted.globalScale.scale);
    }
    applyEdgeShelf(
      mesh,
      nextElevations,
      rifted.edgeShelfStrength,
      hashSeed(`${seed}:${topography}:shelf`)
    );
    smoothElevations(mesh, nextElevations, rifted.smoothFactor);
    return nextElevations;
  }

  // ── Archipelago ────────────────────────────────────────────────────────────
  // Island chains with varied sizes.
  if (topography === 'archipelago') {
    applyArchipelago(mesh, random, nextElevations, {
      majorIslandCount:
        archipelago.majorIslandMin +
        Math.floor(random() * (archipelago.majorIslandMax - archipelago.majorIslandMin + 1)),
      mediumIslandCount:
        archipelago.mediumIslandBase + Math.floor(random() * archipelago.mediumIslandExtra),
      smallIslandCount:
        archipelago.smallIslandBase + Math.floor(random() * archipelago.smallIslandExtra),
    });
    applyValleyBands(mesh, random, nextElevations, archipelago.valleyBands);
    applyEdgeShelf(
      mesh,
      nextElevations,
      archipelago.edgeShelfStrength,
      hashSeed(`${seed}:${topography}:shelf`)
    );
    smoothElevations(mesh, nextElevations, archipelago.smoothFactor);
    return nextElevations;
  }

  // ── Volcanic ───────────────────────────────────────────────────────────────
  // Rugged terrain driven by hotspot volcanoes and lava plateaus.
  if (topography === 'volcanic') {
    // Hotspot volcanoes
    applyHotspots(mesh, random, nextElevations);
    // Volcanic ridges (range bands)
    applyRangeBands(mesh, random, nextElevations, volcanic.rangeBands);
    // Small-scale hill clusters for rough lava terrain
    applyHillBands(mesh, random, nextElevations, 10, 0.06, 0.1);
    // Valleys / caldera depressions
    applyValleyBands(mesh, random, nextElevations, volcanic.valleyBands);
    if (volcanic.globalScale) {
      applyGlobalScale(nextElevations, volcanic.globalScale.offset, volcanic.globalScale.scale);
    }
    applyEdgeShelf(
      mesh,
      nextElevations,
      volcanic.edgeShelfStrength,
      hashSeed(`${seed}:${topography}:shelf`)
    );
    smoothElevations(mesh, nextElevations, volcanic.smoothFactor);
    return nextElevations;
  }

  // ── Continental ────────────────────────────────────────────────────────────
  // Broad continent with plateaus, shield regions, and scattered mountain belts.
  applyPlateaus(mesh, random, nextElevations, continental.plateauCount, 0.16, 0.12);
  applyRangeBands(mesh, random, nextElevations, continental.rangeBands);
  applyHillBands(mesh, random, nextElevations, 8, 0.05, 0.16);
  applyValleyBands(mesh, random, nextElevations, continental.valleyBands);
  // Widespread gentle smoothing
  applyGlobalScale(nextElevations, continental.globalScale.offset, continental.globalScale.scale);
  applyEdgeShelf(
    mesh,
    nextElevations,
    continental.edgeShelfStrength,
    hashSeed(`${seed}:${topography}:shelf`)
  );
  smoothElevations(mesh, nextElevations, continental.smoothFactor);

  return nextElevations;
}
