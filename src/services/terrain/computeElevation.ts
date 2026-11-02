import { TOPOGRAPHY_CONFIG } from 'src/configs/map/topography';
import { clamp, createSeededRandom, hashSeed, smoothStep } from 'src/services/utils/math';
import { TDelaunayMesh } from 'src/types/global';
import { computeIsostaticElevation } from './isostasy';
import { TNoiseSampler, createNoiseSampler } from './noise';
import { TBoundaryField, buildBoundaryField } from './boundaryField';
import { TPlate } from './tectonics';

type TReliefSeed = {
  x: number;
  y: number;
  radius: number;
  amplitude: number;
};

type TCellElevationInput = {
  cellIndex: number;
  nx: number;
  ny: number;
  cellPlateId: Int32Array;
  boundaryField: TBoundaryField;
  tectonicScale: { uplift: number; rift: number };
};

const SEEDS = TOPOGRAPHY_CONFIG.seeds;
const BLEND = TOPOGRAPHY_CONFIG.blend;
const WARP = TOPOGRAPHY_CONFIG.warp;
const TECTONIC = TOPOGRAPHY_CONFIG.tectonic;

function buildReliefSeeds(
  seed: string,
  key: string,
  count: number,
  positive: boolean
): TReliefSeed[] {
  const random = createSeededRandom(`${seed}:${key}`);
  const seeds: TReliefSeed[] = [];

  for (let index = 0; index < count; index += 1) {
    seeds.push({
      x: SEEDS.xMargin + random() * SEEDS.span,
      y: SEEDS.yMargin + random() * SEEDS.span,
      radius:
        (positive ? SEEDS.upliftRadiusBase : SEEDS.basinRadiusBase) +
        random() * (positive ? SEEDS.upliftRadiusRange : SEEDS.basinRadiusRange),
      amplitude:
        (positive ? SEEDS.upliftAmplitudeBase : SEEDS.basinAmplitudeBase) +
        random() * (positive ? SEEDS.upliftAmplitudeRange : SEEDS.basinAmplitudeRange),
    });
  }
  return seeds;
}

function sampleSeedField(nx: number, ny: number, seeds: TReliefSeed[]) {
  let value = 0;

  for (const seed of seeds) {
    const dx = nx - seed.x;
    const dy = ny - seed.y;
    const dsq = dx * dx + dy * dy;
    const influence = Math.exp(-dsq / (2 * seed.radius * seed.radius));
    value += seed.amplitude * influence;
  }

  return value;
}

function computeWarpedCoords(
  nx: number,
  ny: number,
  noise: TNoiseSampler,
  warpHash: number
): { warpedX: number; warpedY: number } {
  const warpX = noise.value(nx * WARP.frequency, ny * WARP.frequency, warpHash) - 0.5;
  const warpY = noise.value(nx * WARP.frequency, ny * WARP.frequency, warpHash ^ 0x27d4eb2d) - 0.5;
  const warpedPrimaryX = clamp(nx + warpX * WARP.strength, 0, 1);
  const warpedPrimaryY = clamp(ny + warpY * WARP.strength, 0, 1);
  const frequency = WARP.secondaryFrequency;
  const warpSecondaryX =
    noise.value(warpedPrimaryX * frequency, warpedPrimaryY * frequency, warpHash ^ 0x85ebca6b) -
    0.5;
  const warpSecondaryY =
    noise.value(warpedPrimaryX * frequency, warpedPrimaryY * frequency, warpHash ^ 0x9e3779b9) -
    0.5;
  return {
    warpedX: clamp(warpedPrimaryX + warpSecondaryX * WARP.secondaryStrength, 0, 1),
    warpedY: clamp(warpedPrimaryY + warpSecondaryY * WARP.secondaryStrength, 0, 1),
  };
}

function computeCellElevation(
  input: TCellElevationInput,
  noise: TNoiseSampler,
  macroHash: number,
  warpHash: number,
  detailHash: number,
  upliftSeeds: TReliefSeed[],
  basinSeeds: TReliefSeed[]
): number {
  const { cellIndex, nx, ny, cellPlateId, boundaryField, tectonicScale } = input;

  // 1. Domain warping
  const { warpedX, warpedY } = computeWarpedCoords(nx, ny, noise, warpHash);

  // 2. Multi-octave noise layers
  const macroNoise = noise.fractal(warpedX, warpedY, macroHash) / NOISE.macroDivisor;
  const secondaryNoise =
    noise.fractal(
      warpedX * NOISE.secondaryFrequency,
      warpedY * NOISE.secondaryFrequency,
      macroHash ^ 0x85ebca6b
    ) / NOISE.secondaryDivisor;
  const ridgedNoise = noise.ridged(warpedX * 1.35, warpedY * 1.35, macroHash ^ 0x27d4eb2d);
  const billowNoise = noise.billow(warpedX * 1.15, warpedY * 1.15, macroHash ^ 0x165667b1);
  const erosionMask = noise.fractal(warpedX * 2.8, warpedY * 2.8, detailHash ^ 0x7feb352d);
  const coastNoise = noise.value(
    warpedX * NOISE.coastFrequency,
    warpedY * NOISE.coastFrequency,
    detailHash
  );

  // 3. Relief seed fields
  const upliftField = sampleSeedField(warpedX, warpedY, upliftSeeds);
  const basinField = sampleSeedField(warpedX, warpedY, basinSeeds);

  // 4. Tectonic boundary influence: how far the cell really is from a plate boundary
  const boundaryInfo = boundaryField.info[cellIndex];
  const distanceToAnyBoundary = boundaryField.distance[cellIndex];

  // 5. Isostatic elevation
  const isostaticElevation = computeIsostaticElevation(
    boundaryInfo.isContinental,
    boundaryInfo,
    distanceToAnyBoundary,
    cellIndex,
    cellPlateId[cellIndex]
  );

  // 6. Tectonic uplift/rift
  let tectonicUplift = 0;
  let tectonicRift = 0;

  if (boundaryInfo.boundaryKind !== 'none') {
    const collision =
      boundaryInfo.isContinental && boundaryInfo.neighborPlateKind === 'continental';
    const width = TECTONIC.mountainHalfWidth * (collision ? TECTONIC.collisionWidthFactor : 1);
    const falloff = Math.exp(-((distanceToAnyBoundary / width) ** 2));
    // Ridged noise breaks the belt into chains and gaps instead of a uniform wall.
    const chain =
      TECTONIC.chainBase +
      noise.ridged(warpedX * 3.2, warpedY * 3.2, detailHash ^ 0x2c1b3c6d) * TECTONIC.chainRange;

    if (boundaryInfo.boundaryKind === 'convergent') {
      const rate = clamp(boundaryInfo.convergenceRate / TECTONIC.fullConvergenceRate, 0, 1);
      const isSubduction =
        !boundaryInfo.isContinental && boundaryInfo.neighborPlateKind === 'continental';
      let amplitude = TECTONIC.convergentAmplitude;
      if (collision) amplitude *= TECTONIC.collisionBoost;
      // The oceanic side of a subduction zone sinks into a trench instead of rising.
      if (isSubduction) tectonicRift = rate * falloff * TECTONIC.trenchDepth;
      else tectonicUplift = clamp(rate * amplitude * falloff * chain, 0, BLEND.maxUplift);
    } else if (boundaryInfo.boundaryKind === 'divergent') {
      const rate = clamp(boundaryInfo.divergenceRate / TECTONIC.fullConvergenceRate, 0, 1);
      if (boundaryInfo.isContinental) {
        tectonicRift = clamp(rate * TECTONIC.riftDepth * falloff, 0, BLEND.maxRift);
      } else {
        tectonicUplift = clamp(rate * TECTONIC.ridgeAmplitude * falloff, 0, BLEND.maxUplift);
      }
    }
  }

  const continentalBias = boundaryInfo.isContinental
    ? TECTONIC.continentalElevationBias
    : -TECTONIC.oceanicElevationBias;

  const edgeDistance = Math.min(nx, 1 - nx, ny, 1 - ny);
  const shelf = smoothStep(
    (edgeDistance - TOPOGRAPHY_CONFIG.shelf.edgeOffset) / TOPOGRAPHY_CONFIG.shelf.edgeRange
  );

  return clamp(
    macroNoise * BLEND.macro +
      secondaryNoise * BLEND.secondary +
      ridgedNoise * BLEND.ridged +
      billowNoise * BLEND.billow +
      erosionMask * BLEND.erosionMask +
      upliftField * BLEND.upliftField +
      tectonicUplift * tectonicScale.uplift * BLEND.tectonicUplift +
      coastNoise * BLEND.coastNoise +
      shelf * TOPOGRAPHY_CONFIG.shelf.weight +
      continentalBias * BLEND.continentalBias +
      isostaticElevation * BLEND.isostatic -
      basinField * BLEND.basinField -
      tectonicRift * tectonicScale.rift * BLEND.tectonicRift,
    0,
    1
  );
}

const NOISE = TOPOGRAPHY_CONFIG.noise;
export function computeBaseElevations(
  mesh: TDelaunayMesh,
  seed: string,
  seaLevel: number,
  plates: readonly TPlate[],
  cellPlateId: Int32Array,
  tectonicScale: { uplift: number; rift: number } = { uplift: 1, rift: 1 },
  precomputedField?: TBoundaryField
): Float32Array {
  const noise = createNoiseSampler();
  const macroHash = hashSeed(`${seed}:macro`);
  const warpHash = hashSeed(`${seed}:warp`);
  const detailHash = hashSeed(`${seed}:detail`);
  const cellSites = mesh.cells.map((c) => c.site);
  const boundaryField =
    precomputedField ??
    buildBoundaryField(
      mesh.cells.map((c) => c.neighbors),
      cellSites,
      plates,
      cellPlateId,
      mesh.width,
      mesh.height,
      seaLevel
    );

  const upliftSeeds = buildReliefSeeds(seed, 'uplift-seeds', SEEDS.upliftCount, true);
  const basinSeeds = buildReliefSeeds(seed, 'basin-seeds', SEEDS.basinCount, false);

  const elevations = new Float32Array(mesh.cells.length);

  for (let i = 0; i < mesh.cells.length; i += 1) {
    const cell = mesh.cells[i];
    elevations[i] = computeCellElevation(
      {
        cellIndex: i,
        nx: cell.site[0] / mesh.width,
        ny: cell.site[1] / mesh.height,
        cellPlateId,
        boundaryField,
        tectonicScale,
      },
      noise,
      macroHash,
      warpHash,
      detailHash,
      upliftSeeds,
      basinSeeds
    );
  }
  return elevations;
}
