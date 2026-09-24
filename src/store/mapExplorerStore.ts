'use client';

import { DEFAULT_CONFIG } from 'src/configs/map/common';
import { TClimateControl, TDisplaySettings, TTopography } from 'src/types/global';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TMapExplorerState {
  seed: string;
  cellCount: number;
  seaLevel: number;
  topography: TTopography;
  nationCount: number;
  climateControl: TClimateControl;
  displaySettings: TDisplaySettings;
  hoverIndex: number | null;
  hoverClientPoint: { x: number; y: number } | null;
  resetCounter: number;
}

type TMapExplorerActions = {
  setSeed: (seed: string) => void;
  setCellCount: (cellCount: number) => void;
  setSeaLevel: (seaLevel: number) => void;
  setTopography: (topography: TTopography) => void;
  setNationCount: (nationCount: number) => boolean;
  setClimateControl: (climateControl: TClimateControl) => void;
  setDisplaySettings: (displaySettings: TDisplaySettings) => void;
  setDisplayLayer: <K extends keyof TDisplaySettings>(layer: K, enabled: boolean) => void;
  setHoverIndex: (hoverIndex: number | null) => void;
  setHoverClientPoint: (point: { x: number; y: number } | null) => void;
  resetSelection: () => void;
  resetToDefaults: () => void;
};

type TMapExplorerStore = TMapExplorerState & TMapExplorerActions;

const DEFAULT_STATE: TMapExplorerState = {
  seed: DEFAULT_CONFIG.seed,
  cellCount: DEFAULT_CONFIG.cellCount,
  seaLevel: DEFAULT_CONFIG.seaLevel,
  topography: DEFAULT_CONFIG.topography,
  nationCount: DEFAULT_CONFIG.nationCount,
  climateControl: DEFAULT_CONFIG.climateControl,
  displaySettings: DEFAULT_CONFIG.displaySettings,
  hoverIndex: null,
  hoverClientPoint: null,
  resetCounter: 0,
};

export const useMapExplorerStore = create<TMapExplorerStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,
      setSeed(seed: string) {
        set({ seed, hoverIndex: null });
      },
      setCellCount(cellCount: number) {
        set({ cellCount, hoverIndex: null });
      },
      setSeaLevel(seaLevelDraft: number) {
        const { seaLevel } = get();
        if (seaLevel === seaLevelDraft) return;
        set({ seaLevel: seaLevelDraft, hoverIndex: null });
      },
      setTopography(topography: TTopography) {
        set({ topography, hoverIndex: null });
      },
      setNationCount(nationCount: number) {
        if (nationCount < 2 || nationCount > 40) return false;
        set({ nationCount, hoverIndex: null });
        return true;
      },
      setClimateControl(climateControl: TClimateControl) {
        set({ climateControl, hoverIndex: null });
      },
      setDisplaySettings(displaySettings: TDisplaySettings) {
        const normalizedBase = { ...DEFAULT_CONFIG.displaySettings, ...displaySettings };
        const normalizedSettings = normalizedBase.nationBorders
          ? normalizedBase
          : { ...normalizedBase, provinceBorders: false };
        set({ displaySettings: normalizedSettings });
      },
      setDisplayLayer<K extends keyof TDisplaySettings>(layer: K, enabled: boolean) {
        const current = get().displaySettings;
        const nextSettings = { ...current, [layer]: enabled };
        if (!nextSettings.nationBorders) nextSettings.provinceBorders = false;
        set({ displaySettings: nextSettings });
      },
      setHoverIndex(hoverIndex: number | null) {
        if (get().hoverIndex === hoverIndex) return;
        set({ hoverIndex });
      },
      setHoverClientPoint(point: { x: number; y: number } | null) {
        set({ hoverClientPoint: point });
      },
      resetSelection() {
        set({ hoverIndex: null, hoverClientPoint: null });
      },
      resetToDefaults() {
        set({
          ...DEFAULT_STATE,
          hoverIndex: null,
          hoverClientPoint: null,
          resetCounter: Date.now(),
        });
      },
    }),
    {
      name: 'map-explorer',
      partialize: (state) => ({
        seed: state.seed,
        cellCount: state.cellCount,
        seaLevel: state.seaLevel,
        topography: state.topography,
        nationCount: state.nationCount,
        climateControl: state.climateControl,
        displaySettings: state.displaySettings,
      }),
      version: 8,
      migrate: (persistedState) => {
        const state = persistedState as Partial<TMapExplorerState> | undefined;
        if (!state) return DEFAULT_STATE;
        const persistedDisplaySettings = state.displaySettings as TDisplaySettings | undefined;
        return {
          ...DEFAULT_STATE,
          ...state,
          topography: state.topography || DEFAULT_CONFIG.topography,
          climateControl: { ...DEFAULT_CONFIG.climateControl, ...state.climateControl },
          displaySettings: { ...DEFAULT_CONFIG.displaySettings, ...persistedDisplaySettings },
        };
      },
    }
  )
);
