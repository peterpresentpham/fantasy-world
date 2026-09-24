import { HYDROLOGY_CONFIG } from 'src/configs/map/hydrology';
import { LANDFORM_ELEVATION_BANDS, TERRAIN_CLASSIFICATION_RULES } from 'src/configs/map/terrain';
import { classifyTerrainWater } from 'src/services/utils/cell';
import { TBiome, TCell, TLandform, TTerrain } from 'src/types/global';
import { clamp } from 'src/services/utils/math';

export function buildWaterInfluence(cells: TCell[]): Float32Array {
  let waterInfluence = new Float32Array(cells.length);
  let nextInfluence = new Float32Array(cells.length);

  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    waterInfluence[cellIndex] = cells[cellIndex].isWater ? 1 : 0;
  }

  for (let iteration = 0; iteration < HYDROLOGY_CONFIG.waterInfluence.iterations; iteration += 1) {
    for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
      const cell = cells[cellIndex];
      if (cell.neighbors.length === 0) {
        nextInfluence[cellIndex] = waterInfluence[cellIndex] as number;
        continue;
      }

      let total = waterInfluence[cellIndex] * HYDROLOGY_CONFIG.waterInfluence.selfWeight;
      for (const neighborId of cell.neighbors) {
        total += waterInfluence[neighborId];
      }

      nextInfluence[cellIndex] =
        total / (cell.neighbors.length + HYDROLOGY_CONFIG.waterInfluence.selfWeight);
    }
    const tmp = waterInfluence;
    waterInfluence = nextInfluence;
    nextInfluence = tmp;
  }
  return waterInfluence;
}

const RELIEF = TERRAIN_CLASSIFICATION_RULES.relief;
const AIRD = TERRAIN_CLASSIFICATION_RULES.arid;
const SEA = TERRAIN_CLASSIFICATION_RULES.sea;
const WET = TERRAIN_CLASSIFICATION_RULES.wet;
export function classifyTerrain(
  cell: TCell,
  seaLevel: number,
  temperature: number,
  precipitation: number,
  rainShadow: number,
  relief: number
): TTerrain {
  const waterClass = classifyTerrainWater(cell, seaLevel, SEA.deepSeaLevel);
  if (waterClass !== null) return waterClass;
  if (cell.elevation < seaLevel + SEA.coastBand) return 'coast';

  const inValley =
    cell.isRiver ||
    (relief < RELIEF.valleyReliefMax && precipitation > RELIEF.valleyPrecipitationMin);

  if (
    temperature < TERRAIN_CLASSIFICATION_RULES.cold.tundraMaxTemp ||
    cell.elevation > TERRAIN_CLASSIFICATION_RULES.cold.tundraAbsElevationMin
  ) {
    return 'tundra';
  }

  const elevationAboveSea = cell.elevation - seaLevel;
  const isNewLand = elevationAboveSea < SEA.newLandWidth;

  if (
    relief > RELIEF.mountainReliefMin &&
    (cell.elevation > RELIEF.mountainAbsElevationMin || isNewLand)
  ) {
    return 'mountains';
  }

  if (relief > RELIEF.hillReliefMin && (cell.elevation > RELIEF.hillAbsElevationMin || isNewLand)) {
    return 'hills';
  }

  if (
    cell.elevation > RELIEF.plateauAbsElevationMin &&
    relief < RELIEF.plateauReliefCap &&
    precipitation > RELIEF.plateauPrecipitationMin &&
    precipitation < RELIEF.plateauPrecipitationMax
  ) {
    return 'plateau';
  }

  if (cell.elevation > RELIEF.mountainAbsElevationMin) return 'mountains';
  if (cell.elevation > RELIEF.hillAbsElevationMin) return 'hills';
  if (inValley) return 'valley';

  if (
    temperature > AIRD.desertTemperatureMin &&
    precipitation < AIRD.desertPrecipitationMax &&
    rainShadow > AIRD.desertRainShadowMin
  ) {
    if (
      cell.elevation > seaLevel + LANDFORM_ELEVATION_BANDS.badlandAboveSeaMin &&
      relief > RELIEF.badlandsReliefMin
    ) {
      return 'badlands';
    }
    return 'desert';
  }

  if (
    precipitation > WET.swampPrecipitationMin &&
    cell.elevation < WET.swampAbsElevationMax &&
    relief < WET.swampReliefCap
  ) {
    return 'swamp';
  }

  if (precipitation > WET.forestPrecipitationMin && temperature > WET.forestTemperatureMin) {
    return 'forest';
  }
  if (
    precipitation < AIRD.aridDesertPrecipitationMax &&
    temperature > AIRD.aridDesertTemperatureMin &&
    rainShadow > AIRD.aridDesertRainShadowMin
  ) {
    return 'desert';
  }
  if (
    cell.elevation >
      RELIEF.mountainAbsElevationMin -
        TERRAIN_CLASSIFICATION_RULES.volcanic.elevationDeltaFromMountainAbsMin &&
    precipitation < TERRAIN_CLASSIFICATION_RULES.volcanic.precipitationMax &&
    temperature > TERRAIN_CLASSIFICATION_RULES.volcanic.temperatureMin
  ) {
    return 'volcanic';
  }
  if (
    relief < RELIEF.valleyFallbackReliefMax &&
    precipitation > RELIEF.valleyFallbackPrecipitationMin
  ) {
    return 'valley';
  }
  if (
    relief > RELIEF.hillsFallbackReliefMin &&
    cell.elevation > seaLevel + LANDFORM_ELEVATION_BANDS.hillAboveSeaMin
  ) {
    return 'hills';
  }
  return 'plains';
}

// General terrain suitability — separately tuned from
// geopolitics/population.ts's climateSuitability (population-density climate
// fitness, different ideal points/weights). See that file for why they stay
// distinct rather than merged.
function climateSuitability(precipitation: number, temperature: number) {
  const climateScore = 1 - Math.abs(temperature - 0.52) * 1.15;
  const moistureScore = 1 - Math.abs(precipitation - 0.52) * 0.95;
  return clamp(climateScore * 0.45 + moistureScore * 0.45 + 0.1, 0, 1);
}

export function getSuitabilityByLandformBiome(
  landform: TLandform,
  biome: TBiome,
  precipitation: number,
  temperature: number
): number {
  if (landform === 'marine_deep') return 0;
  if (landform === 'marine_shallow') return 0.02;
  if (landform === 'lake') return 0.12;
  if (biome === 'ice') return 0.03;
  if (biome === 'tundra') return 0.16;
  if (biome === 'desert_hot') return 0.22;
  if (biome === 'desert_cold') return 0.2;
  if (biome === 'wetland') return 0.5;

  const climate = climateSuitability(precipitation, temperature);
  let factor = 1;
  if (landform === 'plain') factor += 0.16;
  if (landform === 'valley') factor += 0.22;
  if (landform === 'coast') factor += 0.12;
  if (landform === 'hills') factor -= 0.05;
  if (landform === 'plateau') factor -= 0.08;
  if (landform === 'mountain' || landform === 'volcanic_field') factor -= 0.28;

  if (biome === 'plain') factor += 0.2;
  if (biome === 'temperate_forest') factor += 0.1;
  if (biome === 'grassland') factor += 0.08;
  if (biome === 'savanna') factor += 0.03;
  if (biome === 'boreal_forest') factor -= 0.04;
  if (biome === 'tropical_forest') factor -= 0.08;
  if (biome === 'steppe') factor -= 0.1;
  if (biome === 'montane_shrub') factor -= 0.14;

  return clamp(climate * factor, 0, 1);
}
