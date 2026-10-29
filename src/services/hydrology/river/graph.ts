import { RIVER_CONFIG } from 'src/configs/map/hydrology';
import { TCell, TPoint, TRiver, TRiverEndType } from 'src/types/global';
import { createSeededRandom } from 'src/services/utils/math';
import { T_COAST_OUTLET } from './flow';
import { createRiverName, outletEndType, riverKind } from './helpers';

type TConfluenceEvent = {
  atCellId: number;
  mainRiverId: number;
  tributaryRiverId: number;
};

export function buildRiverGraph(
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
  const confluenceCell = new Map<number, number>();

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
        // The river that was traced first owns the shared channel; the later one joins it.
        riverParent.set(riverId, existingRiver);
        tributaries.set(existingRiver, tributaries.get(existingRiver) ?? new Set<number>());
        tributaries.get(existingRiver)?.add(riverId);
        confluenceCell.set(riverId, cursor);
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
    const tailCellId = chain[chain.length - 1] as number;
    const tailDownstream = downstream[tailCellId];
    const joinedAt = confluenceCell.get(riverId);

    // Flow directions already lead to water (priority-flood), so a river only ends in three ways:
    // it joins another river, it enters a water cell, or it leaves through a coast outlet.
    let endType: TRiverEndType = 'inland-sink';
    if (joinedAt !== undefined) {
      endType = 'confluence';
      chain.push(joinedAt);
    } else if (tailDownstream >= 0 && cells[tailDownstream].isLake) endType = 'lake';
    else if (tailDownstream >= 0 && cells[tailDownstream].isWater) endType = 'sea';
    else if (tailDownstream === T_COAST_OUTLET) endType = outletEndType(cells, tailCellId);

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
      order: 1,
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

  const orders = computeStrahlerOrders(rivers, tributaries);
  for (const river of rivers) river.order = orders.get(river.id) ?? 1;

  return { riverByCell, riverWidthByCell, rivers, confluences };
}

/** Strahler stream order: two tributaries of equal top order raise the order of the river they feed. */
export function computeStrahlerOrders(rivers: TRiver[], tributaries: Map<number, Set<number>>) {
  const kept = new Set(rivers.map((river) => river.id));
  const orders = new Map<number, number>();
  const orderOf = (riverId: number): number => {
    const known = orders.get(riverId);
    if (known !== undefined) return known;
    const childOrders = Array.from(tributaries.get(riverId) ?? [])
      .filter((childId) => kept.has(childId))
      .map(orderOf);
    const top = Math.max(0, ...childOrders);
    const order =
      top === 0 ? 1 : childOrders.filter((value) => value === top).length >= 2 ? top + 1 : top;
    orders.set(riverId, order);
    return order;
  };
  for (const river of rivers) orderOf(river.id);
  return orders;
}
