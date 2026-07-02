export const HYDROLOGY_CONFIG = {
  coastOutletId: -2,
  waterInfluence: { iterations: 6, selfWeight: 1.2 },
};

export const EROSION_CONFIG = {
  maxAmount: 0.08,
  slopeWeight: 0.2,
  flowWeight: 0.012,
  depositRate: 0.42,
};

export const LAKE_CONFIG = {
  sinkFlowMin: 8.8,
  expansion: { maxCells: 5, elevationSlack: 0.018, rainShadowMax: 0.34, precipMin: 0.28 },
  limits: { maxCount: 12 },
  enclosedWater: {
    maxLakeCells: 199,
    elevationBuffer: 0.04,
    depthMin: 0.055,
    shoreRiseFactor: 0.7,
    shoreRiseMax: 0.09,
  },
  plains: { largePlainMin: 90, veryLargePlainMin: 50 },
};

export const PRECIPITATION_CONFIG = {
  baseWeights: { water: 0.56, latitude: 1.0, flow: 0.08 },
  orographicSimple: { elevationStart: 0.6, weight: 0.25, maxBonus: 0.25 },
  wind: {
    tradeLatMax: 0.23,
    westerlyLatMax: 0.7,
    tradeSpeed: 1,
    westerlySpeed: 1.05,
    polarSpeed: 0.75,
    equatorBlend: 0.22,
    noise: 0.18,
  },
  moistureAdvection: {
    iterations: 10,
    carry: 0.88,
    selfCarry: 0.12,
    localRecharge: 0.04,
    maxSource: 1,
  },
  orographic: {
    upliftScale: 1.1,
    leeDryingScale: 0.82,
    shieldingPow: 1.35,
    rainShadowGain: 0.75,
    rainShadowDecay: 0.94,
  },
  microphysics: { tauCloud: 3.2, tauFallout: 4.4, cloudDrawdown: 0.6 },
};

export const RIVER_CONFIG = {
  minFluxToFormRiver: 80,
  landWaterThreshold: 0.2,
  cellsNumberModifierExp: 0.25,
  depression: { maxIterations: 200, epsilon: 0.0001, coastLift: 0.0015 },
  width: { fluxFactor: 500, maxFluxWidth: 1, lengthFactor: 200, minWidth: 0.8, maxWidth: 4.8 },
  meander: { base: 0.5, minSegmentLength: 16 },
  minRiverCells: 6,
};

export const TEMPERATURE_CONFIG = {
  seasonPhase: 0.25,
  latBase: 0.82,
  latCurve: 1.1,
  lapseDry: 0.72,
  lapseMoistMin: 0.36,
  precipLapseInfluence: 0.5,
  maritimeRadius: 18,
  maritimeStrength: 0.12,
  aspectStrength: 0.05,
  coldPoolStrength: 0.06,
  smoothingPasses: 1,
};
