import { Delaunay } from 'd3-delaunay';
import { TDelaunayMesh, TExportSnapshot } from 'src/types/global';

export type TSnapshotImportResult =
  | { ok: true; mesh: TDelaunayMesh }
  | { ok: false; error: string };

/**
 * Validates and rehydrates an exported map snapshot back into a renderable
 * mesh (rebuilding the non-serializable `delaunay` index from cell sites).
 */
export function parseSnapshot(snapshot: TExportSnapshot): TSnapshotImportResult {
  if (snapshot.schemaVersion !== 1) {
    return { ok: false, error: 'Unsupported schema version' };
  }

  if (!snapshot.mesh || !Array.isArray(snapshot.mesh.cells) || snapshot.mesh.cells.length === 0) {
    return { ok: false, error: 'Invalid mesh payload' };
  }

  const mesh: TDelaunayMesh = {
    ...snapshot.mesh,
    rivers: snapshot.mesh.rivers || [],
    delaunay: Delaunay.from(snapshot.mesh.cells.map((cell) => cell.site)),
  };

  return { ok: true, mesh };
}
