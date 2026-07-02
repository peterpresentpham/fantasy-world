import { TOPOGRAPHY_CONFIG } from 'src/configs/map/topography';
import { clamp, createSeededRandom, hashSeed, smoothStep } from 'src/services/utils/math';
import { TDelaunayMesh, TPoint } from 'src/global';
import { computeIsostaticElevation } from './isostasy';
import { TNoiseSampler, createNoiseSampler } from './noise';
import { TPlate, classifyBoundaryForCell } from './tectonics';

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
  cellX: number;
  cellY: number;
  neighbors: readonly number[];
  cellSites: TPoint[];
  plates: readonly TPlate[];
  cellPlateId: Int32Array;
  meshWidth: number;
  meshHeight: number;
  seaLevel: number;
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
  basinSeeds: TReliefSeed[],
  plates: readonly TPlate[],
  cellPlateId: Int32Array
): number {
  const { cellIndex, nx, ny, cellX, cellY, neighbors, cellSites, meshWidth, meshHeight, seaLevel } =
    input;

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

  // 4. Tectonic boundary influence
  const boundaryInfo = classifyBoundaryForCell(
    cellIndex,
    cellX,
    cellY,
    neighbors,
    cellSites,
    plates,
    cellPlateId,
    seaLevel,
    meshWidth,
    meshHeight
  );

  // Min distance to any boundary for isostasy
  let distanceToAnyBoundary = 1;
  for (const nid of neighbors) {
    if (cellPlateId[nid] !== cellPlateId[cellIndex]) {
      const ns = cellSites[nid];
      const d = Math.hypot(cellX - ns[0], cellY - ns[1]) / Math.hypot(meshWidth, meshHeight);
      if (d < distanceToAnyBoundary) distanceToAnyBoundary = d;
    }
  }

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
    const distNorm = boundaryInfo.distanceToBoundary / TECTONIC.boundaryInfluenceWidth;
    const influence = clamp(1 - distNorm, 0, 1);
    const influenceSq = influence * influence;
    const jaggedness =
      TOPOGRAPHY_CONFIG.noise.jaggedBase +
      noise.value(
        warpedX * TOPOGRAPHY_CONFIG.noise.jaggedFrequency,
        warpedY * TOPOGRAPHY_CONFIG.noise.jaggedFrequency,
        detailHash ^ cellIndex
      ) *
        TOPOGRAPHY_CONFIG.noise.jaggedRange;

    if (boundaryInfo.boundaryKind === 'convergent') {
      const isSubduction =
        !boundaryInfo.isContinental && boundaryInfo.neighborPlateKind === 'continental';
      let baseUplift = boundaryInfo.convergenceRate * TECTONIC.convergentUpliftScale;
      if (isSubduction) baseUplift *= TECTONIC.subductionArcBoost;
      tectonicUplift = clamp(baseUplift * influenceSq * jaggedness * 0.5, 0, BLEND.maxUplift);
    } else if (boundaryInfo.boundaryKind === 'divergent') {
      const baseRift = boundaryInfo.divergenceRate * TECTONIC.divergentRiftScale;
      if (!boundaryInfo.isContinental) {
        tectonicUplift = clamp(baseRift * influenceSq * jaggedness * 0.15, 0, BLEND.maxUplift);
      } else {
        tectonicRift = clamp(baseRift * influenceSq * jaggedness * 0.5, 0, BLEND.maxRift);
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
      tectonicUplift * BLEND.tectonicUplift +
      coastNoise * BLEND.coastNoise +
      shelf * TOPOGRAPHY_CONFIG.shelf.weight +
      continentalBias * BLEND.continentalBias +
      isostaticElevation * BLEND.isostatic -
      basinField * BLEND.basinField -
      tectonicRift * BLEND.tectonicRift,
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
  cellPlateId: Int32Array
): Float32Array {
  const noise = createNoiseSampler();
  const macroHash = hashSeed(`${seed}:macro`);
  const warpHash = hashSeed(`${seed}:warp`);
  const detailHash = hashSeed(`${seed}:detail`);
  const cellSites = mesh.cells.map((c) => c.site);

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
        cellX: cell.site[0],
        cellY: cell.site[1],
        neighbors: cell.neighbors,
        cellSites,
        plates,
        cellPlateId,
        meshWidth: mesh.width,
        meshHeight: mesh.height,
        seaLevel,
      },
      noise,
      macroHash,
      warpHash,
      detailHash,
      upliftSeeds,
      basinSeeds,
      plates,
      cellPlateId
    );
  }
  return elevations;
}
