import { TBiome, TLandform, TPoint } from 'src/types/global';
import { clamp, hashSeed } from 'src/services/utils/math';
import { createNoiseSampler } from './noise';

type TElevationSpec = {
  base: (seaLevel: number) => number;
  noiseAmplitude: number;
};

const ELEVATION_SPEC: Record<TLandform, TElevationSpec> = {
  mountain: { base: (sl) => Math.max(0.9, sl + 0.55), noiseAmplitude: 0.05 },
  plateau: { base: (sl) => sl + 0.48, noiseAmplitude: 0.01 },
  hills: { base: (sl) => sl + 0.22, noiseAmplitude: 0.05 },
  plain: { base: (sl) => sl + 0.1, noiseAmplitude: 0.03 },
  valley: { base: (sl) => sl + 0.06, noiseAmplitude: 0.02 },
  coast: { base: (sl) => sl + 0.008, noiseAmplitude: 0.004 },
  marine_shallow: { base: (sl) => sl - 0.06, noiseAmplitude: 0.03 },
  marine_deep: { base: (sl) => sl - 0.3, noiseAmplitude: 0.05 },
  lake: { base: (sl) => sl - 0.02, noiseAmplitude: 0.01 },
  volcanic_field: { base: (sl) => Math.max(0.88, sl + 0.5), noiseAmplitude: 0.04 },
};

const noise = createNoiseSampler();

export function computeTargetElevation(
  landform: TLandform,
  seaLevel: number,
  site: TPoint,
  worldWidth: number,
  worldHeight: number,
  seed: string,
  cellId: number
): number {
  const spec = ELEVATION_SPEC[landform];
  const nx = site[0] / worldWidth;
  const ny = site[1] / worldHeight;
  const seedHash = hashSeed(`${seed}:paint:${cellId}`);
  // fractal returns [0,1]; shift to [-1,1] for signed variation
  const variation = (noise.fractal(nx * 3.5, ny * 3.5, seedHash) * 2 - 1) * spec.noiseAmplitude;
  return clamp(spec.base(seaLevel) + variation, 0, 1);
}

export function inferBiomeForLandform(
  landform: TLandform,
  temperature: number,
  _precipitation: number,
  existingBiome: TBiome
): TBiome {
  switch (landform) {
    case 'marine_deep':
    case 'marine_shallow':
      return 'marine';
    case 'lake':
      return 'freshwater';
    case 'mountain':
      if (temperature < 0.14) return 'ice';
      if (temperature < 0.24) return 'tundra';
      return 'montane_shrub';
    case 'volcanic_field':
      return 'steppe';
    default:
      return existingBiome;
  }
}
