export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function smoothStep(value: number) {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

export function normalize(value: number, min: number, max: number) {
  return (value - min) / (max - min + 1e-9);
}

/**
 * Triangular "tent" score: 1 at value === ideal, falling off linearly to 0 at
 * `tolerance` distance away (clamped to [0, 1] past that).
 */
export function tentScore(value: number, ideal: number, tolerance: number) {
  return clamp(1 - Math.abs(value - ideal) / tolerance, 0, 1);
}

export function dot(x1: number, y1: number, x2: number, y2: number) {
  return x1 * x2 + y1 * y2;
}

export function hashSeed(input: string): number {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed: string, max = 4294967296) {
  let state = hashSeed(seed) || 1;

  return function nextRandom() {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);

    return ((value ^ (value >>> 14)) >>> 0) / max;
  };
}

// ─── Simplex Noise 2D ───────────────────────────────────────────────────────────

// Skew factors for 2D simplex noise
// F2 = 0.5 * (sqrt(3) - 1) — skew from (x,y) space to simplex grid
// G2 = (3 - sqrt(3)) / 6  — unskew from simplex grid to (x,y) space
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

// 16 gradient vectors for 2D — evenly distributed around unit circle
const GRADIENT_2D: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0.5],
  [-1, 0.5],
  [1, -0.5],
  [-1, -0.5],
  [0.5, 1],
  [-0.5, 1],
  [0.5, -1],
  [-0.5, -1],
];

function dot2D(g: [number, number], x: number, y: number): number {
  return g[0] * x + g[1] * y;
}

/**
 * Deterministic 2D hash for simplex noise grid corners.
 * Uses FNV-1a style mixing with the same seedHash pattern as the rest of the codebase.
 */
function hash2D(x: number, y: number, seedHash: number): number {
  let hash = seedHash >>> 0;
  hash = Math.imul(hash ^ x, 374761393);
  hash = Math.imul(hash ^ y, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return (hash ^ (hash >>> 16)) >>> 0;
}

/**
 * 2D Simplex noise — deterministic, isotropic, and free of directional artifacts.
 *
 * Returns a value in [0, 1] range (normalised from the raw [-1, 1] simplex output)
 * so it can be a drop-in replacement for `sampleValueNoise`.
 *
 * @param x - X coordinate (any real number)
 * @param y - Y coordinate (any real number)
 * @param seedHash - Deterministic seed hash from the caller
 */
export function simplex2D(x: number, y: number, seedHash: number): number {
  // 1. Skew input space to simplex grid
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);

  // 2. Unskew back to (x, y) space
  const t = (i + j) * G2;
  const X0 = i - t;
  const Y0 = j - t;
  const x0 = x - X0;
  const y0 = y - Y0;

  // 3. Determine which simplex triangle we are in
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = x0 > y0 ? 0 : 1;

  // 4. Offsets for middle and last corners
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1.0 + 2.0 * G2;
  const y2 = y0 - 1.0 + 2.0 * G2;

  // 5. Hash the three simplex corners for pseudo-random gradient indices
  const gi0 = hash2D(i, j, seedHash) & 15;
  const gi1 = hash2D(i + i1, j + j1, seedHash) & 15;
  const gi2 = hash2D(i + 1, j + 1, seedHash) & 15;

  // 6. Calculate contribution from each corner
  let n0 = 0;
  let n1 = 0;
  let n2 = 0;

  // Corner 0
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) {
    t0 *= t0;
    n0 = t0 * t0 * dot2D(GRADIENT_2D[gi0], x0, y0);
  }

  // Corner 1
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) {
    t1 *= t1;
    n1 = t1 * t1 * dot2D(GRADIENT_2D[gi1], x1, y1);
  }

  // Corner 2
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) {
    t2 *= t2;
    n2 = t2 * t2 * dot2D(GRADIENT_2D[gi2], x2, y2);
  }

  // 7. Scale from raw [-1, 1] to [0, 1]
  //    The normalisation factor ~70 is the standard simplex 2D amplitude.
  return (n0 + n1 + n2) * 70.0 * 0.5 + 0.5;
}
