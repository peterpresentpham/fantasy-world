import { createSeededRandom } from 'src/services/utils/math';
import { TCell } from 'src/types/global';
import { TEthnicConfig } from 'src/types/geopolitics';
import { isLand } from '../shared';

export function smoothEthnicRegions(
  cells: TCell[],
  ethnicOwner: Int32Array,
  config: TEthnicConfig
) {
  for (let pass = 0; pass < config.smoothingPasses; pass += 1) {
    const next = Int32Array.from(ethnicOwner);
    for (let cellId = 0; cellId < cells.length; cellId += 1) {
      if (!isLand(cells[cellId])) continue;
      const counts = new Map<number, number>();
      for (const neighborId of cells[cellId].neighbors) {
        const ethnicId = ethnicOwner[neighborId];
        if (ethnicId < 0) continue;
        counts.set(ethnicId, (counts.get(ethnicId) || 0) + 1);
      }
      let bestId = ethnicOwner[cellId];
      let bestCount = counts.get(bestId) || 0;
      for (const [candidateId, count] of counts) {
        if (count > bestCount) {
          bestCount = count;
          bestId = candidateId;
        }
      }
      if (bestId !== ethnicOwner[cellId] && bestCount >= 3) {
        next[cellId] = bestId;
      }
    }
    ethnicOwner.set(next);
  }
}

export function smoothCrossBorderEthnics(
  cells: TCell[],
  nationOwner: Int32Array,
  ethnicOwner: Int32Array,
  config: TEthnicConfig
) {
  const iterations = Math.max(2, Math.floor(2 + config.crossBorderBlend * 3));
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = Int32Array.from(ethnicOwner);
    for (let cellId = 0; cellId < cells.length; cellId += 1) {
      if (!isLand(cells[cellId])) continue;
      const currentNationId = nationOwner[cellId];
      if (currentNationId < 0) continue;

      const crossBorderCounts = new Map<number, number>();
      const localCounts = new Map<number, number>();
      for (const neighborId of cells[cellId].neighbors) {
        if (!isLand(cells[neighborId])) continue;
        const ethnicId = ethnicOwner[neighborId];
        if (ethnicId < 0) continue;
        if (nationOwner[neighborId] === currentNationId) {
          localCounts.set(ethnicId, (localCounts.get(ethnicId) || 0) + 1);
        } else {
          crossBorderCounts.set(ethnicId, (crossBorderCounts.get(ethnicId) || 0) + 1);
        }
      }

      let bestEthnicId = ethnicOwner[cellId];
      let bestScore = -Infinity;
      const candidateIds = new Set<number>([
        ...Array.from(localCounts.keys()),
        ...Array.from(crossBorderCounts.keys()),
      ]);
      for (const ethnicId of candidateIds) {
        const localSupport = localCounts.get(ethnicId) || 0;
        const crossSupport = crossBorderCounts.get(ethnicId) || 0;
        const mountainBridge =
          cells[cellId].landform === 'mountain' || cells[cellId].landform === 'hills' ? 0.35 : 0;
        const score = localSupport + crossSupport * (1 + config.crossBorderBlend) + mountainBridge;
        if (score > bestScore) {
          bestScore = score;
          bestEthnicId = ethnicId;
        }
      }
      if (bestEthnicId !== ethnicOwner[cellId] && bestScore >= 2) {
        next[cellId] = bestEthnicId;
      }
    }
    ethnicOwner.set(next);
  }
}

export function expandCrossBorderEthnics(
  cells: TCell[],
  nationOwner: Int32Array,
  ethnicOwner: Int32Array,
  seed: string,
  config: TEthnicConfig
) {
  const random = createSeededRandom(`${seed}:ethnic:deep-cross-border`);
  const iterations = Math.max(2, Math.floor(3 + config.crossBorderBlend * 4));
  const maxDepth = Math.max(2, Math.floor(3 + config.crossBorderBlend * 3));

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = Int32Array.from(ethnicOwner);
    for (let cellId = 0; cellId < cells.length; cellId += 1) {
      if (!isLand(cells[cellId])) continue;
      const nationId = nationOwner[cellId];
      if (nationId < 0) continue;

      const borderEthnicCounts = new Map<number, number>();
      for (const neighborId of cells[cellId].neighbors) {
        if (!isLand(cells[neighborId])) continue;
        if (nationOwner[neighborId] === nationId) continue;
        const ethnicId = ethnicOwner[neighborId];
        if (ethnicId < 0) continue;
        borderEthnicCounts.set(ethnicId, (borderEthnicCounts.get(ethnicId) || 0) + 1);
      }
      if (borderEthnicCounts.size === 0) continue;

      let bestEthnicId = ethnicOwner[cellId];
      let bestScore = -Infinity;
      for (const [ethnicId, borderCount] of borderEthnicCounts) {
        let depthSupport = 0;
        const visited = new Set<number>([cellId]);
        let frontier = [cellId];
        for (let depth = 0; depth < maxDepth; depth += 1) {
          const nextFrontier: number[] = [];
          for (const currentId of frontier) {
            for (const localNeighborId of cells[currentId].neighbors) {
              if (visited.has(localNeighborId)) continue;
              if (!isLand(cells[localNeighborId])) continue;
              if (nationOwner[localNeighborId] !== nationId) continue;
              visited.add(localNeighborId);
              nextFrontier.push(localNeighborId);
              if (ethnicOwner[localNeighborId] === ethnicId) depthSupport += 1;
            }
          }
          frontier = nextFrontier;
          if (frontier.length === 0) break;
        }
        const terrainBias =
          cells[cellId].landform === 'mountain' || cells[cellId].landform === 'hills' ? 0.3 : 0;
        const noise = (random() - 0.5) * 0.35;
        const score =
          borderCount * (1.4 + config.crossBorderBlend) +
          depthSupport * (0.55 + config.crossBorderBlend * 0.4) +
          terrainBias +
          noise;
        if (score > bestScore) {
          bestScore = score;
          bestEthnicId = ethnicId;
        }
      }

      if (bestEthnicId !== ethnicOwner[cellId] && bestScore >= 2.1) {
        next[cellId] = bestEthnicId;
      }
    }
    ethnicOwner.set(next);
  }
}
