import { TPoint } from 'src/types/global';
import { TPlate, TPlateBoundaryInfo, classifyBoundaryForCell } from './tectonics';

export type TBoundaryField = {
  /** Per cell: distance to the nearest plate boundary, normalised by the map diagonal. */
  distance: Float32Array;
  /** Per cell: the boundary it is nearest to, seen from the cell's own plate. */
  info: TPlateBoundaryInfo[];
};

const NO_SOURCE = -1;

/**
 * Walks outwards from every plate-boundary cell (multi-source breadth-first search over the mesh)
 * so each cell knows how far it really is from a boundary and what kind of boundary that is.
 */
export function buildBoundaryField(
  neighbors: ReadonlyArray<ReadonlyArray<number>>,
  sites: ReadonlyArray<TPoint>,
  plates: ReadonlyArray<TPlate>,
  cellPlateId: Int32Array,
  width: number,
  height: number,
  seaLevel: number
): TBoundaryField {
  const count = sites.length;
  const diagonal = Math.hypot(width, height);
  const source = new Int32Array(count).fill(NO_SOURCE);
  const queue: number[] = [];
  const sourceInfo = new Map<number, TPlateBoundaryInfo>();

  for (let cell = 0; cell < count; cell += 1) {
    if (!neighbors[cell].some((other) => cellPlateId[other] !== cellPlateId[cell])) continue;
    source[cell] = cell;
    queue.push(cell);
    sourceInfo.set(
      cell,
      classifyBoundaryForCell(
        cell,
        sites[cell][0],
        sites[cell][1],
        neighbors[cell],
        sites,
        plates,
        cellPlateId,
        seaLevel,
        width,
        height
      )
    );
  }

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head] as number;
    for (const next of neighbors[current]) {
      if (source[next] !== NO_SOURCE) continue;
      source[next] = source[current];
      queue.push(next);
    }
  }

  const distance = new Float32Array(count).fill(1);
  const info: TPlateBoundaryInfo[] = new Array(count);

  for (let cell = 0; cell < count; cell += 1) {
    const origin = source[cell];
    const own = plates[cellPlateId[cell]];
    const none: TPlateBoundaryInfo = {
      boundaryKind: 'none',
      convergenceRate: 0,
      divergenceRate: 0,
      distanceToBoundary: 1,
      isContinental: own.kind === 'continental',
      neighborPlateKind: null,
      neighborPlateId: -1,
    };
    const found = origin === NO_SOURCE ? undefined : sourceInfo.get(origin);
    if (!found || found.boundaryKind === 'none') {
      info[cell] = none;
      continue;
    }

    const d =
      Math.hypot(sites[cell][0] - sites[origin][0], sites[cell][1] - sites[origin][1]) / diagonal;
    distance[cell] = d;

    // The boundary was classified from the origin cell's plate. Seen from the other side the
    // relative motion is the same, only "own" and "neighbour" trade places.
    const originPlate = cellPlateId[origin];
    const neighborId = cellPlateId[cell] === originPlate ? found.neighborPlateId : originPlate;
    const neighborPlate = plates[neighborId] ?? plates[found.neighborPlateId];
    info[cell] = {
      ...found,
      distanceToBoundary: d,
      isContinental: own.kind === 'continental',
      neighborPlateKind: neighborPlate.kind,
      neighborPlateId: neighborId,
    };
  }

  return { distance, info };
}
