import { BIOME_THRESHOLDS as BIOME_CONFIG } from 'src/configs/map/terrain';
import { TBiome, TLandform } from 'src/types/global';
import { clamp } from 'src/services/utils/math';

type TClassifyBiomesInput = {
  landforms: TLandform[];
  temperature: Float32Array;
  precipitation: Float32Array;
  aridityIndex: Float32Array;
  elevationAboveSea: Float32Array;
  flow: Float32Array;
  neighborsByCell: number[][];
  isRiverByCell: Uint8Array;
  isLakeByCell: Uint8Array;
  humanImpact: number;
};

const LAND_CODE = {
  MARINE_DEEP: 1,
  MARINE_SHALLOW: 2,
  COAST: 3,
  LAKE: 4,
  PLAIN: 5,
  VALLEY: 6,
  HILLS: 7,
  MOUNTAIN: 8,
  PLATEAU: 9,
  VOLCANIC_FIELD: 10,
} as const;

function toLandformCode(landform: TLandform) {
  if (landform === 'marine_deep') return LAND_CODE.MARINE_DEEP;
  if (landform === 'marine_shallow') return LAND_CODE.MARINE_SHALLOW;
  if (landform === 'coast') return LAND_CODE.COAST;
  if (landform === 'lake') return LAND_CODE.LAKE;
  if (landform === 'plain') return LAND_CODE.PLAIN;
  if (landform === 'valley') return LAND_CODE.VALLEY;
  if (landform === 'hills') return LAND_CODE.HILLS;
  if (landform === 'mountain') return LAND_CODE.MOUNTAIN;
  if (landform === 'plateau') return LAND_CODE.PLATEAU;
  return LAND_CODE.VOLCANIC_FIELD;
}

// Whittaker-style lookup: temperature picks a climate zone, then moisture (precipitation relative
// to evaporation) picks the biome inside it. Each row lists [aridity upper bound, biome] in order.
type TBiomeRow = ReadonlyArray<readonly [number, TBiome]>;

const WHITTAKER = BIOME_CONFIG.whittaker;

const ZONES: ReadonlyArray<{ maxTemp: number; rows: TBiomeRow }> = [
  { maxTemp: WHITTAKER.iceMaxTemp, rows: [[Infinity, 'ice']] },
  {
    maxTemp: WHITTAKER.polarMaxTemp,
    rows: [
      [0.25, 'desert_cold'],
      [Infinity, 'tundra'],
    ],
  },
  {
    maxTemp: WHITTAKER.coldMaxTemp,
    rows: [
      [0.22, 'desert_cold'],
      [0.5, 'tundra'],
      [Infinity, 'boreal_forest'],
    ],
  },
  {
    maxTemp: WHITTAKER.coolMaxTemp,
    rows: [
      [0.2, 'desert_cold'],
      [0.4, 'steppe'],
      [0.7, 'grassland'],
      [Infinity, 'temperate_forest'],
    ],
  },
  {
    maxTemp: WHITTAKER.warmMaxTemp,
    rows: [
      [0.27, 'desert_hot'],
      [0.42, 'steppe'],
      [0.52, 'savanna'],
      [Infinity, 'temperate_forest'],
    ],
  },
  {
    maxTemp: Infinity,
    rows: [
      [0.3, 'desert_hot'],
      [0.5, 'savanna'],
      [Infinity, 'tropical_forest'],
    ],
  },
];

function lookupBiome(temperature: number, aridity: number): TBiome {
  const zone = ZONES.find((candidate) => temperature < candidate.maxTemp) as (typeof ZONES)[number];
  const row = zone.rows.find(([maxAridity]) => aridity < maxAridity) as TBiomeRow[number];
  return row[1];
}

function classifyLandBiome(
  landformCode: number,
  t: number,
  p: number,
  ai: number,
  elevSea: number,
  flowSignalDiv5: number
): TBiome {
  if (landformCode === LAND_CODE.MARINE_DEEP || landformCode === LAND_CODE.MARINE_SHALLOW) {
    return 'marine';
  }
  if (landformCode === LAND_CODE.LAKE) return 'freshwater';

  if (landformCode === LAND_CODE.MOUNTAIN) {
    if (t < WHITTAKER.iceMaxTemp) return 'ice';
    if (t < WHITTAKER.mountainTundraMaxTemp) return 'tundra';
    return 'montane_shrub';
  }

  // Waterlogged lowlands: wet, flat or on a big river, and not frozen.
  const lowland = landformCode === LAND_CODE.VALLEY || landformCode === LAND_CODE.PLAIN;
  if (
    lowland &&
    t > WHITTAKER.polarMaxTemp &&
    ai > WHITTAKER.wetlandMinAridity &&
    p > WHITTAKER.wetlandMinPrecip &&
    flowSignalDiv5 > WHITTAKER.wetlandMinFlow
  ) {
    return 'wetland';
  }

  // High ground is colder than its temperature reading says once it is well above the sea.
  const effectiveTemp = t - clamp(elevSea - 0.3, 0, 1) * 0.1;
  return lookupBiome(effectiveTemp, ai);
}

function postProcessDesertNoise(
  biomes: TBiome[],
  landformCodeByCell: Uint8Array,
  neighborsByCell: number[][]
) {
  const model = BIOME_CONFIG.desert;
  const next = [...biomes];
  const drySet = new Set<TBiome>(['desert_hot', 'desert_cold', 'steppe']);

  for (let cellIndex = 0; cellIndex < biomes.length; cellIndex += 1) {
    const biome = biomes[cellIndex] as TBiome;
    if (biome !== 'desert_hot' && biome !== 'desert_cold') continue;
    const landformCode = landformCodeByCell[cellIndex] as number;
    if (
      landformCode === LAND_CODE.MOUNTAIN ||
      landformCode === LAND_CODE.MARINE_DEEP ||
      landformCode === LAND_CODE.MARINE_SHALLOW
    ) {
      continue;
    }
    const neighbors = neighborsByCell[cellIndex] || [];
    if (neighbors.length === 0) continue;
    let dryNeighbors = 0;
    for (const neighborId of neighbors) {
      if (drySet.has(biomes[neighborId] as TBiome)) dryNeighbors += 1;
    }
    const ratio = dryNeighbors / neighbors.length;
    if (ratio < model.singleCellDryNeighborRatioMin) {
      next[cellIndex] = 'steppe';
    }
  }

  return next;
}

function postProcessHumanPlain(
  biomes: TBiome[],
  landformCodeByCell: Uint8Array,
  temperature: Float32Array,
  precipitation: Float32Array,
  flowSignalDiv6ByCell: Float32Array,
  neighborsByCell: number[][],
  isRiverByCell: Uint8Array,
  isLakeByCell: Uint8Array,
  humanImpact: number
) {
  const model = BIOME_CONFIG.humanPlain;
  const sourceBiomes = new Set<TBiome>([
    'temperate_forest',
    'tropical_forest',
    'boreal_forest',
    'grassland',
    'savanna',
    'steppe',
  ]);
  const desertBiomes = new Set<TBiome>(['desert_hot', 'desert_cold']);
  const next = [...biomes];
  const normalizedImpact = clamp(humanImpact, 0, 1);
  const threshold = model.baseThreshold - normalizedImpact * model.impactGain;

  for (let cellIndex = 0; cellIndex < biomes.length; cellIndex += 1) {
    const biome = biomes[cellIndex] as TBiome;
    const landformCode = landformCodeByCell[cellIndex] as number;
    const wetlandConvertible = biome === 'wetland' && landformCode === LAND_CODE.PLAIN;
    if (!sourceBiomes.has(biome) && !wetlandConvertible) continue;
    if (landformCode === LAND_CODE.MOUNTAIN || landformCode === LAND_CODE.VOLCANIC_FIELD) continue;

    const neighbors = neighborsByCell[cellIndex] || [];
    let nearWater = isLakeByCell[cellIndex] === 1 ? 1 : 0;
    let desertNeighbors = 0;
    let nearbyWaterNeighbors = 0;
    for (const neighborId of neighbors) {
      const neighborBiome = biomes[neighborId] as TBiome;
      if (desertBiomes.has(neighborBiome)) desertNeighbors += 1;
      const neighborLandformCode = landformCodeByCell[neighborId] as number;
      if (
        neighborLandformCode === LAND_CODE.LAKE ||
        neighborLandformCode === LAND_CODE.MARINE_SHALLOW ||
        isRiverByCell[neighborId] === 1 ||
        isLakeByCell[neighborId] === 1
      ) {
        nearbyWaterNeighbors += 1;
      }
    }
    if (isRiverByCell[cellIndex] === 1) nearWater += 1;
    const waterSignal =
      nearWater * model.waterBonusRiver +
      clamp(nearbyWaterNeighbors / Math.max(1, neighbors.length), 0, 1) * model.waterBonusNearby;

    const temp = temperature[cellIndex] as number;
    const tempSignal = clamp(1 - Math.abs(temp - model.tempIdeal) / model.tempTolerance, 0, 1);
    const precipSignal = clamp(precipitation[cellIndex], 0, 1) * 0.3;
    const flowSignal = (flowSignalDiv6ByCell[cellIndex] as number) * 0.2;
    const desertRatio = desertNeighbors / Math.max(1, neighbors.length);
    if (desertRatio > model.maxDesertNeighborRatio) continue;
    const desertPenalty = desertRatio * model.desertNeighborPenalty;

    const suitabilityScore =
      tempSignal * 0.45 + waterSignal + precipSignal + flowSignal - desertPenalty;
    if (suitabilityScore >= threshold) next[cellIndex] = 'plain';
  }

  for (let pass = 0; pass < model.neighborSmoothingPasses; pass += 1) {
    const smooth = [...next];
    for (let cellIndex = 0; cellIndex < smooth.length; cellIndex += 1) {
      if (next[cellIndex] !== 'plain') continue;
      const neighbors = neighborsByCell[cellIndex] || [];
      if (neighbors.length === 0) continue;
      let plainNeighbors = 0;
      let favorableNeighbors = 0;
      for (const neighborId of neighbors) {
        const neighborBiome = next[neighborId] as TBiome;
        if (neighborBiome === 'plain') plainNeighbors += 1;
        if (sourceBiomes.has(neighborBiome) || neighborBiome === 'plain') favorableNeighbors += 1;
      }
      if (plainNeighbors < 1 && favorableNeighbors < Math.ceil(neighbors.length * 0.34)) {
        smooth[cellIndex] = 'grassland';
      }
    }
    next.splice(0, next.length, ...smooth);
  }

  return next;
}

export function classifyBiomes({
  landforms,
  temperature,
  precipitation,
  aridityIndex,
  elevationAboveSea,
  flow,
  neighborsByCell,
  isRiverByCell,
  isLakeByCell,
  humanImpact,
}: TClassifyBiomesInput): TBiome[] {
  const biomes = new Array<TBiome>(landforms.length);
  const landformCodeByCell = new Uint8Array(landforms.length);
  const flowSignalDiv5ByCell = new Float32Array(flow.length);
  const flowSignalDiv6ByCell = new Float32Array(flow.length);

  for (let cellIndex = 0; cellIndex < landforms.length; cellIndex += 1) {
    landformCodeByCell[cellIndex] = toLandformCode(landforms[cellIndex] as TLandform);
  }

  for (let cellIndex = 0; cellIndex < flow.length; cellIndex += 1) {
    const flowValue = flow[cellIndex] as number;
    flowSignalDiv5ByCell[cellIndex] = clamp(Math.log2(flowValue + 1) / 5, 0, 1);
    flowSignalDiv6ByCell[cellIndex] = clamp(Math.log2(flowValue + 1) / 6, 0, 1);
  }

  for (let cellIndex = 0; cellIndex < landforms.length; cellIndex += 1) {
    biomes[cellIndex] = classifyLandBiome(
      landformCodeByCell[cellIndex] as number,
      temperature[cellIndex] as number,
      precipitation[cellIndex] as number,
      aridityIndex[cellIndex] as number,
      elevationAboveSea[cellIndex] as number,
      flowSignalDiv5ByCell[cellIndex] as number
    );
  }

  const noDesertNoise = postProcessDesertNoise(biomes, landformCodeByCell, neighborsByCell);
  return postProcessHumanPlain(
    noDesertNoise,
    landformCodeByCell,
    temperature,
    precipitation,
    flowSignalDiv6ByCell,
    neighborsByCell,
    isRiverByCell,
    isLakeByCell,
    humanImpact
  );
}
