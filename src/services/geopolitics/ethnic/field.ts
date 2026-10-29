import { sortDescStable } from 'src/services/utils';
import { collectConnectedComponents, runMultiSourceExpansion } from 'src/services/utils/graph';
import { createSeededRandom, hashSeed } from 'src/services/utils/math';
import { TCell } from 'src/types/global';
import { TEthnicConfig } from 'src/types/geopolitics';
import Cost from '../cost';
import { edgeNoise, isLand } from '../shared';

export function getEthnicGroupCount(
  landCellCount: number,
  nationCount: number,
  config: TEthnicConfig
) {
  const byLand = Math.floor(landCellCount / 1300);
  return Math.max(
    config.majorGroupMin,
    Math.min(config.majorGroupMax, Math.max(nationCount, byLand))
  );
}

export function collectLandComponents(cells: TCell[]) {
  return collectConnectedComponents(
    cells,
    (cell) => isLand(cell),
    (_current, neighbor) => isLand(neighbor),
    true
  );
}

export function pickEthnicCoreSeeds(
  cells: TCell[],
  cellIds: number[],
  count: number,
  seed: string
) {
  const random = createSeededRandom(`${seed}:ethnic:cores`);
  const candidates = sortDescStable(
    cellIds
      .map((cellId) => cells[cellId])
      .map((cell) => {
        let score = cell.suitability * 1.3;
        if (cell.landform === 'plain' || cell.landform === 'valley') score += 1.1;
        if (cell.biome === 'temperate_forest' || cell.biome === 'tropical_forest') score += 0.35;
        if (cell.landform === 'mountain') score += 0.2;
        if (cell.isRiver || cell.isLake) score += 0.35;
        score += random() * 0.5;
        return { cellId: cell.id, score };
      })
  );

  const seeds: number[] = [];
  for (const candidate of candidates) {
    if (seeds.length >= count) break;
    const point = cells[candidate.cellId].site;
    const tooClose = seeds.some((seedCellId) => {
      const seedPoint = cells[seedCellId].site;
      const dx = point[0] - seedPoint[0];
      const dy = point[1] - seedPoint[1];
      return dx * dx + dy * dy < 4900;
    });
    if (tooClose) continue;
    seeds.push(candidate.cellId);
  }

  if (seeds.length === 0 && candidates.length > 0) seeds.push(candidates[0].cellId);
  return seeds;
}

export function buildEthnicField(
  cells: TCell[],
  owner: Int32Array,
  seedCells: number[],
  seed: string,
  config: TEthnicConfig,
  offset: number,
  allowedCells: Set<number>,
  ethnicOwner: Int32Array
) {
  const cost = new Float64Array(cells.length);
  cost.fill(Number.POSITIVE_INFINITY);
  const seedStates: Array<{ cellId: number; ethnicId: number; cost: number; distance: number }> =
    [];
  const seedHash = hashSeed(`${seed}:ethnic:frontier`);

  for (let localEthnicId = 0; localEthnicId < seedCells.length; localEthnicId += 1) {
    const cellId = seedCells[localEthnicId];
    const ethnicId = offset + localEthnicId;
    ethnicOwner[cellId] = ethnicId;
    cost[cellId] = 0;
    seedStates.push({ cellId, ethnicId, cost: 0, distance: 0 });
  }

  runMultiSourceExpansion({
    seeds: seedStates,
    getPriority: (state) => state.cost,
    isStale: (state) => state.cost > cost[state.cellId],
    expand: (current, push) => {
      for (const neighborId of cells[current.cellId].neighbors) {
        const neighbor = cells[neighborId];
        if (!allowedCells.has(neighborId) || !isLand(neighbor)) continue;

        let step = Cost.ethnic(neighbor, { strength: config.terrainInfluenceStrength });
        const borderPenalty =
          owner[current.cellId] >= 0 &&
          owner[neighborId] >= 0 &&
          owner[current.cellId] !== owner[neighborId]
            ? 1 - config.crossBorderBlend
            : 0;
        step += borderPenalty;
        if (cells[current.cellId].landform === 'mountain' && neighbor.landform === 'mountain') {
          step += config.fragmentationLevel * 0.35;
        }
        if (cells[current.cellId].isRiver || neighbor.isRiver) step += 0.3;
        if (cells[current.cellId].isLake !== neighbor.isLake) step += 0.45;
        const nextDistance = current.distance + 1;
        step += nextDistance * config.distancePenalty;
        step += (edgeNoise(seedHash, current.cellId, neighborId) - 0.5) * 0.16;
        const nextCost = current.cost + Math.max(0.2, step);

        if (nextCost < cost[neighborId]) {
          cost[neighborId] = nextCost;
          ethnicOwner[neighborId] = current.ethnicId;
          push({
            cellId: neighborId,
            ethnicId: current.ethnicId,
            cost: nextCost,
            distance: nextDistance,
          });
        }
      }
    },
  });
}
