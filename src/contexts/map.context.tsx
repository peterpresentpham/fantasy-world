'use client';

import { Delaunay } from 'd3-delaunay';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DEFAULT_CONFIG } from 'src/configs/map/common';
import { generateInWorker } from 'src/services/pipeline/generationClient';
import { parseSnapshot } from 'src/services/pipeline/snapshot';
import { paintCellTerrain } from 'src/services/terrain/paint';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';
import { useTerrainEditorStore } from 'src/store/terrainEditorStore';
import { TDelaunayMesh, TExportSnapshot, TLandform, TTerrainOverride } from 'src/types/global';

interface TMapContextType {
  mesh: TDelaunayMesh;
  isGenerating: boolean;
  // Bumped on each terrain-paint stroke — cells are mutated in place during
  // painting (see paintTerrain), so `mesh`/`mesh.cells` keep the same
  // reference; consumers that need to reflect live paint edits should depend
  // on this instead of re-deriving from a copied cells array every stroke.
  paintVersion: number;
  importFromSnapshot: (snapshot: TExportSnapshot) => { ok: true } | { ok: false; error: string };
  handleCellCountChange: (nextValue: number) => void;
  paintTerrain: (cellId: number, landform: TLandform) => void;
  clearTerrainPaints: () => void;
  applyTerrainEdits: () => void;
  activePaintCount: number;
  lockedPaintCount: number;
}

const mapContextDefault: TMapContextType = {
  mesh: {
    width: DEFAULT_CONFIG.width,
    height: DEFAULT_CONFIG.height,
    cells: [],
    edges: [],
    vertices: [],
    nations: [],
    ethnics: [],
    rivers: [],
    delaunay: Delaunay.from([[0, 0]]),
  },
  isGenerating: true,
  paintVersion: 0,
  importFromSnapshot: () => ({ ok: false, error: 'Map context not ready' }),
  handleCellCountChange: () => {},
  paintTerrain: () => {},
  clearTerrainPaints: () => {},
  applyTerrainEdits: () => {},
  activePaintCount: 0,
  lockedPaintCount: 0,
};

const MapContext = createContext<TMapContextType>(mapContextDefault);

interface TProps {
  children: ReactNode;
}

export default function MapProvider({ children }: TProps) {
  const generationIdRef = useRef(0);
  const originalElevationsRef = useRef<Map<number, number>>(new Map());
  // Tracks cells painted in the current session but not yet applied
  const activePaintsRef = useRef<Record<number, TTerrainOverride>>({});
  const [activePaintCount, setActivePaintCount] = useState(0);
  // Bump to force re-generation when Apply is pressed
  const [generationNonce, setGenerationNonce] = useState(0);
  // Bump on each paint stroke — see TMapContextType.paintVersion above
  const [paintVersion, setPaintVersion] = useState(0);

  const {
    seed,
    cellCount,
    seaLevel,
    topography,
    nationCount,
    climateControl,
    setCellCount,
    setHoverIndex,
  } = useMapExplorerStore();

  const { lockOverrides, clearLockedOverrides, lockedOverrides } = useTerrainEditorStore();

  const [mesh, setMesh] = useState(mapContextDefault.mesh);
  const [isGenerating, setIsGenerating] = useState(true);

  const importFromSnapshot = useCallback(
    (snapshot: TExportSnapshot) => {
      const result = parseSnapshot(snapshot);
      if (!result.ok) return result;

      generationIdRef.current += 1;
      setMesh(result.mesh);
      setIsGenerating(false);
      setHoverIndex(null);
      return { ok: true as const };
    },
    [setHoverIndex]
  );

  useEffect(() => {
    generationIdRef.current += 1;
    const generationId = generationIdRef.current;
    setIsGenerating(true);

    // Read locked overrides at generation time (not from closure)
    const lockedOverrides = useTerrainEditorStore.getState().lockedOverrides;

    generateInWorker(
      {
        width: DEFAULT_CONFIG.width,
        height: DEFAULT_CONFIG.height,
        seed,
        cellCount,
        seaLevel,
        topography,
        nationCount,
        climateControl,
      },
      lockedOverrides
    )
      .then(({ geopolitics }) => {
        if (generationId !== generationIdRef.current) return;

        // Reset active paints — locked overrides are now baked into the new mesh
        originalElevationsRef.current.clear();
        activePaintsRef.current = {};
        setActivePaintCount(0);

        setMesh(geopolitics);
        setIsGenerating(false);
      })
      .catch((error: unknown) => {
        if (generationId !== generationIdRef.current) return;
        console.error('Map generation failed', error);
        setIsGenerating(false);
      });
  }, [cellCount, climateControl, nationCount, seaLevel, seed, topography, generationNonce]);

  const handleCellCountChange = useCallback(
    (nextValue: number) => {
      setCellCount(Math.min(DEFAULT_CONFIG.maxCells, Math.max(DEFAULT_CONFIG.minCells, nextValue)));
    },
    [setCellCount]
  );

  const paintTerrain = useCallback(
    (cellId: number, landform: TLandform) => {
      if (!originalElevationsRef.current.has(cellId)) {
        const cell = mesh.cells[cellId];
        if (!cell) return;
        originalElevationsRef.current.set(cellId, cell.elevation);
      }

      const override = paintCellTerrain(
        mesh.cells,
        cellId,
        landform,
        seaLevel,
        seed,
        mesh.width,
        mesh.height,
        originalElevationsRef.current
      );
      if (!override) return;

      // Track this paint as an active (unapplied) override
      const isNew = !(cellId in activePaintsRef.current);
      activePaintsRef.current[cellId] = override;
      if (isNew) setActivePaintCount((n) => n + 1);

      // Cells are mutated in place above — bump the version instead of
      // copying the (up to 15k-entry) cells array to signal the change.
      setPaintVersion((v) => v + 1);
    },
    [mesh, seaLevel, seed]
  );

  const applyTerrainEdits = useCallback(() => {
    const active = activePaintsRef.current;
    if (Object.keys(active).length === 0) return;

    // Merge active paints on top of any previously locked overrides
    const existing = useTerrainEditorStore.getState().lockedOverrides;
    const merged: Record<number, TTerrainOverride> = { ...existing, ...active };
    lockOverrides(merged);

    // Re-generation will clear activePaintsRef once it completes
    setGenerationNonce((n) => n + 1);
  }, [lockOverrides]);

  const clearTerrainPaints = useCallback(() => {
    // Clear all active paints
    activePaintsRef.current = {};
    setActivePaintCount(0);
    originalElevationsRef.current.clear();

    // Clear locked overrides — next generation runs without any overrides
    clearLockedOverrides();
    setGenerationNonce((n) => n + 1);
  }, [clearLockedOverrides]);

  const lockedPaintCount = Object.keys(lockedOverrides).length;

  const contextData = useMemo<TMapContextType>(() => {
    return {
      mesh,
      isGenerating,
      paintVersion,
      importFromSnapshot,
      handleCellCountChange,
      paintTerrain,
      clearTerrainPaints,
      applyTerrainEdits,
      activePaintCount,
      lockedPaintCount,
    };
  }, [
    mesh,
    isGenerating,
    paintVersion,
    importFromSnapshot,
    handleCellCountChange,
    paintTerrain,
    clearTerrainPaints,
    applyTerrainEdits,
    activePaintCount,
    lockedPaintCount,
  ]);

  return <MapContext.Provider value={contextData}>{children}</MapContext.Provider>;
}

export function useMapContext() {
  return useContext(MapContext);
}
