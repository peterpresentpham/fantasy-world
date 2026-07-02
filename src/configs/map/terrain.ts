export const BIOME_THRESHOLDS = {
  desert: {
    hotTempMin: 0.62,
    hotAridityMax: 0.32,
    hotPrecipMax: 0.22,
    hotPlainAridityMax: 0.28,
    hotPlainPrecipMax: 0.2,
    coldTempMax: 0.48,
    coldAridityMax: 0.42,
    coldPrecipMax: 0.26,
    transitionTempMin: 0.5,
    transitionTempMax: 0.62,
    flowPenaltyScale: 0.18,
    humidPenaltyScale: 0.5,
    singleCellDryNeighborRatioMin: 0.34,
  },
  humanPlain: {
    baseThreshold: 0.66,
    impactGain: 0.38,
    waterBonusRiver: 0.28,
    waterBonusNearby: 0.2,
    tempIdeal: 0.55,
    tempTolerance: 0.24,
    desertNeighborPenalty: 0.42,
    maxDesertNeighborRatio: 0.4,
    neighborSmoothingPasses: 1,
  },
};

export const LANDFORM_ELEVATION_BANDS = {
  coastAboveSeaMax: 0.02,
  plainAboveSeaMax: 0.24,
  valleyAboveSeaMax: 0.3,
  highlandAboveSeaMin: 0.34,
  mountainAboveSeaMin: 0.52,
  volcanicAboveSeaMin: 0.56,
  hillAboveSeaMin: 0.08,
  badlandAboveSeaMin: 0.12,
};

export const LANDFORM_CLASSIFIER_CONFIG = {
  plateauFlatnessMaxAbsSlope: 0.12,
  mountainMinSlope: 0.16,
  valleyMax: -0.04,
  valleyMinFlowSignal: 0.22,
  valleyEnclosureMinRatio: 0.58,
  valleyMinHigherNeighborDelta: 0.035,
};

export const TERRAIN_CLASSIFICATION_RULES = {
  sea: { deepSeaLevel: 0.14, coastBand: 0.015, newLandWidth: 0.06 },
  cold: { tundraMaxTemp: 0.18, tundraAbsElevationMin: 0.9 },
  relief: {
    mountainAbsElevationMin: 0.78,
    hillAbsElevationMin: 0.66,
    plateauAbsElevationMin: 0.68,
    mountainReliefMin: 0.075,
    hillReliefMin: 0.04,
    plateauReliefCap: 0.016,
    plateauPrecipitationMin: 0.22,
    plateauPrecipitationMax: 0.58,
    valleyReliefMax: -0.01,
    valleyPrecipitationMin: 0.42,
    valleyFallbackReliefMax: -0.008,
    valleyFallbackPrecipitationMin: 0.44,
    hillsFallbackReliefMin: 0.03,
    badlandsReliefMin: 0.012,
  },
  arid: {
    desertTemperatureMin: 0.54,
    desertPrecipitationMax: 0.18,
    desertRainShadowMin: 0.34,
    aridDesertPrecipitationMax: 0.2,
    aridDesertRainShadowMin: 0.35,
    aridDesertTemperatureMin: 0.56,
  },
  wet: {
    swampPrecipitationMin: 0.76,
    swampAbsElevationMax: 0.61,
    swampReliefCap: 0.009,
    forestPrecipitationMin: 0.56,
    forestTemperatureMin: 0.22,
  },
  volcanic: {
    elevationDeltaFromMountainAbsMin: 0.04,
    precipitationMax: 0.34,
    temperatureMin: 0.42,
  },
};
