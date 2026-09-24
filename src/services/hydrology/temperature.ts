import { TEMPERATURE_CONFIG } from 'src/configs/map/hydrology';
import { clamp, dot, hashSeed } from 'src/services/utils/math';
import { TCell } from 'src/types/global';
import { TWindVector } from './wind';

type TComputeTemperatureParams = {
  cells: TCell[];
  seaLevel: number;
  seed: string;
  waterInfluence: Float32Array;
  precipitation: Float32Array;
  flow: Float32Array;
  reliefByCell: Float32Array;
  windField: TWindVector[];
  height: number;
};

function buildMarineDistance(cells: TCell[]) {
  const distance = new Int16Array(cells.length);
  distance.fill(-1);
  const queue: number[] = [];

  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    const landform = cells[cellIndex].landform;
    if (landform !== 'marine_deep' && landform !== 'marine_shallow') continue;
    distance[cellIndex] = 0;
    queue.push(cellIndex);
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head] as number;
    head += 1;
    const nextDistance = distance[current] + 1;
    for (const neighborId of cells[current].neighbors) {
      if (distance[neighborId] >= 0) continue;
      distance[neighborId] = nextDistance;
      queue.push(neighborId);
    }
  }

  return distance;
}

function getAlongWindSlope(cell: TCell, cells: TCell[], wind: TWindVector) {
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

function smoothTemperature(cells: TCell[], temperature: Float32Array) {
  const next = new Float32Array(temperature.length);
  for (let pass = 0; pass < TEMPERATURE_CONFIG.smoothingPasses; pass += 1) {
    for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
      const cell = cells[cellIndex];
      if (cell.neighbors.length === 0) {
        next[cellIndex] = temperature[cellIndex] as number;
        continue;
      }
      let total = temperature[cellIndex];
      for (const neighborId of cell.neighbors) total += temperature[neighborId];
      next[cellIndex] = total / (cell.neighbors.length + 1);
    }
    for (let cellIndex = 0; cellIndex < temperature.length; cellIndex += 1) {
      temperature[cellIndex] = next[cellIndex] as number;
    }
  }
}

export function computeTemperature({
  cells,
  seaLevel,
  seed,
  waterInfluence,
  precipitation,
  flow,
  reliefByCell,
  windField,
  height,
}: TComputeTemperatureParams) {
  const temperature = new Float32Array(cells.length);
  const marineDistance = buildMarineDistance(cells);
  const seasonNoise = ((hashSeed(`${seed}:temperature:season`) % 10000) / 9999) * 2 - 1;
  const seasonPhase = TEMPERATURE_CONFIG.seasonPhase + seasonNoise * 0.08;
  const seasonOffset = Math.sin(Math.PI * 2 * seasonPhase) * 0.04;

  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    const cell = cells[cellIndex];
    const latitude = Math.abs((cell.site[1] / height) * 2 - 1);
    const latitudeCooling =
      Math.pow(latitude, TEMPERATURE_CONFIG.latCurve) * TEMPERATURE_CONFIG.latBase;

    const moistFactor = clamp(precipitation[cellIndex], 0, 1);
    const lapseRate =
      TEMPERATURE_CONFIG.lapseDry - moistFactor * TEMPERATURE_CONFIG.precipLapseInfluence;
    const effectiveLapse = Math.max(TEMPERATURE_CONFIG.lapseMoistMin, lapseRate);
    const elevationCooling = Math.max(0, cell.elevation - seaLevel) * effectiveLapse;

    const marineDist = marineDistance[cellIndex];
    const maritimeInfluence =
      marineDist < 0
        ? 0
        : clamp(1 - marineDist / Math.max(1, TEMPERATURE_CONFIG.maritimeRadius), 0, 1);
    const maritimeModeration =
      (waterInfluence[cellIndex] * 0.5 + maritimeInfluence * 0.5) *
      TEMPERATURE_CONFIG.maritimeStrength;

    const alongWindSlope = getAlongWindSlope(cell, cells, windField[cellIndex] as TWindVector);
    // Asymmetric: leeward descent (Föhn) warms 2.5× more than windward ascent cools
    const rawAspect = clamp(alongWindSlope * 80, -1, 1);
    const aspectCooling =
      rawAspect >= 0
        ? rawAspect * TEMPERATURE_CONFIG.aspectStrength
        : rawAspect * TEMPERATURE_CONFIG.aspectStrength * 2.5;
    const coldPool =
      Math.max(0, -reliefByCell[cellIndex]) *
      Math.max(0, 1 - flow[cellIndex] / 4) *
      TEMPERATURE_CONFIG.coldPoolStrength;

    temperature[cellIndex] = clamp(
      1 -
        latitudeCooling -
        elevationCooling +
        maritimeModeration -
        aspectCooling -
        coldPool +
        seasonOffset,
      0,
      1
    );
  }

  smoothTemperature(cells, temperature);
  return temperature;
}
