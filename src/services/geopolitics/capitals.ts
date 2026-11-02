import { GEOPOLITICAL_CONFIG } from 'src/configs/map/geopolitics';
import { LANDFORM_CONFIG } from 'src/configs/map/landform-biome';
import { getMetricRange } from 'src/services/utils';
import { isWaterOrRiverCell } from 'src/services/utils/cell';
import { buildDistanceMap, collectConnectedComponents } from 'src/services/utils/graph';
import { normalize } from 'src/services/utils/math';
import { TCell, TNation } from 'src/types/global';
import { CAPITAL_VIEWPORT_MARGIN, createRegionalName, isLand } from './shared';

type TNationProfile = Pick<TNation, 'populationMultiplier' | 'economyMultiplier'>;

const T_COMPONENT_SHARE_THRESHOLD = 0.3;
const T_STRICT_VIEWPORT_MARGIN = CAPITAL_VIEWPORT_MARGIN + 8;
const T_STRICT_BORDER_DISTANCE_MIN = 2;
// Cells at least this share of the nation's biggest population may be capital even near a border.
const T_MAIN_CITY_SHARE = 0.85;

function getDistanceMap(
  cells: TCell[],
  nationLand: Set<number>,
  sourcePredicate: (cellId: number) => boolean
) {
  return buildDistanceMap(cells, {
    isSeed: (cellId) => nationLand.has(cellId) && sourcePredicate(cellId),
    canVisit: (neighborId) => nationLand.has(neighborId),
  });
}

function getNationComponents(cells: TCell[], owner: Int32Array, nationId: number) {
  return collectConnectedComponents(
    cells,
    (cell) => owner[cell.id] === nationId && isLand(cell),
    (_current, neighbor) => owner[neighbor.id] === nationId && isLand(neighbor),
    true
  );
}

function waterProximityScore(cell: TCell, cells: TCell[]) {
  for (const neighborId of cell.neighbors) {
    const neighbor = cells[neighborId];
    if (isWaterOrRiverCell(neighbor)) return 1;
  }

  const visitedWater = new Set<number>();
  for (const neighborId of cell.neighbors) {
    for (const secondNeighborId of cells[neighborId].neighbors) {
      const secondNeighbor = cells[secondNeighborId];
      if (isWaterOrRiverCell(secondNeighbor)) visitedWater.add(secondNeighborId);
    }
  }
  return Math.min(0.85, visitedWater.size * 0.08);
}

function getNationCandidateCellIds(components: number[][]) {
  const totalLand = components.reduce((sum, component) => sum + component.length, 0);
  if (totalLand === 0) return [];

  const selected = components.filter(
    (component) => component.length / totalLand >= T_COMPONENT_SHARE_THRESHOLD
  );
  if (selected.length > 0) return selected.flat();
  return components[0] || [];
}

function exponentialEdgePenalty(distance: number, radius: number, penaltyBase: number) {
  if (distance < 0) return 0;
  if (distance > radius) return 0;
  return penaltyBase * Math.exp((radius - distance) * 0.95);
}

// Capitals may sit on a coast or a river; they only avoid hugging a land border.
function getBorderSafetyScore(borderDistance: number) {
  if (borderDistance < 0) return 0.5;
  const norm = Math.min(1, borderDistance / 6);
  return norm - exponentialEdgePenalty(borderDistance, 2, 0.5);
}

function getNationConnectivityScore(cell: TCell, nationLand: Set<number>) {
  let sameNationNeighbors = 0;
  for (const neighborId of cell.neighbors) {
    if (nationLand.has(neighborId)) sameNationNeighbors += 1;
  }
  return sameNationNeighbors;
}

function scoreCapital(
  cell: TCell,
  population: number,
  economy: number,
  connectivity: number,
  borderDistanceMap: Int32Array,
  waterAccess: number,
  mapWidth: number,
  mapHeight: number
) {
  const borderSafety = getBorderSafetyScore(borderDistanceMap[cell.id]);

  const edgeDistance = Math.min(
    cell.site[0],
    mapWidth - cell.site[0],
    cell.site[1],
    mapHeight - cell.site[1]
  );
  const edgeSafety =
    edgeDistance < CAPITAL_VIEWPORT_MARGIN
      ? -0.9
      : edgeDistance >= CAPITAL_VIEWPORT_MARGIN + 6
        ? 0.1
        : 0;
  const safetyScore = LANDFORM_CONFIG[cell.landform].safetyScore;
  const terrainFlatness = LANDFORM_CONFIG[cell.landform].terrainFlatness;
  const terrainBias =
    terrainFlatness * 0.65 + (cell.landform === 'plain' || cell.landform === 'valley' ? 0.35 : 0);
  const adjustedSafety = safetyScore * 0.6 + terrainBias * 0.4 + edgeSafety * 0.15;

  // The biggest and richest place wins, helped by water (trade, farming) and a safe interior.
  return (
    population * 0.55 +
    economy * 0.15 +
    waterAccess * 0.15 +
    borderSafety * 0.1 +
    adjustedSafety * 0.03 +
    connectivity * 0.02
  );
}

function economicHubScore(cell: TCell, cells: TCell[], population: number, economy: number) {
  const geoScore =
    cell.landform === 'plain' || cell.landform === 'valley'
      ? 0.95
      : cell.landform === 'hills' || cell.landform === 'plateau'
        ? 0.68
        : cell.landform === 'coast'
          ? 0.8
          : 0.38;
  const waterScore = waterProximityScore(cell, cells);
  return population * 0.35 + economy * 0.4 + geoScore * 0.15 + waterScore * 0.1;
}

function isInBounds(cell: TCell, mapWidth: number, mapHeight: number) {
  return (
    cell.site[0] >= T_STRICT_VIEWPORT_MARGIN &&
    cell.site[0] <= mapWidth - T_STRICT_VIEWPORT_MARGIN &&
    cell.site[1] >= T_STRICT_VIEWPORT_MARGIN &&
    cell.site[1] <= mapHeight - T_STRICT_VIEWPORT_MARGIN
  );
}

export function pickEconomicAndCapital(
  cells: TCell[],
  owner: Int32Array,
  seed: string,
  mapWidth: number,
  mapHeight: number,
  nationProfiles: Map<number, TNationProfile>
): TNation[] {
  const nationIds = Array.from(new Set(owner)).filter((nationId) => nationId >= 0);
  return nationIds.map((nationId) => {
    const components = getNationComponents(cells, owner, nationId);
    const candidateCellIds = getNationCandidateCellIds(components);
    const nationLand = new Set(candidateCellIds);
    const nationCells = candidateCellIds.map((cellId) => cells[cellId]);
    const safeNationCells = nationCells.filter((cell) => isInBounds(cell, mapWidth, mapHeight));
    const candidateNationCells = safeNationCells.length > 0 ? safeNationCells : nationCells;
    const landSize = nationCells.length;

    let hubCount = 1;
    if (landSize >= GEOPOLITICAL_CONFIG.hubs.mediumNationMinLand) hubCount = 3;
    else if (landSize >= GEOPOLITICAL_CONFIG.hubs.smallNationMinLand) hubCount = 2;
    hubCount = Math.min(hubCount, GEOPOLITICAL_CONFIG.hubs.maxHubsPerNation);

    const borderDistanceMap = getDistanceMap(cells, nationLand, (cellId) => {
      for (const neighborId of cells[cellId].neighbors) {
        if (!nationLand.has(neighborId)) return true;
      }
      return false;
    });
    const coastDistanceMap = getDistanceMap(cells, nationLand, (cellId) => {
      for (const neighborId of cells[cellId].neighbors) {
        if (!isLand(cells[neighborId])) return true;
      }
      return false;
    });

    const strictInteriorCells = candidateNationCells.filter((cell) => {
      const borderDistance = borderDistanceMap[cell.id];
      const coastDistance = coastDistanceMap[cell.id];
      return (
        borderDistance >= T_STRICT_BORDER_DISTANCE_MIN &&
        coastDistance >= 0 &&
        getNationConnectivityScore(cell, nationLand) >= 2
      );
    });
    // A nation's main city is its capital even close to a border; only a much smaller place
    // is passed over for being safer.
    const biggestPopulation = candidateNationCells.reduce(
      (max, cell) => Math.max(max, cell.population),
      0
    );
    const strictIds = new Set(strictInteriorCells.map((cell) => cell.id));
    const scoredCandidateCells =
      strictInteriorCells.length > 0
        ? candidateNationCells.filter(
            (cell) =>
              strictIds.has(cell.id) || cell.population >= biggestPopulation * T_MAIN_CITY_SHARE
          )
        : candidateNationCells;

    const populationValues = scoredCandidateCells.map((cell) => Math.max(0, cell.population));
    const economyValues = scoredCandidateCells.map((cell) => Math.max(0, cell.economy));
    const connectivityValues = scoredCandidateCells.map((cell) =>
      getNationConnectivityScore(cell, nationLand)
    );
    const populationRange = getMetricRange(populationValues);
    const economyRange = getMetricRange(economyValues);
    const connectivityRange = getMetricRange(connectivityValues);

    const capitalCandidates = scoredCandidateCells
      .map((cell) => {
        const population = normalize(
          Math.max(0, cell.population),
          populationRange.min,
          populationRange.max
        );
        const economy = normalize(Math.max(0, cell.economy), economyRange.min, economyRange.max);
        const connectivity = normalize(
          getNationConnectivityScore(cell, nationLand),
          connectivityRange.min,
          connectivityRange.max
        );
        return {
          cellId: cell.id,
          score: scoreCapital(
            cell,
            population,
            economy,
            connectivity,
            borderDistanceMap,
            waterProximityScore(cell, cells),
            mapWidth,
            mapHeight
          ),
        };
      })
      .sort((a, b) => b.score - a.score);

    // The best-scoring place is the capital; no dice, so the capital is the nation's main city.
    let capitalCellId: number | null = capitalCandidates[0]?.cellId ?? null;

    const hubScored = scoredCandidateCells
      .map((cell) => {
        const population = normalize(
          Math.max(0, cell.population),
          populationRange.min,
          populationRange.max
        );
        const economy = normalize(Math.max(0, cell.economy), economyRange.min, economyRange.max);
        let score = economicHubScore(cell, cells, population, economy);

        if (capitalCellId !== null) {
          const capitalSite = cells[capitalCellId].site;
          const distToCapital = Math.hypot(
            cell.site[0] - capitalSite[0],
            cell.site[1] - capitalSite[1]
          );
          if (distToCapital < 45) score -= 0.12;
          else if (distToCapital < 70) score -= 0.05;
        }
        return { cellId: cell.id, score };
      })
      .sort((a, b) => b.score - a.score);

    const hubCellIds: number[] = [];
    for (const entry of hubScored) {
      if (hubCellIds.length >= hubCount) break;
      const candidateSite = cells[entry.cellId].site;
      const tooClose = hubCellIds.some((hubCellId) => {
        const hubSite = cells[hubCellId].site;
        return Math.hypot(candidateSite[0] - hubSite[0], candidateSite[1] - hubSite[1]) < 60;
      });
      if (tooClose) continue;
      hubCellIds.push(entry.cellId);
    }

    if (hubCellIds.length === 0 && hubScored.length > 0) hubCellIds.push(hubScored[0].cellId);

    if (capitalCellId === null && candidateNationCells.length > 0) {
      capitalCellId = candidateNationCells[0].id;
    }
    const nationName = createRegionalName(seed, 'nation', nationId);
    const profile = nationProfiles.get(nationId);

    return {
      id: nationId,
      name: nationName,
      populationMultiplier: profile?.populationMultiplier ?? 1,
      economyMultiplier: profile?.economyMultiplier ?? 1,
      capitalCellId,
      capitalCoords: capitalCellId !== null ? cells[capitalCellId].site : null,
      economicHubIds: hubCellIds,
      economicHubPoints: hubCellIds.map((cellId) => cells[cellId].site),
    };
  });
}
