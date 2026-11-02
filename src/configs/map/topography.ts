export const TOPOGRAPHY_CONFIG = {
  tectonic: {
    /** Half width of a mountain belt, as a share of the map diagonal. */
    mountainHalfWidth: 0.05,
    collisionWidthFactor: 1.6,
    /** Relative plate speed that counts as full-strength collision or spreading. */
    fullConvergenceRate: 0.01,
    convergentAmplitude: 1,
    collisionBoost: 1.3,
    trenchDepth: 0.35,
    riftDepth: 0.45,
    ridgeAmplitude: 0.25,
    chainBase: 0.55,
    chainRange: 0.7,
    continentalElevationBias: 0.03,
    oceanicElevationBias: 0.06,
  },
  seeds: {
    upliftCount: 10,
    basinCount: 8,
    xMargin: 0.03,
    yMargin: 0.03,
    span: 0.94,
    upliftRadiusBase: 0.06,
    upliftRadiusRange: 0.1,
    basinRadiusBase: 0.08,
    basinRadiusRange: 0.12,
    upliftAmplitudeBase: 0.2,
    upliftAmplitudeRange: 0.22,
    basinAmplitudeBase: 0.16,
    basinAmplitudeRange: 0.18,
  },
  warp: { frequency: 2.2, strength: 0.2, secondaryFrequency: 5.1, secondaryStrength: 0.08 },
  noise: {
    macroDivisor: 1.58,
    secondaryFrequency: 1.6,
    secondaryDivisor: 1.95,
    coastFrequency: 8.4,
    jaggedFrequency: 5.2,
    jaggedBase: 0.72,
    jaggedRange: 0.62,
    fbm: { octaves: 5, persistence: 0.55, lacunarity: 2.08 },
    ridged: { octaves: 5, persistence: 0.52, lacunarity: 2.2, sharpness: 1.75 },
    billow: { octaves: 5, persistence: 0.52, lacunarity: 1.96 },
  },
  shelf: { edgeOffset: 0.005, edgeRange: 0.18, weight: 0.05 },
  blend: {
    macro: 0.3,
    secondary: 0.18,
    ridged: 0.15,
    billow: 0.14,
    erosionMask: 0.12,
    upliftField: 0.15,
    tectonicUplift: 0.6,
    coastNoise: 0.08,
    basinField: 0.26,
    tectonicRift: 0.24,
    maxUplift: 1.2,
    maxRift: 1,
    continentalBias: 0.5,
    isostatic: 0.4,
  },
  mountainRecovery: { quantileStart: 0.86, peakBoostMax: 0.14 },
  erosion: {
    erosionRate: 0.2,
  },
};

/** How strongly each preset leans on plate collisions (uplift) and spreading (rift). */
export const TECTONIC_PRESET_SCALE = {
  balanced: { uplift: 1, rift: 1 },
  ranges: { uplift: 1.5, rift: 0.8 },
  rifted: { uplift: 0.9, rift: 1.8 },
  archipelago: { uplift: 1, rift: 1 },
  volcanic: { uplift: 1.1, rift: 0.9 },
  continental: { uplift: 0.8, rift: 0.8 },
} as const;

/**
 * Share of cells in the generated terrain that are land, per preset, at the default slider
 * (a few points more than the final land share: erosion and inland lakes take some back). The
 * generator moves the sea so every seed lands near this share; the slider then adds or removes
 * land (`sliderSlope` of land share per unit of slider).
 */
export const LAND_FRACTION = {
  target: {
    balanced: 0.42,
    continental: 0.5,
    ranges: 0.46,
    rifted: 0.38,
    archipelago: 0.17,
    volcanic: 0.34,
  },
  neutralSeaLevel: 0.5,
  sliderSlope: 1,
  min: 0.05,
  max: 0.85,
} as const;

/** Where preset hotspots may sit: over a plate interior, away from every plate boundary. */
export const TERRAIN_GUIDE = {
  /** fraction of the map diagonal */
  interiorMinDistance: 0.1,
  maxInterior: 300,
} as const;

/**
 * Sea floor profile, by distance from the nearest land (fraction of the map diagonal): a shallow
 * shelf, a slope that drops away, then the deep basin. Depths are below sea level in elevation units
 * (anything deeper than `TERRAIN_CLASSIFICATION_RULES.sea.deepSeaLevel` counts as deep water).
 */
export const SEA_FLOOR = {
  shelfWidth: 0.022,
  slopeWidth: 0.04,
  shelfDepth: 0.07,
  basinDepth: 0.3,
  /** share of the old, noisy depth that survives, so the floor is not perfectly smooth */
  keepNoise: 0.3,
  minDepth: 0.005,
} as const;

export const TOPOGRAPHY_PRESET_CONFIG = {
  balanced: {
    rangeBands: { count: 7, amplitude: 0.2, width: 0.11 },
    valleyBands: { count: 5, depth: 0.12, width: 0.12 },
    edgeShelfStrength: 0.24,
    smoothFactor: 0.2,
  },
  ranges: {
    rangeBands: { count: 10, amplitude: 0.24, width: 0.09 },
    valleyBands: { count: 4, depth: 0.1, width: 0.1 },
    edgeShelfStrength: 0.2,
    smoothFactor: 0.16,
  },
  rifted: {
    rangeBands: { count: 8, amplitude: 0.17, width: 0.1 },
    valleyBands: { count: 8, depth: 0.16, width: 0.08 },
    globalScale: { offset: -0.02, scale: 0.98 },
    edgeShelfStrength: 0.22,
    smoothFactor: 0.18,
  },
  archipelago: {
    majorIslandMin: 3,
    majorIslandMax: 5,
    mediumIslandBase: 6,
    mediumIslandExtra: 4,
    smallIslandBase: 14,
    smallIslandExtra: 8,
    valleyBands: { count: 5, depth: 0.06, width: 0.08 },
    edgeShelfStrength: 0.2,
    smoothFactor: 0.14,
  },
  volcanic: {
    rangeBands: { count: 6, amplitude: 0.18, width: 0.08 },
    valleyBands: { count: 6, depth: 0.14, width: 0.09 },
    globalScale: { offset: -0.01, scale: 1.0 },
    edgeShelfStrength: 0.26,
    smoothFactor: 0.12,
  },
  continental: {
    plateauCount: 3,
    rangeBands: { count: 5, amplitude: 0.15, width: 0.14 },
    valleyBands: { count: 6, depth: 0.08, width: 0.15 },
    globalScale: { offset: 0.01, scale: 0.96 },
    edgeShelfStrength: 0.2,
    smoothFactor: 0.22,
  },
};
