import { EROSION_CONFIG, HYDROLOGY_CONFIG, LAKE_CONFIG } from 'src/configs/map/hydrology';
import { TCell, TDelaunayMesh, THydrologyParams, TTerrain } from 'src/global';
import {
  buildWaterInfluence,
  classifyTerrain,
  getSuitabilityByLandformBiome,
} from 'src/services/hydrology/climate';
import {
  classifyInlandWater,
  expandLakes,
  filterAndLimitLakes,
} from 'src/services/hydrology/lakes';
import { computePrecipitation } from 'src/services/hydrology/precipitation';
import { generateRivers, sortIndicesByElevation } from 'src/services/hydrology/river';
import { computeTemperature } from 'src/services/hydrology/temperature';
import { buildWindField } from 'src/services/hydrology/wind';
import { getAvgNeighbor } from 'src/services/utils/cell';
import { clamp } from 'src/services/utils/math';
import { classifyBiomes } from '../terrain/biomeClassifier';
import { classifyLandforms } from '../terrain/landformClassifier';

const T_COAST_OUTLET = HYDROLOGY_CONFIG.coastOutletId;

function applyTemperatureControl(value: number, offset: number, contrast: number) {
  return clamp((value - 0.5) * contrast + 0.5 + offset, 0, 1);
}

function applyPrecipitationControl(value: number, offset: number, scale: number) {
  return clamp(value * scale + offset, 0, 1);
}

// ─── Lightweight typed cell clone ──────────────────────────────────────────────
// Avoids spread-operator overhead by direct property assignment.
function cloneCellWithHydrology(cell: TCell, overrides: Partial<TCell>): TCell {
  return {
    id: cell.id,
    site: cell.site,
    polygon: cell.polygon,
    vertexIds: cell.vertexIds,
    edgeIds: cell.edgeIds,
    neighbors: cell.neighbors,
    ...overrides,
  } as TCell;
}

function runHydrologyInternal({
  mesh,
  seaLevel,
  seed,
  climateControl,
}: THydrologyParams): TDelaunayMesh {
  const cellCount = mesh.cells.length;
  const elevations = new Float32Array(cellCount);
  const adjustedElevations = new Float32Array(cellCount);
  const flow = new Float32Array(cellCount);
  const effectiveFlow = new Float32Array(cellCount);
  const erosion = new Float32Array(cellCount);
  const deposit = new Float32Array(cellCount);
  const downstream = new Int32Array(cellCount);
  const isLake = new Uint8Array(cellCount);
  const isRiver = new Uint8Array(cellCount);

  downstream.fill(-1);

  for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
    elevations[cellIndex] = mesh.cells[cellIndex].elevation;
    adjustedElevations[cellIndex] = mesh.cells[cellIndex].elevation;
    flow[cellIndex] = mesh.cells[cellIndex].isWater ? 0 : 1;
    effectiveFlow[cellIndex] = 0;
  }

  for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
    const cell = mesh.cells[cellIndex];
    if (cell.isWater) continue;

    let nextCellId = -1;
    let nextElevation = elevations[cellIndex];
    let hasWaterNeighbor = false;

    for (const neighborId of cell.neighbors) {
      const neighbor = mesh.cells[neighborId];

      if (neighbor.isWater) {
        hasWaterNeighbor = true;
        continue;
      }

      if (elevations[neighborId] < nextElevation) {
        nextElevation = elevations[neighborId];
        nextCellId = neighborId;
      }
    }

    if (nextCellId >= 0) {
      downstream[cellIndex] = nextCellId;
    } else if (hasWaterNeighbor) {
      downstream[cellIndex] = T_COAST_OUTLET;
    }
  }

  const sortedIndices = sortIndicesByElevation(elevations);
  for (const cellIndex of sortedIndices) {
    const downstreamId = downstream[cellIndex];
    if (downstreamId >= 0) flow[downstreamId] += flow[cellIndex];
  }

  for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
    const cell = mesh.cells[cellIndex];
    const downstreamId = downstream[cellIndex];
    const isSink = downstreamId === -1 && !cell.isWater;
    const slope =
      downstreamId >= 0 ? Math.max(0, elevations[cellIndex] - elevations[downstreamId]) : 0;

    const erosionAmount =
      cell.isWater || isSink
        ? 0
        : Math.min(
            EROSION_CONFIG.maxAmount,
            slope * EROSION_CONFIG.slopeWeight +
              Math.log2(flow[cellIndex] + 1) * EROSION_CONFIG.flowWeight
          );

    erosion[cellIndex] = erosionAmount;

    if (downstreamId >= 0) {
      deposit[downstreamId] += erosionAmount * EROSION_CONFIG.depositRate;
    }

    if (isSink && flow[cellIndex] > LAKE_CONFIG.sinkFlowMin) {
      isLake[cellIndex] = 1;
    }
  }

  for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
    adjustedElevations[cellIndex] = clamp(
      elevations[cellIndex] - erosion[cellIndex] + deposit[cellIndex],
      0,
      1
    );
  }

  const cells = mesh.cells.map((cell, cellIndex) => {
    return cloneCellWithHydrology(cell, {
      elevation: adjustedElevations[cellIndex],
      isWater: cell.isWater || isLake[cellIndex] === 1,
      flow: flow[cellIndex],
      effectiveFlow: effectiveFlow[cellIndex],
      riverWidth: 0,
      downstreamId: downstream[cellIndex] >= 0 ? downstream[cellIndex] : null,
      erosion: erosion[cellIndex],
      isRiver: false,
      riverId: null,
      riverOrder: 0,
      isRiverSource: false,
      isRiverMouth: false,
      isLake: isLake[cellIndex] === 1,
      landform: 'plain',
      temperature: 0,
      precipitation: 0,
      rainShadow: 0,
      petProxy: 0,
      aridityIndex: 0,
      temperatureSeasonality: 0,
      precipitationSeasonality: 0,
      population: 0,
      economy: 0,
      waterAccessScore: 0,
      biome: 'unknown',
      suitability: 0,
      nationId: null,
      provinceId: null,
      ethnicId: null,
      zoneType: 'international-waters' as const,
      isCapital: false,
      isEconomicHub: false,
    });
  });
  const neighborsByCell = cells.map((cell) => cell.neighbors);

  const waterInfluence = buildWaterInfluence(cells);
  const reliefByCell = new Float32Array(cells.length);
  const windField = buildWindField(cells, mesh.height, seed);
  const advancedPrecipitation = computePrecipitation({
    cells,
    height: mesh.height,
    seaLevel,
    flow,
    waterInfluence,
    windField,
  });

  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    const cell = cells[cellIndex];
    const neighborAverage = getAvgNeighbor(cell, cells);
    reliefByCell[cellIndex] = cell.elevation - neighborAverage;
  }

  const temperatureByCell = computeTemperature({
    cells,
    seaLevel,
    seed,
    waterInfluence,
    precipitation: advancedPrecipitation.precipitation,
    flow,
    reliefByCell,
    windField,
    height: mesh.height,
  });
  const terrains = new Array<TTerrain>(cells.length);
  const aridityIndexByCell = new Float32Array(cells.length);
  const petByCell = new Float32Array(cells.length);
  const tempSeasonalityByCell = new Float32Array(cells.length);
  const precipSeasonalityByCell = new Float32Array(cells.length);
  const elevationAboveSeaByCell = new Float32Array(cells.length);
  const temperatureByCellExact = new Array<number>(cells.length);
  const precipitationByCellExact = new Array<number>(cells.length);
  const rainShadowByCellExact = new Array<number>(cells.length);
  const petByCellExact = new Array<number>(cells.length);
  const aridityByCellExact = new Array<number>(cells.length);
  const tempSeasonalityByCellExact = new Array<number>(cells.length);
  const precipSeasonalityByCellExact = new Array<number>(cells.length);
  const rainShadowByCell = new Float32Array(cells.length);
  const temperatureAdjustedByCell = new Float32Array(cells.length);
  const precipitationAdjustedByCell = new Float32Array(cells.length);

  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    const cell = cells[cellIndex];
    const temperatureRaw = temperatureByCell[cellIndex] as number;
    const temperature = applyTemperatureControl(
      temperatureRaw,
      climateControl.temperatureOffset,
      climateControl.temperatureContrast
    );
    const rainShadow = advancedPrecipitation.rainShadow[cellIndex];
    const precipitationRaw = advancedPrecipitation.precipitation[cellIndex];
    const precipitation = applyPrecipitationControl(
      precipitationRaw,
      climateControl.precipitationOffset,
      climateControl.precipitationScale
    );

    const relief = reliefByCell[cellIndex];
    const terrainTag = classifyTerrain(
      cell,
      seaLevel,
      temperature,
      precipitation,
      rainShadow,
      relief
    );
    terrains[cellIndex] = terrainTag;
    const petProxy = clamp(
      0.22 + temperature * 0.78 + Math.max(0, 1 - waterInfluence[cellIndex]) * 0.1,
      0.05,
      1.2
    );
    const aridityIndex = clamp(precipitation / Math.max(petProxy, 0.0001), 0, 2);
    const temperatureSeasonality = clamp(
      Math.abs(cell.site[1] / mesh.height - 0.5) * 2 * 0.35 +
        Math.max(0, 1 - waterInfluence[cellIndex]) * 0.15,
      0,
      1
    );
    const precipitationSeasonality = clamp(
      0.2 + rainShadow * 0.5 + Math.max(0, 1 - precipitation) * 0.2,
      0,
      1
    );
    const elevationAboveSea = Math.max(0, cell.elevation - seaLevel);

    temperatureByCellExact[cellIndex] = temperature;
    precipitationByCellExact[cellIndex] = precipitation;
    rainShadowByCellExact[cellIndex] = rainShadow;
    petByCellExact[cellIndex] = petProxy;
    aridityByCellExact[cellIndex] = aridityIndex;
    tempSeasonalityByCellExact[cellIndex] = temperatureSeasonality;
    precipSeasonalityByCellExact[cellIndex] = precipitationSeasonality;
    rainShadowByCell[cellIndex] = rainShadow;
    temperatureAdjustedByCell[cellIndex] = temperature;
    precipitationAdjustedByCell[cellIndex] = precipitation;
    aridityIndexByCell[cellIndex] = aridityIndex;
    petByCell[cellIndex] = petProxy;
    tempSeasonalityByCell[cellIndex] = temperatureSeasonality;
    precipSeasonalityByCell[cellIndex] = precipitationSeasonality;
    elevationAboveSeaByCell[cellIndex] = elevationAboveSea;
  }

  const landforms = classifyLandforms({
    cells,
    seaLevel,
    reliefByCell,
    flow,
    terrains,
  });
  const latitudeByCell = new Float32Array(cellCount);
  for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
    const site = mesh.cells[cellIndex].site;
    latitudeByCell[cellIndex] = Math.abs((site[1] / Math.max(1, mesh.height)) * 2 - 1);
  }
  const biomes = classifyBiomes({
    landforms,
    temperature: temperatureAdjustedByCell,
    precipitation: precipitationAdjustedByCell,
    aridityIndex: aridityIndexByCell,
    temperatureSeasonality: tempSeasonalityByCell,
    precipitationSeasonality: precipSeasonalityByCell,
    elevationAboveSea: elevationAboveSeaByCell,
    flow,
    neighborsByCell,
    isRiverByCell: isRiver,
    isLakeByCell: isLake,
    humanImpact: climateControl.humanImpact,
    latitudeByCell,
  });
  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    const cell = cells[cellIndex];
    const landform = landforms[cellIndex] as NonNullable<(typeof landforms)[number]>;
    const biome = biomes[cellIndex] as NonNullable<(typeof biomes)[number]>;
    cell.landform = landform;
    cell.biome = biome;
    cell.temperature = temperatureByCellExact[cellIndex] as number;
    cell.precipitation = precipitationByCellExact[cellIndex] as number;
    cell.rainShadow = rainShadowByCellExact[cellIndex] as number;
    cell.petProxy = petByCellExact[cellIndex] as number;
    cell.aridityIndex = aridityByCellExact[cellIndex] as number;
    cell.temperatureSeasonality = tempSeasonalityByCellExact[cellIndex] as number;
    cell.precipitationSeasonality = precipSeasonalityByCellExact[cellIndex] as number;
  }

  expandLakes(cells, flow, downstream);
  filterAndLimitLakes(cells, flow);
  classifyInlandWater(cells, mesh.width, mesh.height, seaLevel, downstream);

  const precipitation = new Float32Array(cells.length);
  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    precipitation[cellIndex] = cells[cellIndex].precipitation;
  }

  const result = generateRivers(cells, seaLevel, precipitation, seed);

  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    flow[cellIndex] = result.flow[cellIndex];
    effectiveFlow[cellIndex] = result.effectiveFlow[cellIndex];
    downstream[cellIndex] = result.downstream[cellIndex];
    const cell = cells[cellIndex];
    const riverId = result.riverByCell[cellIndex];
    cell.flow = flow[cellIndex];
    cell.effectiveFlow = effectiveFlow[cellIndex];
    cell.downstreamId = downstream[cellIndex] >= 0 ? downstream[cellIndex] : null;
    cell.riverId = riverId >= 0 ? riverId : null;
    cell.isRiver = riverId >= 0;
    cell.riverWidth = riverId >= 0 ? result.riverWidthByCell[cellIndex] : 0;
    isRiver[cellIndex] = riverId >= 0 ? 1 : 0;
  }

  const riverSource = new Set<number>();
  const riverMouth = new Set<number>();
  for (const river of result.rivers) {
    riverSource.add(river.sourceCellId);
    riverMouth.add(river.mouthCellId);
  }
  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    cells[cellIndex].isRiverSource = riverSource.has(cellIndex);
    cells[cellIndex].isRiverMouth = riverMouth.has(cellIndex);
    cells[cellIndex].riverOrder = cells[cellIndex].isRiver ? 1 : 0;
  }

  mesh.rivers = result.rivers;

  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    const cell = cells[cellIndex];
    cell.suitability = getSuitabilityByLandformBiome(
      cell.landform,
      cell.biome,
      cell.precipitation,
      cell.temperature
    );
  }

  return { ...mesh, cells, rivers: mesh.rivers ?? [] };
}

export function buildHydrology({
  mesh,
  seaLevel,
  seed,
  climateControl,
}: THydrologyParams): TDelaunayMesh {
  return runHydrologyInternal({ mesh, seaLevel, seed, climateControl });
}
