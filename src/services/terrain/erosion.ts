import { TOPOGRAPHY_CONFIG } from 'src/configs/map/topography';
import { clamp } from 'src/services/utils/math';

export interface TErosionResult {
  elevations: Float32Array;
  erosionMap: Float32Array;
  depositionMap: Float32Array;
}

// Stream Power Law: E(i) = K × A(i)^0.5 × S(i)^1.0
// Physically realistic erosion that carves V-shaped valleys and preserves ridges.
export function simulateHydraulicErosion(
  elevations: Float32Array,
  cellSites: ReadonlyArray<[number, number]>,
  neighborMap: ReadonlyArray<ReadonlyArray<number>>,
  _seed: string,
  seaLevel: number
): TErosionResult {
  const cfg = TOPOGRAPHY_CONFIG.erosion;
  const cellCount = elevations.length;
  const workingElev = Float32Array.from(elevations);
  const erosionAccum = new Float32Array(cellCount);
  const depositionAccum = new Float32Array(cellCount);

  // Phase 1: Sort land cells descending by elevation for D8 routing
  const sortedLand: number[] = [];
  for (let i = 0; i < cellCount; i += 1) {
    if (workingElev[i] > seaLevel) sortedLand.push(i);
  }
  sortedLand.sort((a, b) => workingElev[b] - workingElev[a]);

  // Phase 2: D8 downstream routing — each cell drains to its lowest neighbor
  const downstream = new Int32Array(cellCount).fill(-1);
  for (const i of sortedLand) {
    let lowestNeighbor = -1;
    let lowestElev = workingElev[i];
    for (const j of neighborMap[i]) {
      if (workingElev[j] < lowestElev) {
        lowestElev = workingElev[j];
        lowestNeighbor = j;
      }
    }
    downstream[i] = lowestNeighbor;
  }

  // Phase 3: Accumulate upstream flow (process high → low)
  const flow = new Float32Array(cellCount).fill(1);
  for (const i of sortedLand) {
    const d = downstream[i];
    if (d >= 0) flow[d] += flow[i];
  }

  // Phase 4: Apply stream power erosion E = K × sqrt(A) × S
  const K = cfg.erosionRate * 0.018;
  for (const i of sortedLand) {
    const d = downstream[i];
    if (d < 0) continue;
    const dx = cellSites[i][0] - cellSites[d][0];
    const dy = cellSites[i][1] - cellSites[d][1];
    const dist = Math.hypot(dx, dy);
    if (dist < 0.0001) continue;
    const slope = Math.max(0, (workingElev[i] - workingElev[d]) / dist);
    const erosion = clamp(K * Math.sqrt(flow[i]) * slope, 0, 0.06);
    workingElev[i] = Math.max(seaLevel, workingElev[i] - erosion);
    erosionAccum[i] += erosion;
  }

  // Phase 5: Deposition at slope breaks (alluvial fans, river deltas)
  for (const i of sortedLand) {
    const d = downstream[i];
    if (d < 0) continue;
    const d2 = downstream[d];
    if (d2 < 0 || workingElev[d2] <= seaLevel) continue;
    const slope1 = workingElev[i] - workingElev[d];
    const slope2 = workingElev[d] - workingElev[d2];
    if (slope1 > 0 && slope2 < slope1 * 0.4) {
      const deposit = Math.min(slope1 * 0.15, 0.008);
      workingElev[d] = Math.min(workingElev[d] + deposit, workingElev[i]);
      depositionAccum[d] += deposit;
    }
  }

  // Normalize maps to [0, 1]
  let maxErosion = 0;
  let maxDeposition = 0;
  for (let i = 0; i < cellCount; i += 1) {
    if (erosionAccum[i] > maxErosion) maxErosion = erosionAccum[i];
    if (depositionAccum[i] > maxDeposition) maxDeposition = depositionAccum[i];
  }

  const erosionMap = new Float32Array(cellCount);
  const depositionMap = new Float32Array(cellCount);
  for (let i = 0; i < cellCount; i += 1) {
    erosionMap[i] = maxErosion > 0 ? clamp(erosionAccum[i] / maxErosion, 0, 1) : 0;
    depositionMap[i] = maxDeposition > 0 ? clamp(depositionAccum[i] / maxDeposition, 0, 1) : 0;
  }

  return { elevations: workingElev, erosionMap, depositionMap };
}
