import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LANDFORM_CONFIG } from 'src/configs/map/landform-biome';
import { TCell, TLandform } from 'src/types/global';

const T_VERTEX_MERGE_RADIUS = 0.5;
const T_VERTEX_GRID_CELL_SIZE = 1;

function getElevationHeight(elevation: number, landform: TLandform | null): number {
  const base = elevation * 16;
  if (landform === 'mountain' || landform === 'volcanic_field') return base * 2.2;
  if (landform === 'hills') return base * 1.4;
  if (landform === 'plateau') return base * 1.3;
  if (landform === 'valley') return base * 0.9;
  return base;
}

function elevationTint(elevation: number, baseColor: THREE.Color): THREE.Color {
  const result = baseColor.clone();
  if (elevation > 0.7) {
    const t = (elevation - 0.7) / 0.3;
    result.lerp(new THREE.Color(0xd0dce8), t * 0.25);
  } else if (elevation < 0.15) {
    const t = 1 - elevation / 0.15;
    result.lerp(new THREE.Color(0x000000), t * 0.1);
  }
  return result;
}

type TVertexGridEntry = { cellIndex: number; x: number; y: number; height: number };

/**
 * Buckets every cell's polygon vertices by a coarse grid cell (sized so a
 * T_VERTEX_MERGE_RADIUS search never needs more than the 3x3 neighborhood)
 * so nearby-vertex lookups don't have to scan every cell in the mesh.
 */
function buildVertexGrid(cells: TCell[]): Map<string, TVertexGridEntry[]> {
  const grid = new Map<string, TVertexGridEntry[]>();
  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    const c = cells[cellIndex];
    const landform = c.isWater ? ('coast' as TLandform) : c.landform;
    const height = getElevationHeight(c.elevation, landform);
    for (const v of c.polygon) {
      const bucketKey = `${Math.floor(v[0] / T_VERTEX_GRID_CELL_SIZE)},${Math.floor(v[1] / T_VERTEX_GRID_CELL_SIZE)}`;
      let bucket = grid.get(bucketKey);
      if (!bucket) {
        bucket = [];
        grid.set(bucketKey, bucket);
      }
      bucket.push({ cellIndex, x: v[0], y: v[1], height });
    }
  }
  return grid;
}

/** At most one contribution per cell, matching the original brute-force scan. */
function averageHeightNearVertex(
  x: number,
  y: number,
  grid: Map<string, TVertexGridEntry[]>
): { sum: number; count: number } {
  let sum = 0;
  let count = 0;
  const countedCells = new Set<number>();
  const bx = Math.floor(x / T_VERTEX_GRID_CELL_SIZE);
  const by = Math.floor(y / T_VERTEX_GRID_CELL_SIZE);
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      const bucket = grid.get(`${bx + dx},${by + dy}`);
      if (!bucket) continue;
      for (const entry of bucket) {
        if (countedCells.has(entry.cellIndex)) continue;
        if (Math.hypot(entry.x - x, entry.y - y) < T_VERTEX_MERGE_RADIUS) {
          countedCells.add(entry.cellIndex);
          sum += entry.height;
          count += 1;
        }
      }
    }
  }
  return { sum, count };
}

function buildCellGeometry(
  cell: TCell,
  landform: TLandform | null,
  vertexGrid: Map<string, TVertexGridEntry[]>,
  vertexElevationCache: Map<string, number>
): THREE.BufferGeometry {
  const poly = cell.polygon;
  const n = poly.length;
  if (n < 3) return new THREE.BufferGeometry();

  const baseColor = landform
    ? new THREE.Color(LANDFORM_CONFIG[landform].color)
    : new THREE.Color(0x3f3f46);
  const topColor = elevationTint(cell.elevation, baseColor);

  const vertexKey = (px: number, py: number) => `${px.toFixed(2)},${py.toFixed(2)}`;

  const vertexElevations: number[] = [];
  for (let i = 0; i < n; i++) {
    const key = vertexKey(poly[i][0], poly[i][1]);
    let avgElev = vertexElevationCache.get(key);
    if (avgElev === undefined) {
      const { sum, count } = averageHeightNearVertex(poly[i][0], poly[i][1], vertexGrid);
      avgElev = count > 0 ? sum / count : getElevationHeight(cell.elevation, landform);
      vertexElevationCache.set(key, avgElev);
    }
    vertexElevations.push(avgElev);
  }

  const vertices: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < n; i++) {
    vertices.push(poly[i][0], -poly[i][1], vertexElevations[i]);
    colors.push(topColor.r, topColor.g, topColor.b);
  }
  const darkerBot = baseColor.clone().lerp(new THREE.Color(0x000000), 0.35);
  for (let i = 0; i < n; i++) {
    vertices.push(poly[i][0], -poly[i][1], 0);
    colors.push(darkerBot.r, darkerBot.g, darkerBot.b);
  }

  const topStart = 0;
  const bottomStart = n;

  for (let i = 1; i < n - 1; i++) {
    indices.push(topStart, topStart + i, topStart + i + 1);
  }
  for (let i = 1; i < n - 1; i++) {
    indices.push(bottomStart, bottomStart + i + 1, bottomStart + i);
  }
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const a = topStart + i;
    const b = topStart + next;
    const c = bottomStart + next;
    const d = bottomStart + i;
    indices.push(a, b, c, a, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * Builds one merged, vertex-smoothed terrain geometry for the whole mesh
 * (a single draw call instead of one THREE.Mesh per cell). Disposes all
 * intermediate per-cell geometries itself; the caller owns the returned
 * merged geometry's lifetime.
 */
export function buildTerrainGeometry(cells: TCell[]): THREE.BufferGeometry | null {
  const vertexElevationCache = new Map<string, number>();
  const vertexGrid = buildVertexGrid(cells);

  const perCellGeometries: THREE.BufferGeometry[] = [];
  for (const cell of cells) {
    const landform = cell.isWater ? ('coast' as TLandform) : cell.landform;
    const geom = buildCellGeometry(cell, landform, vertexGrid, vertexElevationCache);
    if (geom.attributes.position.count === 0) {
      geom.dispose();
      continue;
    }
    perCellGeometries.push(geom);
  }

  const mergedGeometry =
    perCellGeometries.length > 0 ? mergeGeometries(perCellGeometries, false) : null;
  for (const geom of perCellGeometries) geom.dispose();

  return mergedGeometry;
}
