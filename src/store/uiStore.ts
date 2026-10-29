'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TConfigPanel =
  | 'generation'
  | 'display'
  | 'palette'
  | 'nations'
  | 'ethnic'
  | 'export'
  | 'terrain';

const CONFIG_PANELS: readonly TConfigPanel[] = [
  'generation',
  'display',
  'palette',
  'nations',
  'ethnic',
  'export',
  'terrain',
];

type TToolbarPosition = { x: number; y: number };

type TUiState = {
  configOpen: boolean;
  configPanel: TConfigPanel;
  toolbarCollapsed: boolean;
  /** nation/ethnic side panel; not persisted */
  detailOpen: boolean;
  detailNationId: number | null;
  detailEthnicId: number | null;
  /** the welcome screen was dismissed once */
  introSeen: boolean;
  /** reopened on demand (the ? button) after it was already seen; not persisted */
  introReopened: boolean;
  /** pixels inside the map area; null = default (centered at the top) */
  toolbarPosition: TToolbarPosition | null;
};

type TUiActions = {
  setConfigOpen: (open: boolean) => void;
  setConfigPanel: (panel: TConfigPanel) => void;
  openConfig: (panel?: TConfigPanel) => void;
  setToolbarCollapsed: (collapsed: boolean) => void;
  openDetail: (nationId: number | null, ethnicId: number | null) => void;
  closeDetail: () => void;
  showIntro: () => void;
  dismissIntro: () => void;
  setToolbarPosition: (position: TToolbarPosition | null) => void;
};

export const useUiStore = create<TUiState & TUiActions>()(
  persist(
    (set) => ({
      configOpen: false,
      configPanel: 'generation',
      toolbarCollapsed: false,
      detailOpen: false,
      detailNationId: null,
      detailEthnicId: null,
      introSeen: false,
      introReopened: false,
      toolbarPosition: null,
      setConfigOpen(configOpen) {
        set({ configOpen });
      },
      setConfigPanel(configPanel) {
        set({ configPanel });
      },
      openConfig(panel) {
        set((state) => ({
          configOpen: true,
          toolbarCollapsed: false,
          configPanel: panel ?? state.configPanel,
        }));
      },
      openDetail(detailNationId, detailEthnicId) {
        set({ detailOpen: true, detailNationId, detailEthnicId });
      },
      closeDetail() {
        set({ detailOpen: false });
      },
      showIntro() {
        set({ introReopened: true });
      },
      dismissIntro() {
        set({ introSeen: true, introReopened: false });
      },
      setToolbarCollapsed(toolbarCollapsed) {
        set({ toolbarCollapsed });
      },
      setToolbarPosition(toolbarPosition) {
        set({ toolbarPosition });
      },
    }),
    {
      name: 'ui-state',
      partialize: (state) => ({
        configPanel: state.configPanel,
        toolbarCollapsed: state.toolbarCollapsed,
        introSeen: state.introSeen,
        toolbarPosition: state.toolbarPosition,
      }),
      version: 3,
      merge: (persisted, current) => {
        const stored = persisted as Partial<TUiState> | undefined;
        const position = stored?.toolbarPosition;
        const validPosition =
          position && Number.isFinite(position.x) && Number.isFinite(position.y)
            ? { x: position.x, y: position.y }
            : null;
        return {
          ...current,
          configPanel:
            stored?.configPanel && CONFIG_PANELS.includes(stored.configPanel)
              ? stored.configPanel
              : current.configPanel,
          toolbarCollapsed: stored?.toolbarCollapsed === true,
          introSeen: stored?.introSeen === true,
          toolbarPosition: validPosition,
        };
      },
    }
  )
);
