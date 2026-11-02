import { Delaunay } from 'd3-delaunay';
import { MESH_RELAXATION } from 'src/configs/map/common';
import { toPointKey } from 'src/services/utils/geometry';
import { clamp, createSeededRandom } from 'src/services/utils/math';
import { TCell, TDelaunayMesh, TEdge, TMeshParams, TPoint, TVertex } from 'src/types/global';

function genPoints({ width, height, seed, cellCount }: TMeshParams): TPoint[] {
  const random = createSeededRandom(`${seed}:points`);
  const columns = Math.max(1, Math.ceil(Math.sqrt((cellCount * width) / height)));
  const rows = Math.max(1, Math.ceil(cellCount / columns));
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const points: TPoint[] = [];

  for (let row = 0; row < rows && points.length < cellCount; row += 1) {
    for (let column = 0; column < columns && points.length < cellCount; column += 1) {
      const jitterX = (random() - 0.5) * cellWidth * 0.72;
      const jitterY = (random() - 0.5) * cellHeight * 0.72;
      const x = clamp((column + 0.5) * cellWidth + jitterX, 0, width);
      const y = clamp((row + 0.5) * cellHeight + jitterY, 0, height);

      points.push([x, y]);
    }
  }
  return points;
}

/**
 * One Lloyd pass: each point moves toward the centre of its Voronoi cell. Cells come out more even
 * in size and shape, which smooths coastlines and borders. Only part of the way, so the mesh
 * stays slightly irregular rather than turning into a honeycomb.
 */
function relaxPoints(points: TPoint[], width: number, height: number, strength: number): TPoint[] {
  const voronoi = Delaunay.from(points).voronoi([0, 0, width, height]);
  return points.map((point, index) => {
    const polygon = voronoi.cellPolygon(index);
    if (!polygon || polygon.length < 4) return point;
    let area = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < polygon.length - 1; i += 1) {
      const [x0, y0] = polygon[i];
      const [x1, y1] = polygon[i + 1];
      const cross = x0 * y1 - x1 * y0;
      area += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }
    if (Math.abs(area) < 1e-9) return point;
    const centroidX = cx / (3 * area);
    const centroidY = cy / (3 * area);
    return [
      clamp(point[0] + (centroidX - point[0]) * strength, 0, width),
      clamp(point[1] + (centroidY - point[1]) * strength, 0, height),
    ] as TPoint;
  });
}

function sanitizePolygon(polygon: Iterable<TPoint> | null | undefined): TPoint[] {
  if (!polygon) return [];

  const points = Array.from(polygon, ([x, y]) => [x, y] as TPoint);

  if (points.length > 1) {
    const [firstX, firstY] = points[0];
    const [lastX, lastY] = points[points.length - 1];

    if (firstX === lastX && firstY === lastY) points.pop();
  }
  return points;
}

function createEdgeKey(vertexAId: number, vertexBId: number) {
  return vertexAId < vertexBId ? `${vertexAId}:${vertexBId}` : `${vertexBId}:${vertexAId}`;
}

export function buildMesh({ width, height, seed, cellCount }: TMeshParams): TDelaunayMesh {
  let points = genPoints({ width, height, cellCount, seed });
  for (let pass = 0; pass < MESH_RELAXATION.passes; pass += 1) {
    points = relaxPoints(points, width, height, MESH_RELAXATION.strength);
  }
  const delaunay = Delaunay.from(points);
  const voronoi = delaunay.voronoi([0, 0, width, height]);
  const vertexIdByKey = new Map<string, number>();
  const vertices: TVertex[] = [];
  const edgeIdByKey = new Map<string, number>();
  const edges: TEdge[] = [];

  const cells: TCell[] = points.map((point, index) => {
    const polygon = sanitizePolygon(voronoi.cellPolygon(index));
    const vertexIds = polygon.map((polygonPoint) => {
      const pointKey = toPointKey(polygonPoint, { precision: 4 });
      const existingVertexId = vertexIdByKey.get(pointKey);

      if (existingVertexId !== undefined) return existingVertexId;

      const nextVertexId = vertices.length;
      vertexIdByKey.set(pointKey, nextVertexId);
      vertices.push({ id: nextVertexId, point: polygonPoint });

      return nextVertexId;
    });

    const edgeIds: number[] = [];

    for (let vertexIndex = 0; vertexIndex < vertexIds.length; vertexIndex += 1) {
      const startVertexId = vertexIds[vertexIndex];
      const endVertexId = vertexIds[(vertexIndex + 1) % vertexIds.length];
      const edgeKey = createEdgeKey(startVertexId, endVertexId);
      const existingEdgeId = edgeIdByKey.get(edgeKey);

      if (existingEdgeId !== undefined) {
        const existingEdge = edges[existingEdgeId];

        if (!existingEdge.cellIds.includes(index)) {
          existingEdge.cellIds.push(index);
          existingEdge.isBoundary = existingEdge.cellIds.length === 1;
        }

        edgeIds.push(existingEdgeId);
        continue;
      }

      const nextEdgeId = edges.length;
      edgeIdByKey.set(edgeKey, nextEdgeId);
      edges.push({
        id: nextEdgeId,
        vertexIds: [startVertexId, endVertexId],
        cellIds: [index],
        isBoundary: true,
      });
      edgeIds.push(nextEdgeId);
    }

    return {
      id: index,
      site: point,
      polygon,
      vertexIds,
      edgeIds,
      neighbors: Array.from(delaunay.neighbors(index)),
      elevation: 0,
      isWater: false,
      flow: 0,
      effectiveFlow: 0,
      riverWidth: 0,
      downstreamId: null,
      erosion: 0,
      isRiver: false,
      riverId: null,
      riverOrder: 0,
      isRiverSource: false,
      isRiverMouth: false,
      isLake: false,
      landform: 'plain',
      biome: 'unknown',
      suitability: 0,
      temperature: 0,
      precipitation: 0,
      rainShadow: 0,
      petProxy: 0,
      aridityIndex: 0,
      temperatureSeasonality: 0,
      precipitationSeasonality: 0,
      population: 0,
      economy: 0,
      waterAccessScore: 0,
      nationId: null,
      provinceId: null,
      ethnicId: null,
      zoneType: 'international-waters',
      isCapital: false,
      isEconomicHub: false,
    };
  });

  return { width, height, cells, edges, vertices, nations: [], ethnics: [], rivers: [], delaunay };
}
