import { PRECIPITATION_CONFIG } from 'src/configs/map/hydrology';
import { TCell } from 'src/global';
import { clamp, dot } from 'src/services/utils/math';
import { TWindVector } from './wind';

type TPrecipitationParams = {
  cells: TCell[];
  height: number;
  seaLevel: number;
  flow: Float32Array;
  waterInfluence: Float32Array;
  windField: TWindVector[];
};

type TPrecipitationOutput = {
  precipitation: Float32Array;
  rainShadow: Float32Array;
};

function getLatitudeFactor(y: number, height: number) {
  const latitude = Math.abs((y / Math.max(1, height)) * 2 - 1);
  // Hadley circulation: ITCZ wet at equator → subtropics dry at 27° → storm tracks wet at 62° → polar dry
  const itcz = 0.24 * Math.exp(-(latitude * latitude) / 0.015);
  const subtropicsDry = -0.1 * Math.exp(-((latitude - 0.27) ** 2) / 0.008);
  const stormTracks = 0.08 * Math.exp(-((latitude - 0.62) ** 2) / 0.03);
  const poleDry = -0.06 * latitude * latitude;
  return Math.max(0, 0.14 + itcz + subtropicsDry + stormTracks + poleDry);
}

function getAlongWindGradient(cell: TCell, cells: TCell[], wind: TWindVector) {
  let numerator = 0;
  let denominator = 0;

  for (const neighborId of cell.neighbors) {
    const neighbor = cells[neighborId];
    const dx = neighbor.site[0] - cell.site[0];
    const dy = neighbor.site[1] - cell.site[1];
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.000001) continue;
    const along = dot(dx / distance, dy / distance, wind.x, wind.y);
    if (Math.abs(along) <= 0.000001) continue;

    numerator += ((neighbor.elevation - cell.elevation) / distance) * along;
    denominator += Math.abs(along);
  }

  if (denominator <= 0.000001) return 0;
  return numerator / denominator;
}

function getUpwindMoisture(cell: TCell, cells: TCell[], wind: TWindVector, moisture: Float32Array) {
  let totalWeight = 0;
  let totalMoisture = 0;

  for (const neighborId of cell.neighbors) {
    const neighbor = cells[neighborId];
    const dx = cell.site[0] - neighbor.site[0];
    const dy = cell.site[1] - neighbor.site[1];
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.000001) continue;
    const projected = dot(dx / distance, dy / distance, wind.x, wind.y);
    if (projected <= 0) continue;
    totalWeight += projected;
    totalMoisture += moisture[neighborId] * projected;
  }

  if (totalWeight <= 0) return 0;
  return totalMoisture / totalWeight;
}

export function computePrecipitation({
  cells,
  height,
  seaLevel,
  flow,
  waterInfluence,
  windField,
}: TPrecipitationParams): TPrecipitationOutput {
  const cellCount = cells.length;
  const moisture = new Float32Array(cellCount);
  const nextMoisture = new Float32Array(cellCount);
  const cloud = new Float32Array(cellCount);
  const hydro = new Float32Array(cellCount);
  const precipitation = new Float32Array(cellCount);
  const rainShadow = new Float32Array(cellCount);
  const dryMemory = new Float32Array(cellCount);

  for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
    moisture[cellIndex] = clamp(
      waterInfluence[cellIndex] * PRECIPITATION_CONFIG.moistureAdvection.maxSource,
      0,
      1
    );
  }

  for (
    let iteration = 0;
    iteration < PRECIPITATION_CONFIG.moistureAdvection.iterations;
    iteration += 1
  ) {
    for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
      const cell = cells[cellIndex];
      const wind = windField[cellIndex];
      const upwindMoisture = getUpwindMoisture(cell, cells, wind, moisture);
      const advectedMoisture =
        upwindMoisture * PRECIPITATION_CONFIG.moistureAdvection.carry +
        moisture[cellIndex] * PRECIPITATION_CONFIG.moistureAdvection.selfCarry;
      const recharge =
        waterInfluence[cellIndex] *
        PRECIPITATION_CONFIG.moistureAdvection.localRecharge *
        Math.sqrt(iteration + 1);
      const localMoisture = clamp(
        Math.max(moisture[cellIndex], advectedMoisture + recharge),
        0,
        1.25
      );

      const gradient = getAlongWindGradient(cell, cells, wind) * wind.speed * 100;
      const uplift = Math.max(0, gradient);
      const descent = Math.max(0, -gradient);

      const cloudSource = uplift * PRECIPITATION_CONFIG.orographic.upliftScale * localMoisture;
      const cloudLoss = cloud[cellIndex] / PRECIPITATION_CONFIG.microphysics.tauCloud;
      const nextCloud = Math.max(0, cloud[cellIndex] + cloudSource - cloudLoss);
      const hydroGain = cloudLoss;
      const hydroLoss = hydro[cellIndex] / PRECIPITATION_CONFIG.microphysics.tauFallout;
      const nextHydro = Math.max(0, hydro[cellIndex] + hydroGain - hydroLoss);
      const mountainRain = hydroLoss;

      const leeDrying =
        descent *
        PRECIPITATION_CONFIG.orographic.leeDryingScale *
        Math.pow(Math.max(0, localMoisture), PRECIPITATION_CONFIG.orographic.shieldingPow);

      const rainShadowIndex = clamp(
        dryMemory[cellIndex] * PRECIPITATION_CONFIG.orographic.rainShadowDecay +
          leeDrying * PRECIPITATION_CONFIG.orographic.rainShadowGain,
        0,
        1
      );

      const elevationRain = clamp(
        Math.max(0, cell.elevation - PRECIPITATION_CONFIG.orographicSimple.elevationStart) *
          PRECIPITATION_CONFIG.orographicSimple.weight,
        0,
        PRECIPITATION_CONFIG.orographicSimple.maxBonus
      );
      const latitudeRain =
        getLatitudeFactor(cell.site[1], height) * PRECIPITATION_CONFIG.baseWeights.latitude;
      const flowRain = Math.log2(flow[cellIndex] + 1) * PRECIPITATION_CONFIG.baseWeights.flow;
      const baseRain = waterInfluence[cellIndex] * PRECIPITATION_CONFIG.baseWeights.water;
      const totalPrecipitation = clamp(
        baseRain + latitudeRain + flowRain + elevationRain + mountainRain - rainShadowIndex,
        0,
        1
      );

      const consumed = cloudSource * PRECIPITATION_CONFIG.microphysics.cloudDrawdown + leeDrying;
      nextMoisture[cellIndex] = clamp(
        localMoisture - consumed + totalPrecipitation * 0.08,
        0,
        1.25
      );
      cloud[cellIndex] = nextCloud;
      hydro[cellIndex] = nextHydro;
      precipitation[cellIndex] = totalPrecipitation;
      rainShadow[cellIndex] = rainShadowIndex;
      dryMemory[cellIndex] = rainShadowIndex;
    }

    for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
      moisture[cellIndex] = nextMoisture[cellIndex];
    }
  }

  // Preserve ocean/lake humidity and avoid noisy artifacts exactly at sea level boundaries.
  for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
    const cell = cells[cellIndex];
    if (cell.isWater || cell.elevation <= seaLevel) {
      rainShadow[cellIndex] = 0;
      precipitation[cellIndex] = clamp(precipitation[cellIndex] + 0.06, 0, 1);
    }
  }

  return { precipitation, rainShadow };
}
