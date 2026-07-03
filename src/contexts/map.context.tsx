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
import { MapGenerator } from 'src/services/pipeline/MapGenerator';
import { computeTargetElevation, inferBiomeForLandform } from 'src/services/terrain/terrainPainter';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';
import { useTerrainEditorStore } from 'src/store/terrainEditorStore';
import { TDelaunayMesh, TExportSnapshot, TLandform, TTerrainOverride } from 'src/global';

interface TMapContextType {
  mesh: TDelaunayMesh;
  isGenerating: boolean;
  importFromSnapshot: (snapshot: TExportSnapshot) => { ok: true } | { ok: false; error: string };
  handlePointerMove: (x: number, y: number) => void;
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
  importFromSnapshot: () => ({ ok: false, error: 'Map context not ready' }),
  handlePointerMove: () => {},
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
      if (snapshot.schemaVersion !== 1)
        return { ok: false as const, error: 'Unsupported schema version' };

      if (
        !snapshot.mesh ||
        !Array.isArray(snapshot.mesh.cells) ||
        snapshot.mesh.cells.length === 0
      ) {
        return { ok: false as const, error: 'Invalid mesh payload' };
      }

      const nextMesh: TDelaunayMesh = {
        ...snapshot.mesh,
        rivers: snapshot.mesh.rivers || [],
        delaunay: Delaunay.from(snapshot.mesh.cells.map((cell) => cell.site)),
      };

      generationIdRef.current += 1;
      setMesh(nextMesh);
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

    const timer = window.setTimeout(() => {
      // Read locked overrides at generation time (not from closure)
      const lockedOverrides = useTerrainEditorStore.getState().lockedOverrides;

      const generator = new MapGenerator({
        width: DEFAULT_CONFIG.width,
        height: DEFAULT_CONFIG.height,
        seed,
        cellCount,
        seaLevel,
        topography,
        nationCount,
        climateControl,
      });

      const { geopolitics } = generator.generate(lockedOverrides);

      if (generationId !== generationIdRef.current) return;

      // Reset active paints — locked overrides are now baked into the new mesh
      originalElevationsRef.current.clear();
      activePaintsRef.current = {};
      setActivePaintCount(0);

      setMesh(geopolitics);
      setIsGenerating(false);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [cellCount, climateControl, nationCount, seaLevel, seed, topography, generationNonce]);

  const handlePointerMove = useCallback(
    (x: number, y: number) => {
      if (mesh.cells.length === 0) return;
      const i = mesh.delaunay.find(x, y);
      setHoverIndex(i);
    },
    [mesh.cells.length, mesh.delaunay, setHoverIndex]
  );

  const handleCellCountChange = useCallback(
    (nextValue: number) => {
      setCellCount(Math.min(DEFAULT_CONFIG.maxCells, Math.max(DEFAULT_CONFIG.minCells, nextValue)));
    },
    [setCellCount]
  );

  const paintTerrain = useCallback(
    (cellId: number, landform: TLandform) => {
      const cell = mesh.cells[cellId];
      if (!cell) return;

      if (!originalElevationsRef.current.has(cellId)) {
        originalElevationsRef.current.set(cellId, cell.elevation);
      }

      const newElevation = computeTargetElevation(
        landform,
        seaLevel,
        cell.site,
        mesh.width,
        mesh.height,
        seed,
        cellId
      );
      const newIsWater = newElevation < seaLevel;

      cell.elevation = newElevation;
      cell.isWater = newIsWater;
      cell.landform = landform;
      cell.biome = inferBiomeForLandform(
        landform,
        cell.temperature,
        cell.precipitation,
        cell.biome
      );

      // Track this paint as an active (unapplied) override
      const isNew = !(cellId in activePaintsRef.current);
      activePaintsRef.current[cellId] = { elevation: newElevation, landform, isWater: newIsWater };
      if (isNew) setActivePaintCount((n) => n + 1);

      // Soft blend into immediate neighbors to avoid hard cliff edges
      for (const neighborId of cell.neighbors) {
        const nb = mesh.cells[neighborId];
        if (!nb || originalElevationsRef.current.has(neighborId)) continue;
        nb.elevation = nb.elevation * 0.88 + newElevation * 0.12;
      }

      setMesh((prev) => ({ ...prev, cells: [...prev.cells] }));
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
      importFromSnapshot,
      handlePointerMove,
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
    importFromSnapshot,
    handlePointerMove,
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
