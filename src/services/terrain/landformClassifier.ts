import { LANDFORM_CLASSIFIER_CONFIG, LANDFORM_ELEVATION_BANDS } from 'src/configs/map/terrain';
import { classifyLandformWater } from 'src/services/utils/cell';
import { clamp } from 'src/services/utils/math';
import { TCell, TLandform, TTerrain } from 'src/types/global';

type TClassifyLandformsParams = {
  cells: TCell[];
  seaLevel: number;
  reliefByCell: Float32Array;
  flow: Float32Array;
  terrains: TTerrain[];
};

const TERRAIN_CODE = { COAST: 1, VOLCANIC: 2 };

function toTerrainCode(terrain: TTerrain) {
  if (terrain === 'coast') return TERRAIN_CODE.COAST;
  if (terrain === 'volcanic') return TERRAIN_CODE.VOLCANIC;
  return 0;
}

function buildMarineNeighborMask(cells: TCell[]) {
  const mask = new Uint8Array(cells.length);
  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    const cell = cells[cellIndex];
    for (const neighborId of cell.neighbors) {
      const neighbor = cells[neighborId];
      if (!neighbor.isWater || neighbor.isLake) continue;
      mask[cellIndex] = 1;
      break;
    }
  }
  return mask;
}

function getSlopeSignal(relief: number) {
  return clamp(relief * 12, -1, 1);
}

function getFlowSignal(localFlow: number) {
  return clamp(Math.log2(localFlow + 1) / 5, 0, 1);
}

function isValleyContext(
  cell: TCell,
  cells: TCell[],
  elevationAboveSea: number,
  slopeSignal: number,
  flowSignal: number,
  seaLevel: number
) {
  const model = LANDFORM_CLASSIFIER_CONFIG;
  if (elevationAboveSea > LANDFORM_ELEVATION_BANDS.valleyAboveSeaMax) return false;
  if (slopeSignal > model.valleyMax) return false;
  if (flowSignal < model.valleyMinFlowSignal) return false;

  let validNeighbors = 0;
  let higherNeighbors = 0;
  for (const neighborId of cell.neighbors) {
    const neighbor = cells[neighborId];
    if (neighbor.isWater || neighbor.isLake) continue;
    validNeighbors += 1;
    const higherDelta = neighbor.elevation - cell.elevation;
    if (
      higherDelta >= model.valleyMinHigherNeighborDelta &&
      neighbor.elevation - seaLevel >= elevationAboveSea
    ) {
      higherNeighbors += 1;
    }
  }

  if (validNeighbors === 0) return false;
  return higherNeighbors / validNeighbors >= model.valleyEnclosureMinRatio;
}

function classifyLandform(
  cell: TCell,
  relief: number,
  flowSignal: number,
  seaLevel: number,
  terrainCode: number,
  cells: TCell[],
  hasMarineNeighbor: boolean
): TLandform {
  const model = LANDFORM_CLASSIFIER_CONFIG;
  const waterLandform = classifyLandformWater(cell, seaLevel, 0.12);

  if (waterLandform !== null) return waterLandform;

  if (
    cell.elevation <= seaLevel + LANDFORM_ELEVATION_BANDS.coastAboveSeaMax ||
    terrainCode === TERRAIN_CODE.COAST ||
    hasMarineNeighbor
  ) {
    return 'coast';
  }

  const elevationAboveSea = Math.max(0, cell.elevation - seaLevel);
  const slopeSignal = getSlopeSignal(relief);
  const inHighland = elevationAboveSea >= LANDFORM_ELEVATION_BANDS.highlandAboveSeaMin;
  const inMountainBand = elevationAboveSea >= LANDFORM_ELEVATION_BANDS.mountainAboveSeaMin;

  const scoreMountain = elevationAboveSea * 1.25 + Math.max(0, slopeSignal) * 0.85;
  const scoreHills = elevationAboveSea * 0.7 + Math.max(0, slopeSignal) * 0.95;
  const scorePlateau = elevationAboveSea * 1.05 + Math.max(0, 0.45 - Math.abs(slopeSignal)) * 0.65;
  const scoreValley = Math.max(0, -slopeSignal) * 0.95 + flowSignal * 0.75;
  const scorePlain =
    Math.max(0, 0.8 - Math.abs(slopeSignal)) * 0.9 + Math.max(0, 0.6 - elevationAboveSea) * 0.5;
  const scoreVolcanic =
    (terrainCode === TERRAIN_CODE.VOLCANIC ? 1 : 0) * 1.3 +
    Math.max(0, elevationAboveSea - 0.22) * 0.8 +
    Math.max(0, slopeSignal - 0.12) * 0.5;

  const allowPlain = elevationAboveSea <= LANDFORM_ELEVATION_BANDS.plainAboveSeaMax && !inHighland;
  const allowValley = isValleyContext(
    cell,
    cells,
    elevationAboveSea,
    slopeSignal,
    flowSignal,
    seaLevel
  );
  const allowHills = !inMountainBand;
  const allowPlateau = true;
  const allowMountain = inMountainBand || slopeSignal >= model.mountainMinSlope;
  const allowVolcanic =
    terrainCode === TERRAIN_CODE.VOLCANIC &&
    elevationAboveSea >= LANDFORM_ELEVATION_BANDS.volcanicAboveSeaMin;

  let best: TLandform = inHighland ? 'plateau' : 'plain';
  let bestScore = allowPlain ? scorePlain : Number.NEGATIVE_INFINITY;

  if (!allowPlain && allowHills) {
    best = 'hills';
    bestScore = scoreHills;
  }
  if (allowValley && scoreValley > bestScore) {
    best = 'valley';
    bestScore = scoreValley;
  }
  if (allowHills && scoreHills > bestScore) {
    best = 'hills';
    bestScore = scoreHills;
  }

  const plateauBonus =
    inHighland && Math.abs(slopeSignal) <= model.plateauFlatnessMaxAbsSlope ? 0.5 : 0;
  if (allowPlateau && scorePlateau + plateauBonus > bestScore) {
    best = 'plateau';
    bestScore = scorePlateau + plateauBonus;
  }

  const mountainBonus = inMountainBand ? 0.45 : 0;
  if (allowMountain && scoreMountain + mountainBonus > bestScore) {
    best = 'mountain';
    bestScore = scoreMountain + mountainBonus;
  }

  if (allowVolcanic && scoreVolcanic > bestScore) {
    best = 'volcanic_field';
  }

  if (best === 'plateau' && cell.elevation >= 0.9) {
    return 'mountain';
  }

  return best;
}

export function classifyLandforms(params: TClassifyLandformsParams): TLandform[] {
  const { cells, seaLevel, reliefByCell, flow, terrains } = params;
  const flowSignalByCell = new Float32Array(flow.length);
  const terrainCodeByCell = new Uint8Array(terrains.length);
  const marineNeighborMask = buildMarineNeighborMask(cells);
  for (let cellIndex = 0; cellIndex < terrains.length; cellIndex += 1) {
    terrainCodeByCell[cellIndex] = toTerrainCode(terrains[cellIndex] as TTerrain);
  }
  for (let cellIndex = 0; cellIndex < flow.length; cellIndex += 1) {
    flowSignalByCell[cellIndex] = getFlowSignal(flow[cellIndex] as number);
  }

  return cells.map((cell, cellIndex) =>
    classifyLandform(
      cell,
      reliefByCell[cellIndex] as number,
      flowSignalByCell[cellIndex] as number,
      seaLevel,
      terrainCodeByCell[cellIndex] as number,
      cells,
      marineNeighborMask[cellIndex] === 1
    )
  );
}
