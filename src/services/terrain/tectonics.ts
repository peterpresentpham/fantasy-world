import { createSeededRandom } from 'src/services/utils/math';
import { TPoint } from 'src/types/global';

type TPlateKind = 'continental' | 'oceanic';
type TBoundaryKind = 'divergent' | 'convergent' | 'transform' | 'none';

export interface TPlate {
  id: number;
  kind: TPlateKind;
  centroidX: number; // Normalized [0, 1]
  centroidY: number; // Normalized [0, 1]
  vx: number; // Velocity X (normalized units)
  vy: number; // Velocity Y (normalized units)
}

/**
 * Per-cell boundary classification result.
 * Only populated for cells near a plate boundary.
 */
export interface TPlateBoundaryInfo {
  boundaryKind: TBoundaryKind;
  convergenceRate: number; // Positive magnitude for convergent
  divergenceRate: number; // Positive magnitude for divergent
  distanceToBoundary: number; // Normalized [0, ~0.15]
  isContinental: boolean; // Whether this cell's plate is continental
  neighborPlateKind: TPlateKind | null;
  neighborPlateId: number;
}

// ─── Config ────────────────────────────────────────────────────────────────────

interface TTectonicConfig {
  plateCountMin: number;
  plateCountMax: number;
  continentalRatio: number;
  velocityBase: number;
  velocityRange: number;
  boundaryInfluenceWidth: number;
}

const TECTONIC_CONFIG: TTectonicConfig = {
  plateCountMin: 4,
  plateCountMax: 7,
  continentalRatio: 0.6,
  velocityBase: 0.002,
  velocityRange: 0.008,
  boundaryInfluenceWidth: 0.12,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Deterministic plate-diagnostic hash used to assign plate attributes.
 * Uses same FNV-1a style mixing as the rest of the codebase.
 */
function hashPlateAttrs(plateId: number, key: string, seedHash: number): number {
  let hash = seedHash >>> 0;
  hash = Math.imul(hash ^ plateId, 374761393);
  for (let i = 0; i < key.length; i += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(i), 668265263);
  }
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function seededFrac(plateId: number, key: string, seedHash: number): number {
  return hashPlateAttrs(plateId, key, seedHash) / 4294967296;
}

// ─── Generate plates ──────────────────────────────────────────────────────────

/**
 * Build a set of tectonic plates using Voronoi-style centroid partitioning.
 *
 * Each plate gets:
 *  - a centroid (seeded random)
 *  - a kind (continental or oceanic)
 *  - a velocity vector (vx, vy) that will later be used to classify boundaries
 *    via relative motion between neighbouring plates.
 *
 * @param seed   Map generation seed (for determinism)
 * @param width  Map width in pixels
 * @param height Map height in pixels
 * @param cellSites  Array of (x, y) cell sites — used for Voronoi assignment
 * @returns      Array of plates, plus a mapping from cellIndex → plateId
 */
export function generatePlates(
  seed: string,
  width: number,
  height: number,
  cellSites: ReadonlyArray<TPoint>
): { plates: TPlate[]; cellPlateId: Int32Array } {
  const random = createSeededRandom(`${seed}:tectonic`);
  const cellCount = cellSites.length;
  const cellPlateId = new Int32Array(cellCount);
  const plateCount =
    TECTONIC_CONFIG.plateCountMin +
    Math.floor(random() * (TECTONIC_CONFIG.plateCountMax - TECTONIC_CONFIG.plateCountMin + 1));

  const plates: TPlate[] = [];

  // 1. Generate centroids + attributes
  for (let plateId = 0; plateId < plateCount; plateId += 1) {
    const cx = random();
    const cy = random();
    const isContinental = random() < TECTONIC_CONFIG.continentalRatio;
    const theta = random() * Math.PI * 2;
    const speed = TECTONIC_CONFIG.velocityBase + random() * TECTONIC_CONFIG.velocityRange;

    plates.push({
      id: plateId,
      kind: isContinental ? 'continental' : 'oceanic',
      centroidX: cx,
      centroidY: cy,
      vx: Math.cos(theta) * speed,
      vy: Math.sin(theta) * speed,
    });
  }

  // 2. Assign each cell to the nearest plate centroid (Voronoi-like partition)
  //    We also add a small perturbation to centroids per cell to create
  //    more organic boundaries.
  const perturbSeed = hashPlateAttrs(0, 'perturb', seed.length);
  for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
    const [sx, sy] = cellSites[cellIndex];
    const nx = sx / width;
    const ny = sy / height;

    let bestDist = Infinity;
    let bestPlate = 0;

    for (let p = 0; p < plates.length; p += 1) {
      const plate = plates[p];
      // Perturb centroid slightly per-cell to avoid straight-line boundaries
      const perturb = seededFrac(cellIndex + p, 'perturb', perturbSeed) - 0.5;
      const px = plate.centroidX + perturb * 0.03;
      const py =
        plate.centroidY + (seededFrac(cellIndex + p * 97, 'perturb-y', perturbSeed) - 0.5) * 0.03;
      const d = Math.hypot(nx - px, ny - py);
      if (d < bestDist) {
        bestDist = d;
        bestPlate = p;
      }
    }

    cellPlateId[cellIndex] = bestPlate;
  }

  return { plates, cellPlateId };
}

// ─── Classify boundary for a single cell ──────────────────────────────────────

/**
 * For a given cell, examine its neighbours to find if it lies on a plate boundary
 * and what kind of boundary it is.
 *
 * Boundary kind is determined by comparing the relative velocity of the two plates
 * projected onto the boundary normal.
 *
 * @param cellIndex     Index of the cell in the cells array
 * @param cellX         X coordinate of the cell site
 * @param cellY         Y coordinate of the cell site
 * @param neighborIds   Array of neighbour cell indices (from TCell.neighbors)
 * @param cellSites     All cell sites for coordinate lookups
 * @param plates        The generated plate array
 * @param cellPlateId   Maps cellIndex → plateId
 * @param seaLevel      Sea level threshold
 * @param width         Map width
 * @param height        Map height
 */
export function classifyBoundaryForCell(
  cellIndex: number,
  cellX: number,
  cellY: number,
  neighborIds: ReadonlyArray<number>,
  cellSites: ReadonlyArray<TPoint>,
  plates: ReadonlyArray<TPlate>,
  cellPlateId: Int32Array,
  seaLevel: number,
  width: number,
  height: number
): TPlateBoundaryInfo {
  const myPlateId = cellPlateId[cellIndex];
  const myPlate = plates[myPlateId];
  const myKind = myPlate.kind;

  const defaultInfo: TPlateBoundaryInfo = {
    boundaryKind: 'none',
    convergenceRate: 0,
    divergenceRate: 0,
    distanceToBoundary: 1,
    isContinental: myKind === 'continental',
    neighborPlateKind: null,
    neighborPlateId: -1,
  };

  // Find the first neighbour on a different plate
  let boundaryNeighborId = -1;
  let otherPlateId = -1;
  for (const nid of neighborIds) {
    const pid = cellPlateId[nid];
    if (pid !== myPlateId) {
      boundaryNeighborId = nid;
      otherPlateId = pid;
      break;
    }
  }

  if (boundaryNeighborId < 0 || otherPlateId < 0) {
    return defaultInfo;
  }

  const otherPlate = plates[otherPlateId];
  const ns = cellSites[boundaryNeighborId];

  // Distance to boundary: approximate using distance to the neighbour cell
  const boundaryDist = Math.hypot(cellX - ns[0], ns[1] - cellY) / Math.hypot(width, height);

  if (boundaryDist > TECTONIC_CONFIG.boundaryInfluenceWidth) {
    return defaultInfo;
  }

  // Compute relative velocity
  const rvx = myPlate.vx - otherPlate.vx;
  const rvy = myPlate.vy - otherPlate.vy;

  // Boundary normal: approximate direction from this cell toward the neighbour
  const bnx = ns[0] - cellX;
  const bny = ns[1] - cellY;
  const bLen = Math.hypot(bnx, bny);
  if (bLen < 1e-12) return defaultInfo;
  const nnx = bnx / bLen;
  const nny = bny / bLen;

  // Project relative velocity onto boundary normal
  // Positive = moving apart (divergent), Negative = moving together (convergent)
  const projection = rvx * nnx + rvy * nny;
  const threshold = 0.0005;

  let boundaryKind: TBoundaryKind;
  let convergenceRate = 0;
  let divergenceRate = 0;

  if (projection > threshold) {
    boundaryKind = 'divergent';
    divergenceRate = projection;
  } else if (projection < -threshold) {
    boundaryKind = 'convergent';
    convergenceRate = -projection;
  } else {
    boundaryKind = 'transform';
  }

  return {
    boundaryKind,
    convergenceRate,
    divergenceRate,
    distanceToBoundary: boundaryDist,
    isContinental: myKind === 'continental',
    neighborPlateKind: otherPlate.kind,
    neighborPlateId: otherPlateId,
  };
}
