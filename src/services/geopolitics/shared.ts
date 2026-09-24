import { BORDER_CONFIG } from 'src/configs/map/geopolitics';
import { TBorderType, TCell, TLandform, TZoneType } from 'src/types/global';
import { collectConnectedComponents } from 'src/services/utils/graph';
import { createSeededRandom, hashSeed } from 'src/services/utils/math';
import Cost from './cost';

export const CAPITAL_VIEWPORT_MARGIN = 14;

const starts = [
  'Al',
  'Bel',
  'Cor',
  'Dor',
  'El',
  'Fal',
  'Gal',
  'Har',
  'Is',
  'Kor',
  'Lor',
  'Mar',
  'Nor',
  'Or',
  'Pel',
  'Quel',
  'Riv',
  'Sel',
  'Tor',
  'Val',
  'Wen',
  'Yar',
  'Zor',

  // new
  'Ar',
  'Bar',
  'Cer',
  'Drak',
  'Eld',
  'Fen',
  'Gor',
  'Hel',
  'Ith',
  'Jar',
  'Kel',
  'Lun',
  'Mor',
  'Ner',
  'Ost',
  'Pra',
  'Quin',
  'Ran',
  'Sar',
  'Thal',
  'Ul',
  'Var',
  'Vor',
  'Xan',
  'Yel',
  'Zen',

  // more “regional” flavor
  'Bao',
  'Dai',
  'Hua',
  'Kyo',
  'Min',
  'Shen',
  'Tian',
  'Xia',
  'Kaz',
  'Uz',
  'Tur',
  'Alt',
  'Bukh',
  'Nov',
  'Petro',
  'Vlad',
  'Zem',
];

const mids = [
  'a',
  'e',
  'i',
  'o',
  'u',
  'ae',
  'ia',
  'oa',
  'ei',

  // new
  'ai',
  'au',
  'ou',
  'ie',
  'ui',
  'aa',
  'eo',
  'io',

  // consonant blends (adds realism)
  'ar',
  'or',
  'ir',
  'ur',
  'an',
  'en',
  'in',
  'on',
  'al',
  'el',
  'il',
  'ol',

  // exotic flavor
  'ya',
  'yo',
  'yu',
  'kh',
  'zh',
  'sh',
];

const ends = [
  'dor',
  'land',
  'ria',
  'mar',
  'vale',
  'stan',
  'mere',
  'gard',
  'wyn',
  'crest',

  // new classic
  'nia',
  'lia',
  'via',
  'tan',
  'ron',
  'ros',
  'tis',
  'nus',
  'grad',
  'burg',
  'heim',
  'hold',
  'ford',
  'port',

  // regional
  'khan',
  'abad',
  'istan',
  'pur',
  'jing',
  'zhou',
  'shan',
  'sk',
  'vich',
  'ova',

  // softer / fantasy
  'lune',
  'thia',
  'dell',
  'vara',
  'mora',
  'zeth',
];

export function edgeNoise(seedHash: number, leftId: number, rightId: number) {
  const low = Math.min(leftId, rightId);
  const high = Math.max(leftId, rightId);
  const mix = (low * 73856093) ^ (high * 19349663) ^ seedHash;
  const s = Math.sin(mix * 0.000173) * 43758.5453;
  return Math.abs(s - Math.floor(s));
}

export function createRegionalName(seed: string, namespace: string, id: number, prefix?: string) {
  const random = createSeededRandom(`${seed}:${namespace}:${id}:name`);
  const start = starts[Math.floor(random() * starts.length)] as string;
  const mid = mids[Math.floor(random() * mids.length)] as string;
  const end = ends[Math.floor(random() * ends.length)] as string;
  const root = `${start}${mid}${end}`;
  return prefix ? `${prefix} ${root}` : root;
}

export function isLand(cell: TCell) {
  return !cell.isWater;
}

function isRidgeBarrier(left: TCell, right: TCell) {
  const ruggedLeft =
    left.landform === 'mountain' || left.landform === 'hills' || left.landform === 'volcanic_field';
  const ruggedRight =
    right.landform === 'mountain' ||
    right.landform === 'hills' ||
    right.landform === 'volcanic_field';
  return ruggedLeft && ruggedRight;
}

function isRuggedTerrain(cell: TCell) {
  return (
    cell.landform === 'mountain' || cell.landform === 'hills' || cell.landform === 'volcanic_field'
  );
}

function getNaturalBarrierPenalty(left: TCell, right: TCell, borderType: TBorderType) {
  const profile = BORDER_CONFIG[borderType];
  let penalty = 0;
  if (left.isRiver || right.isRiver) {
    penalty += profile.penalty.riverCross + Math.log2(Math.max(left.flow, right.flow) + 1) * 0.7;
  }
  if (left.isLake || right.isLake || left.isWater || right.isWater) {
    penalty += profile.penalty.lakeCross;
  }
  if (isRidgeBarrier(left, right)) {
    penalty += profile.penalty.ridgeCross + Math.abs(left.elevation - right.elevation) * 6;
  } else {
    const leftRugged = isRuggedTerrain(left);
    const rightRugged = isRuggedTerrain(right);
    if (leftRugged !== rightRugged) {
      penalty += profile.penalty.ridgeCross * 0.35;
    }
  }
  return penalty;
}

function isCoastalLand(cell: TCell, cells: TCell[]) {
  if (cell.isWater) return false;
  if (cell.landform === 'coast') return true;
  for (const neighborId of cell.neighbors) {
    const neighbor = cells[neighborId];
    if (neighbor.isWater || neighbor.isLake || neighbor.landform === 'coast') return true;
  }
  return false;
}

function countOwnedNeighbors(cells: TCell[], owner: Int32Array, cellId: number, ownerId: number) {
  let count = 0;
  for (const neighborId of cells[cellId].neighbors) {
    if (owner[neighborId] === ownerId) count += 1;
  }
  return count;
}

export function getBoundaryStepCost(
  cells: TCell[],
  owner: Int32Array,
  currentId: number,
  neighborId: number,
  ownerId: number,
  seedHash: number,
  borderType: TBorderType
) {
  const profile = BORDER_CONFIG[borderType];
  const currentCell = cells[currentId];
  const neighbor = cells[neighborId];
  let step = Cost.border(neighbor, borderType);
  step += getNaturalBarrierPenalty(currentCell, neighbor, borderType);
  if (isCoastalLand(neighbor, cells)) step += profile.penalty.shorelineEdgeBias;
  const sameOwnerNeighbors = countOwnedNeighbors(cells, owner, neighborId, ownerId);
  step += (2 - Math.min(2, sameOwnerNeighbors)) * profile.smoothness.jaggedPenalty;
  const noise = (edgeNoise(seedHash, currentId, neighborId) - 0.5) * 2;
  step += noise * profile.smoothness.edgeNoiseWeight;
  return Math.max(0.25, step);
}

export function getNationNeighborCounts(cells: TCell[], owner: Int32Array, cellId: number) {
  const counts = new Map<number, number>();
  for (const neighborId of cells[cellId].neighbors) {
    if (!isLand(cells[neighborId])) continue;
    const neighborNationId = owner[neighborId];
    if (neighborNationId < 0) continue;
    counts.set(neighborNationId, (counts.get(neighborNationId) || 0) + 1);
  }
  return counts;
}

function collectTerrainClusters(cells: TCell[], landform: TLandform) {
  return collectConnectedComponents(
    cells,
    (cell) => cell.landform === landform && !cell.isWater,
    (_current, neighbor) => neighbor.landform === landform && !neighbor.isWater
  );
}

export function limitMountainSplit(
  cells: TCell[],
  owner: Int32Array,
  borderType: TBorderType,
  nationOwner?: Int32Array
) {
  const profile = BORDER_CONFIG[borderType];
  const clusters = collectTerrainClusters(cells, 'mountain');
  for (const cluster of clusters) {
    if (cluster.length < profile.fragmentation.largeMountainClusterMinCells) continue;
    const byOwner = new Map<number, number[]>();
    for (const cellId of cluster) {
      const ownerId = owner[cellId];
      if (ownerId < 0) continue;
      if (!byOwner.has(ownerId)) byOwner.set(ownerId, []);
      (byOwner.get(ownerId) as number[]).push(cellId);
    }
    const ownerEntries = Array.from(byOwner.entries()).sort((a, b) => b[1].length - a[1].length);
    const allowed = new Set(
      ownerEntries.slice(0, profile.fragmentation.maxMountainOwnersPerCluster).map(([id]) => id)
    );
    for (const [ownerId, cellsToMove] of ownerEntries) {
      if (allowed.has(ownerId)) continue;
      for (const cellId of cellsToMove) {
        const counts = new Map<number, number>();
        for (const neighborId of cells[cellId].neighbors) {
          const candidateId = owner[neighborId];
          if (candidateId < 0 || !allowed.has(candidateId)) continue;
          if (nationOwner && nationOwner[neighborId] !== nationOwner[cellId]) continue;
          counts.set(candidateId, (counts.get(candidateId) || 0) + 1);
        }
        let bestOwnerId = ownerId;
        let bestCount = -1;
        for (const [candidateId, count] of counts) {
          if (count > bestCount) {
            bestCount = count;
            bestOwnerId = candidateId;
          }
        }
        if (bestOwnerId !== ownerId && bestCount >= profile.fragmentation.clusterSplitPenalty) {
          owner[cellId] = bestOwnerId;
        }
      }
    }
  }
}

export function assignMaritimeZones(cells: TCell[]) {
  const zoneType: TZoneType[] = Array.from({ length: cells.length }, () => 'international-waters');
  const waterOwner = new Int32Array(cells.length);
  waterOwner.fill(-1);

  for (let cellId = 0; cellId < cells.length; cellId += 1) {
    if (isLand(cells[cellId])) zoneType[cellId] = 'land';
  }
  return { waterOwner, zoneType };
}

export function getNationCount(nationCount: number, landCellCount: number) {
  if (landCellCount <= 0) return 0;
  const maxNationsByMinLandRule = Math.floor(landCellCount / 10) - 2;
  const maxNations = Math.max(1, Math.min(40, maxNationsByMinLandRule));
  const requested = Math.max(2, Math.floor(nationCount));
  return Math.min(requested, maxNations);
}

export function makeFrontierHash(seed: string, suffix: string) {
  return hashSeed(`${seed}:${suffix}`);
}

/**
 * Collect land cell IDs belonging to a specific owner (nation, province, or ethnic group).
 * Uses for-loop for performance (avoids creating intermediate arrays from filter+map).
 */
export function getOwnerLandCellIds(cells: TCell[], owner: Int32Array, ownerId: number): number[] {
  const ids: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (isLand(cells[i]) && owner[i] === ownerId) ids.push(i);
  }
  return ids;
}

/**
 * Build a map of owner ID → list of its cell IDs from a set of candidate cells.
 */
export function groupOwnerCells(ownerCellIds: number[], owner: Int32Array): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const cellId of ownerCellIds) {
    const ownerId = owner[cellId];
    if (ownerId < 0) continue;
    if (!map.has(ownerId)) map.set(ownerId, []);
    (map.get(ownerId) as number[]).push(cellId);
  }
  return map;
}

/**
 * Find all disconnected fragments of an entity (province/nation) and reassign
 * the smaller fragments to the best neighboring entity.
 *
 * Uses stack-based DFS to find connected components within a single entity's territory.
 * Sorts components by size (descending), keeps the largest, reassigns the rest.
 */
export function reassignDisconnectedFragments(
  cells: TCell[],
  entityOwner: Int32Array,
  entityIds: number[],
  options: {
    boundaryOwner?: Int32Array;
    pickBestOwner: (cellId: number, neighborCounts: Map<number, number>) => number;
    isSharedBoundary?: (cellId: number, neighborId: number) => boolean;
  }
) {
  const { boundaryOwner, pickBestOwner, isSharedBoundary } = options;
  const stack: number[] = [];

  for (const entityId of entityIds) {
    const entityCells = getOwnerLandCellIds(cells, entityOwner, entityId);
    if (entityCells.length <= 1) continue;

    const visited = new Set<number>();
    const components: number[][] = [];

    for (const startCellId of entityCells) {
      if (visited.has(startCellId)) continue;
      stack.length = 0;
      stack.push(startCellId);
      const component: number[] = [];
      visited.add(startCellId);

      while (stack.length > 0) {
        const current = stack.pop() as number;
        component.push(current);

        for (const neighborId of cells[current].neighbors) {
          if (entityOwner[neighborId] !== entityId) continue;
          if (!isLand(cells[neighborId])) continue;
          if (isSharedBoundary && !isSharedBoundary(current, neighborId)) continue;
          if (visited.has(neighborId)) continue;
          visited.add(neighborId);
          stack.push(neighborId);
        }
      }
      components.push(component);
    }

    if (components.length <= 1) continue;
    components.sort((a, b) => b.length - a.length);

    for (let index = 1; index < components.length; index += 1) {
      for (const cellId of components[index]) {
        const neighborCounts = new Map<number, number>();
        for (const neighborId of cells[cellId].neighbors) {
          if (!isLand(cells[neighborId])) continue;
          const candidateOwnerId = entityOwner[neighborId];
          if (candidateOwnerId < 0 || candidateOwnerId === entityId) continue;
          if (boundaryOwner && boundaryOwner[neighborId] !== boundaryOwner[cellId]) continue;
          if (isSharedBoundary && !isSharedBoundary(cellId, neighborId)) continue;
          neighborCounts.set(candidateOwnerId, (neighborCounts.get(candidateOwnerId) || 0) + 1);
        }
        const bestOwnerId = pickBestOwner(cellId, neighborCounts);
        if (bestOwnerId >= 0) entityOwner[cellId] = bestOwnerId;
      }
    }
  }
}
