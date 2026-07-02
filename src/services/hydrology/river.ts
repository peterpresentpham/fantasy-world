import { HYDROLOGY_CONFIG, RIVER_CONFIG } from 'src/configs/map/hydrology';
import { TBiome, TCell, TPoint, TRiver, TRiverEndType, TRiverKind } from 'src/global';
import { TFifoQueue } from 'src/services/utils/collections';
import { createSeededRandom } from 'src/services/utils/math';

const T_COAST_OUTLET = HYDROLOGY_CONFIG.coastOutletId;

const BIOME_WATER_RETENTION: Partial<Record<TBiome, number>> = {
  wetland: 1.5,
  tropical_forest: 1.4,
  temperate_forest: 1.1,
  plain: 0.9,
  boreal_forest: 0.85,
  grassland: 0.8,
  montane_shrub: 0.6,
  savanna: 0.45,
  steppe: 0.35,
  tundra: 0.35,
  ice: 0.45,
  desert_cold: 0.15,
  desert_hot: 0.08,
};

type TRiverGenerationResult = {
  downstream: Int32Array;
  flow: Float32Array;
  effectiveFlow: Float32Array;
  riverByCell: Int32Array;
  riverWidthByCell: Float32Array;
  rivers: TRiver[];
  depressionIterations: number;
  unresolvedDepressions: number;
};

type TConfluenceEvent = {
  atCellId: number;
  mainRiverId: number;
  tributaryRiverId: number;
};

export function sortIndicesByElevation(elevation: Float32Array) {
  const indices = Array.from({ length: elevation.length }, (_, index) => index);
  indices.sort((left, right) => {
    if (elevation[right] !== elevation[left]) return elevation[right] - elevation[left];
    return left - right;
  });
  return indices;
}

function prepareTerrain(cells: TCell[], elevation: Float32Array, isLand: Uint8Array) {
  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    const cell = cells[cellIndex];
    const land = !cell.isWater && cell.elevation >= RIVER_CONFIG.landWaterThreshold;
    isLand[cellIndex] = land ? 1 : 0;
    elevation[cellIndex] = cell.elevation;

    if (!land) continue;
    const hasWaterNeighbor = cell.neighbors.some((neighborId) => cells[neighborId].isWater);
    if (hasWaterNeighbor) {
      elevation[cellIndex] += RIVER_CONFIG.depression.coastLift;
    }
  }
}

function fillDepressions(cells: TCell[], elevation: Float32Array, isLand: Uint8Array) {
  const filled = new Float32Array(elevation);
  const epsilon = RIVER_CONFIG.depression.epsilon;
  let iterations = 0;

  for (; iterations < RIVER_CONFIG.depression.maxIterations; iterations += 1) {
    let changed = 0;
    for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
      if (isLand[cellIndex] === 0) continue;
      const cell = cells[cellIndex];

      let hasLower = false;
      let minNeighbor = Infinity;
      let hasOutlet = false;

      for (const neighborId of cell.neighbors) {
        if (isLand[neighborId] === 0) {
          hasOutlet = true;
          continue;
        }
        const neighborElevation = filled[neighborId];
        minNeighbor = Math.min(minNeighbor, neighborElevation);
        if (neighborElevation < filled[cellIndex] - epsilon) {
          hasLower = true;
          break;
        }
      }

      if (hasLower || hasOutlet || !Number.isFinite(minNeighbor)) continue;
      const raised = minNeighbor + epsilon;
      if (raised > filled[cellIndex]) {
        filled[cellIndex] = raised;
        changed += 1;
      }
    }
    if (changed === 0) break;
  }

  let unresolved = 0;
  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    if (isLand[cellIndex] === 0) continue;
    let hasLowerOrOutlet = false;
    for (const neighborId of cells[cellIndex].neighbors) {
      if (isLand[neighborId] === 0 || filled[neighborId] < filled[cellIndex]) {
        hasLowerOrOutlet = true;
        break;
      }
    }
    if (!hasLowerOrOutlet) unresolved += 1;
  }

  return { filledElevation: filled, iterations: iterations + 1, unresolvedDepressions: unresolved };
}

function accumulateFlow(
  cells: TCell[],
  filledElevation: Float32Array,
  isLand: Uint8Array,
  precipitation: Float32Array,
  seaLevel: number
) {
  const downstream = new Int32Array(cells.length);
  downstream.fill(-1);

  const cellModifier = Math.pow(cells.length / 10000, RIVER_CONFIG.cellsNumberModifierExp);
  const flow = new Float32Array(cells.length);
  const effectiveFlow = new Float32Array(cells.length);

  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    if (isLand[cellIndex] === 0) continue;
    const cell = cells[cellIndex];
    const biomeRetention = BIOME_WATER_RETENTION[cell.biome] ?? 0.8;
    const aridityDamp = Math.max(0, 1 - (cell.aridityIndex ?? 0) * 0.55);
    const precipContribution = precipitation[cellIndex] * 16 * biomeRetention * aridityDamp;
    flow[cellIndex] = (1.5 + precipContribution) * cellModifier;
  }

  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    if (isLand[cellIndex] === 0) continue;
    const cell = cells[cellIndex];
    let nextCell = -1;
    let nextElevation = filledElevation[cellIndex];
    let hasWaterNeighbor = false;

    for (const neighborId of cell.neighbors) {
      if (isLand[neighborId] === 0) {
        hasWaterNeighbor = true;
        continue;
      }
      const neighborElevation = filledElevation[neighborId];
      if (
        neighborElevation < nextElevation ||
        (neighborElevation === nextElevation && neighborId < nextCell)
      ) {
        nextElevation = neighborElevation;
        nextCell = neighborId;
      }
    }

    if (nextCell >= 0) {
      downstream[cellIndex] = nextCell;
    } else if (hasWaterNeighbor || cell.elevation <= seaLevel + 0.02) {
      downstream[cellIndex] = T_COAST_OUTLET;
    }
  }

  const sorted = sortIndicesByElevation(filledElevation);
  for (const cellIndex of sorted) {
    if (isLand[cellIndex] === 0) continue;
    const next = downstream[cellIndex];
    if (next >= 0) flow[next] += flow[cellIndex];
  }

  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    if (isLand[cellIndex] === 0) continue;
    const next = downstream[cellIndex];
    const slope = next >= 0 ? Math.max(0, filledElevation[cellIndex] - filledElevation[next]) : 0;
    effectiveFlow[cellIndex] = flow[cellIndex] * (1 + slope * 2.5);
  }

  return { downstream, flow, effectiveFlow };
}

function riverKind(peakFlow: number): TRiverKind {
  if (peakFlow >= 150) return 'river';
  if (peakFlow >= 80) return 'fork';
  if (peakFlow >= 45) return 'branch';
  return 'creek';
}

function createRiverName(random: () => number, id: number, kind: TRiverKind) {
  const prefixes = ['Ael', 'Bren', 'Caer', 'Dun', 'Ery', 'Fenn', 'Glen', 'Mor', 'Nyr', 'Thal'];
  const suffixByKind: Record<TRiverKind, string[]> = {
    river: ['river', 'run', 'water'],
    creek: ['creek', 'brook', 'rill'],
    branch: ['branch', 'reach', 'channel'],
    fork: ['fork', 'strand', 'stream'],
  };
  const prefix = prefixes[Math.floor(random() * prefixes.length)] ?? 'Ael';
  const suffixes = suffixByKind[kind];
  const suffix = suffixes[Math.floor(random() * suffixes.length)] ?? 'river';
  return `${prefix}-${id + 1} ${suffix}`;
}

function buildPathToWater(cells: TCell[], startCellId: number, riverByCell: Int32Array) {
  const visited = new Uint8Array(cells.length);
  const previous = new Int32Array(cells.length);
  previous.fill(-1);
  const queue = new TFifoQueue<number>();
  queue.enqueue(startCellId);
  visited[startCellId] = 1;

  while (queue.size > 0) {
    const current = queue.dequeue() as number;
    const currentCell = cells[current];

    for (const neighborId of currentCell.neighbors) {
      const neighbor = cells[neighborId];
      if (neighbor.isWater) {
        const landPath: number[] = [];
        let cursor = current;
        while (cursor !== startCellId && cursor >= 0) {
          landPath.push(cursor);
          cursor = previous[cursor] as number;
        }
        landPath.reverse();
        return { landPath, waterCellId: neighborId };
      }
    }

    for (const neighborId of currentCell.neighbors) {
      if (visited[neighborId] === 1) continue;
      const neighbor = cells[neighborId];
      if (neighbor.isWater) continue;
      if (riverByCell[neighborId] >= 0 && neighborId !== startCellId) continue;
      visited[neighborId] = 1;
      previous[neighborId] = current;
      queue.enqueue(neighborId);
    }
  }

  return null;
}

function buildRiverGraph(
  cells: TCell[],
  downstream: Int32Array,
  flow: Float32Array,
  effectiveFlow: Float32Array,
  seed: string
) {
  const threshold =
    RIVER_CONFIG.minFluxToFormRiver *
    Math.pow(cells.length / 10000, RIVER_CONFIG.cellsNumberModifierExp);
  const riverByCell = new Int32Array(cells.length);
  riverByCell.fill(-1);
  const riversRaw = new Map<number, number[]>();
  const riverParent = new Map<number, number | null>();
  const tributaries = new Map<number, Set<number>>();
  const confluences: TConfluenceEvent[] = [];

  const upstreamCount = new Int32Array(cells.length);
  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    const next = downstream[cellIndex];
    if (next >= 0) upstreamCount[next] += 1;
  }

  const candidateSources = Array.from({ length: cells.length }, (_, cellIndex) => cellIndex)
    .filter((cellIndex) => {
      const cell = cells[cellIndex];
      if (cell.isWater) return false;
      if (!(downstream[cellIndex] >= 0 || downstream[cellIndex] === T_COAST_OUTLET)) return false;
      const aridity = cells[cellIndex].aridityIndex ?? 0;
      const aridityMultiplier =
        aridity > 1.5 ? 4.0 : aridity > 1.0 ? 2.5 : aridity > 0.7 ? 1.5 : 1.0;
      const effectiveThreshold = threshold * aridityMultiplier;
      if (flow[cellIndex] < effectiveThreshold) return false;
      return upstreamCount[cellIndex] <= 1 || flow[cellIndex] >= effectiveThreshold * 1.4;
    })
    .sort((left, right) => {
      if (cells[right].elevation !== cells[left].elevation) {
        return cells[right].elevation - cells[left].elevation;
      }
      if (effectiveFlow[right] !== effectiveFlow[left])
        return effectiveFlow[right] - effectiveFlow[left];
      return left - right;
    });

  let nextRiverId = 0;
  for (const sourceId of candidateSources) {
    if (riverByCell[sourceId] >= 0) continue;

    const riverId = nextRiverId;
    nextRiverId += 1;
    riversRaw.set(riverId, []);
    riverParent.set(riverId, null);

    let cursor = sourceId;
    const visited = new Set<number>();

    while (cursor >= 0 && cursor < cells.length && !visited.has(cursor)) {
      visited.add(cursor);
      const existingRiver = riverByCell[cursor];
      if (existingRiver >= 0 && existingRiver !== riverId) {
        if (effectiveFlow[cursor] <= effectiveFlow[sourceId]) {
          riverParent.set(existingRiver, riverId);
          tributaries.set(riverId, tributaries.get(riverId) ?? new Set<number>());
          tributaries.get(riverId)?.add(existingRiver);
        } else {
          riverParent.set(riverId, existingRiver);
          tributaries.set(existingRiver, tributaries.get(existingRiver) ?? new Set<number>());
          tributaries.get(existingRiver)?.add(riverId);
        }
        confluences.push({
          atCellId: cursor,
          mainRiverId: existingRiver,
          tributaryRiverId: riverId,
        });
        break;
      }

      riverByCell[cursor] = riverId;
      riversRaw.get(riverId)?.push(cursor);

      const next = downstream[cursor];
      if (next === T_COAST_OUTLET || next < 0) break;
      if (cells[next].isWater) break;
      cursor = next;
    }
  }

  const random = createSeededRandom(`${seed}:river-naming`);
  const rivers: TRiver[] = [];
  const riverWidthByCell = new Float32Array(cells.length);

  for (const [riverId, chain] of riversRaw.entries()) {
    const sourceCell = cells[chain[0] as number];
    const sourceAridity = sourceCell?.aridityIndex ?? 0;
    const minCells =
      sourceAridity > 1.0 ? RIVER_CONFIG.minRiverCells * 2 : RIVER_CONFIG.minRiverCells;
    if (chain.length < minCells) {
      for (const cellId of chain) riverByCell[cellId] = -1;
      continue;
    }

    const sourceCellId = chain[0] as number;
    let tailCellId = chain[chain.length - 1] as number;
    let tailDownstream = downstream[tailCellId];

    if (
      !(tailDownstream >= 0 && cells[tailDownstream].isWater) &&
      tailDownstream !== T_COAST_OUTLET
    ) {
      const extension = buildPathToWater(cells, tailCellId, riverByCell);
      if (extension) {
        let cursor = tailCellId;
        for (const cellId of extension.landPath) {
          if (riverByCell[cellId] >= 0 && riverByCell[cellId] !== riverId) break;
          downstream[cursor] = cellId;
          riverByCell[cellId] = riverId;
          chain.push(cellId);
          flow[cellId] = Math.max(flow[cellId], flow[cursor] * 0.985);
          effectiveFlow[cellId] = Math.max(effectiveFlow[cellId], effectiveFlow[cursor] * 0.98);
          cursor = cellId;
        }
        downstream[cursor] = extension.waterCellId;
        tailCellId = cursor;
        tailDownstream = extension.waterCellId;
      }
    }

    let endType: TRiverEndType = 'inland-sink';
    if (tailDownstream === T_COAST_OUTLET) endType = 'offscreen';
    else if (tailDownstream >= 0 && cells[tailDownstream].isLake) endType = 'lake';
    else if (tailDownstream >= 0 && cells[tailDownstream].isWater) endType = 'sea';

    let length = 0;
    const polyline: Array<TPoint> = [];
    const pointOffsets: number[] = [];
    let peakFlow = 0;

    for (let index = 0; index < chain.length; index += 1) {
      const cellId = chain[index] as number;
      const cell = cells[cellId];
      polyline.push([cell.site[0], cell.site[1]]);
      peakFlow = Math.max(peakFlow, flow[cellId]);

      if (index > 0) {
        const previous = cells[chain[index - 1] as number].site;
        length += Math.hypot(cell.site[0] - previous[0], cell.site[1] - previous[1]);
      }

      if (index > 0) {
        const previous = polyline[polyline.length - 2] as TPoint;
        const segmentLength = Math.hypot(cell.site[0] - previous[0], cell.site[1] - previous[1]);
        if (segmentLength >= RIVER_CONFIG.meander.minSegmentLength) {
          const t = index / Math.max(1, chain.length - 1);
          const amount = RIVER_CONFIG.meander.base * (1 - t) * 6;
          const mx = (cell.site[0] + previous[0]) * 0.5;
          const my = (cell.site[1] + previous[1]) * 0.5;
          const dx = cell.site[0] - previous[0];
          const dy = cell.site[1] - previous[1];
          const invLen = 1 / Math.max(0.0001, Math.hypot(dx, dy));
          const nx = -dy * invLen;
          const ny = dx * invLen;
          polyline.splice(polyline.length - 1, 0, [mx + nx * amount, my + ny * amount]);
        }
      }
    }
    const kind = riverKind(peakFlow);
    const widthFactor = (riverParent.get(riverId) ?? null) === null ? 1.12 : 0.78;
    const startFlow = flow[sourceCellId];
    const startingWidth =
      Math.min(
        RIVER_CONFIG.width.maxFluxWidth,
        Math.pow(Math.max(0, startFlow), 0.7) / RIVER_CONFIG.width.fluxFactor
      ) +
      RIVER_CONFIG.width.minWidth * 0.2;

    for (let pointIndex = 0; pointIndex < chain.length; pointIndex += 1) {
      const cellId = chain[pointIndex] as number;
      const fluxWidth = Math.min(
        RIVER_CONFIG.width.maxFluxWidth,
        Math.pow(Math.max(0, flow[cellId]), 0.7) / RIVER_CONFIG.width.fluxFactor
      );
      const t = pointIndex / Math.max(1, chain.length - 1);
      const linearGrow = pointIndex / Math.max(1, RIVER_CONFIG.width.lengthFactor * 0.85);
      const earlyProgression = Math.log2(pointIndex + 2) * 0.14;
      const downstreamBoost = Math.pow(t, 1.65) * 1.55;
      const lengthWidth = linearGrow + earlyProgression + downstreamBoost;
      const offset = widthFactor * (lengthWidth + fluxWidth) + startingWidth;
      pointOffsets.push(offset);
    }

    // Smooth offsets to avoid abrupt width jumps while keeping downstream widening trend.
    for (let pass = 0; pass < 2; pass += 1) {
      for (let pointIndex = 1; pointIndex < pointOffsets.length - 1; pointIndex += 1) {
        const left = pointOffsets[pointIndex - 1] as number;
        const center = pointOffsets[pointIndex] as number;
        const right = pointOffsets[pointIndex + 1] as number;
        pointOffsets[pointIndex] = left * 0.25 + center * 0.5 + right * 0.25;
      }
    }
    for (let pointIndex = 1; pointIndex < pointOffsets.length; pointIndex += 1) {
      const prev = pointOffsets[pointIndex - 1] as number;
      if ((pointOffsets[pointIndex] as number) < prev) {
        pointOffsets[pointIndex] = prev + 0.01;
      }
    }
    for (let pointIndex = 0; pointIndex < chain.length; pointIndex += 1) {
      const cellId = chain[pointIndex] as number;
      const offset = pointOffsets[pointIndex] as number;
      riverWidthByCell[cellId] = Math.max(
        riverWidthByCell[cellId],
        Math.min(RIVER_CONFIG.width.maxWidth, Math.max(0.45, Math.pow(offset / 1.5, 1.8)))
      );
    }

    const leftBank: Array<TPoint> = [];
    const rightBank: Array<TPoint> = [];
    for (let pointIndex = 0; pointIndex < polyline.length; pointIndex += 1) {
      const current = polyline[pointIndex] as TPoint;
      const previous = polyline[Math.max(0, pointIndex - 1)] as TPoint;
      const next = polyline[Math.min(polyline.length - 1, pointIndex + 1)] as TPoint;
      const dirX = next[0] - previous[0];
      const dirY = next[1] - previous[1];
      const norm = Math.max(0.0001, Math.hypot(dirX, dirY));
      const nx = -dirY / norm;
      const ny = dirX / norm;
      const offset = pointOffsets[Math.min(pointOffsets.length - 1, pointIndex)] as number;
      leftBank.push([current[0] + nx * offset, current[1] + ny * offset]);
      rightBank.push([current[0] - nx * offset, current[1] - ny * offset]);
    }
    const polygon = [...leftBank, ...rightBank.reverse()];
    const mouthOffset = pointOffsets[pointOffsets.length - 1] ?? startingWidth;
    const mouthWidth = Math.min(
      RIVER_CONFIG.width.maxWidth,
      Math.max(0.45, Math.pow(mouthOffset / 1.5, 1.8))
    );

    rivers.push({
      id: riverId,
      sourceCellId,
      mouthCellId: tailCellId,
      endType,
      parentRiverId: riverParent.get(riverId) ?? null,
      tributaryIds: Array.from(tributaries.get(riverId) ?? []),
      basinId: riverId,
      kind,
      name: createRiverName(random, riverId, kind),
      length,
      mouthWidth,
      peakFlow,
      cells: chain,
      polyline,
      pointOffsets,
      polygon,
    });
  }

  return { riverByCell, riverWidthByCell, rivers, confluences };
}

export function generateRivers(
  cells: TCell[],
  seaLevel: number,
  precipitation: Float32Array,
  seed: string
): TRiverGenerationResult {
  const elevation = new Float32Array(cells.length);
  const isLand = new Uint8Array(cells.length);
  prepareTerrain(cells, elevation, isLand);

  const fillResult = fillDepressions(cells, elevation, isLand);
  const { downstream, flow, effectiveFlow } = accumulateFlow(
    cells,
    fillResult.filledElevation,
    isLand,
    precipitation,
    seaLevel
  );

  const { riverByCell, riverWidthByCell, rivers } = buildRiverGraph(
    cells,
    downstream,
    flow,
    effectiveFlow,
    seed
  );

  return {
    downstream,
    flow,
    effectiveFlow,
    riverByCell,
    riverWidthByCell,
    rivers,
    depressionIterations: fillResult.iterations,
    unresolvedDepressions: fillResult.unresolvedDepressions,
  };
}
