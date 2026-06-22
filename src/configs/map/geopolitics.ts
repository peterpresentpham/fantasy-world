import { TBorderConfig, TBorderType } from 'src/global';

export const BORDER_CONFIG: Record<TBorderType, TBorderConfig> = {
  nation: {
    landformCost: {
      marine_deep: 1.2,
      marine_shallow: 1.2,
      coast: 0.9,
      lake: 1.2,
      plain: 1.1,
      valley: 0.95,
      hills: 1.9,
      mountain: 7.8,
      plateau: 1.8,
      volcanic_field: 8.6,
    },
    biomeCost: {
      unknown: 1,
      plain: 1,
      ice: 1.8,
      tundra: 1.8,
      boreal_forest: 1.25,
      temperate_forest: 1.2,
      tropical_forest: 1.35,
      grassland: 1.05,
      savanna: 1.1,
      steppe: 2.4,
      desert_hot: 2.1,
      desert_cold: 2.1,
      wetland: 1.9,
      montane_shrub: 1.45,
      freshwater: 1.2,
      marine: 1.2,
    },
    penalty: { riverCross: 7.8, lakeCross: 8.4, ridgeCross: 10.5, shorelineEdgeBias: -0.3 },
    fragmentation: {
      maxMountainOwnersPerCluster: 2,
      largeMountainClusterMinCells: 10,
      clusterSplitPenalty: 2.8,
    },
    smoothness: { edgeNoiseWeight: 0.16, jaggedPenalty: 0.5 },
  },
  province: {
    landformCost: {
      marine_deep: 1.2,
      marine_shallow: 1.2,
      coast: 1.15,
      lake: 1.2,
      plain: 1,
      valley: 0.95,
      hills: 1.6,
      mountain: 3.5,
      plateau: 1.7,
      volcanic_field: 4.2,
    },
    biomeCost: {
      unknown: 1,
      plain: 1,
      ice: 1.6,
      tundra: 1.6,
      boreal_forest: 1.45,
      temperate_forest: 1.35,
      tropical_forest: 1.5,
      grassland: 1.05,
      savanna: 1.1,
      steppe: 2.1,
      desert_hot: 1.9,
      desert_cold: 1.9,
      wetland: 1.85,
      montane_shrub: 1.4,
      freshwater: 1.2,
      marine: 1.2,
    },
    penalty: { riverCross: 3.4, lakeCross: 4.2, ridgeCross: 4.8, shorelineEdgeBias: -0.2 },
    fragmentation: {
      maxMountainOwnersPerCluster: 3,
      largeMountainClusterMinCells: 7,
      clusterSplitPenalty: 1.4,
    },
    smoothness: { edgeNoiseWeight: 0.08, jaggedPenalty: 0.25 },
  },
};

export const GEOPOLITICAL_CONFIG = {
  minLandRatio: 0,
  minLandCells: 10,
  frontierNoise: 0.22,
  hubs: { smallNationMinLand: 450, mediumNationMinLand: 900, maxHubsPerNation: 3 },
  ethnic: {
    majorGroupMin: 6,
    majorGroupMax: 12,
    dominantShareMin: 0.5,
    dominantShareMax: 0.8,
    secondaryShareMin: 0.1,
    secondaryShareMax: 0.3,
    crossBorderBlend: 0.28,
    fragmentationLevel: 0.38,
    terrainInfluenceStrength: 7.5,
    distancePenalty: 0.045,
    smoothingPasses: 1,
    minorityClusterMin: 5,
  },
};

/** Province-level constants moved from provinces.ts */
export const IDEAL_PROVINCE_POP = 500_000;
export const MAX_PROVINCE_POP = 1_500_000;
export const MERGE_POP_CAP = 800_000;
export const MIN_POP_PERCENT = 0.03;
export const MAX_POP_PERCENT = 0.12;
export const SMALL_NATION_POPULATION_THRESHOLD = 1_000;
export const SMALL_NATION_MIN_PROVINCE_POPULATION = 200;
export const DEFAULT_MIN_PROVINCE_POPULATION = 1_000;
export const PROVINCE_TUNING = {
  seedDistance: { plainOrValley: 42, other: 72, minBetweenSeeds: 26 },
  split: { maxIterations: 20, maxProvinceAreaFactor: 3.4 },
  rebalance: { softPasses: 2, strictPasses: 12 },
  thresholds: {
    lowPopulationRatio: 0.62,
    remotePlainWaterAccessScoreMax: 0.38,
    ruggedPenalty: 0.22,
    sparseLargeProvinceBias: 0.48,
    pressure: { min: 0.32, max: 2.45, popFactor: 0.58, waterFactor: 0.24, waterNodeBonus: 0.18 },
    geography: { largeSparseFactor: 1.35, terrainAdjustedMinFactor: 0.9 },
    economySpecialFactor: 1.45,
  },
};
