'use client';

import { DEFAULT_CONFIG } from 'src/configs/map/common';
import { generateRandomSeed } from 'src/services/utils/seed';
import { parseWorldParams } from 'src/services/utils/worldUrl';
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
  /** Switch to a whole world at once, so only one map is generated. */
  applyWorld: (world: Pick<TMapExplorerState, 'seed' | 'topography'>) => void;
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

// Before v9 the defaults compensated for a weak climate model; anyone still on them gets the new ones.
function isOldDefaultClimate(climate: Partial<TClimateControl> | undefined) {
  return (
    climate?.temperatureOffset === 0.2 &&
    climate.temperatureContrast === 1.5 &&
    climate.precipitationScale === 1.5 &&
    climate.precipitationOffset === 0.3
  );
}

export const useMapExplorerStore = create<TMapExplorerStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,
      setSeed(seed: string) {
        set({ seed, hoverIndex: null });
      },
      applyWorld({ seed, topography }) {
        set({
          seed,
          topography,
          seaLevel: DEFAULT_CONFIG.seaLevel,
          nationCount: DEFAULT_CONFIG.nationCount,
          cellCount: DEFAULT_CONFIG.cellCount,
          hoverIndex: null,
        });
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
      version: 9,
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<TMapExplorerState> | undefined;
        if (!state) return DEFAULT_STATE;
        const persistedDisplaySettings = state.displaySettings as TDisplaySettings | undefined;
        return {
          ...DEFAULT_STATE,
          ...state,
          topography: state.topography || DEFAULT_CONFIG.topography,
          climateControl: {
            ...DEFAULT_CONFIG.climateControl,
            ...(version < 9 && isOldDefaultClimate(state.climateControl)
              ? {}
              : state.climateControl),
          },
          displaySettings: { ...DEFAULT_CONFIG.displaySettings, ...persistedDisplaySettings },
        };
      },
    }
  )
);

// The very first visit has no saved UI state. Read it before anything writes to storage.
function isFirstVisit() {
  try {
    const raw = window.localStorage.getItem('ui-state');
    if (!raw) return true;
    return (JSON.parse(raw) as { state?: { introSeen?: boolean } }).state?.introSeen !== true;
  } catch {
    return false;
  }
}

// Runs once in the browser, before React renders: a shared link wins, a first-time visitor gets a
// random world instead of the same default one, and everyone else keeps what they had.
function applyInitialWorld() {
  const store = useMapExplorerStore.getState();
  const shared = parseWorldParams(window.location.search);
  if (shared.seed) {
    store.setSeed(shared.seed);
    if (shared.topography) store.setTopography(shared.topography);
    if (shared.seaLevel !== undefined) store.setSeaLevel(shared.seaLevel);
    if (shared.nationCount !== undefined) store.setNationCount(shared.nationCount);
    if (shared.cellCount !== undefined) store.setCellCount(shared.cellCount);
    return;
  }
  if (isFirstVisit()) store.setSeed(generateRandomSeed());
}

if (typeof window !== 'undefined') applyInitialWorld();
