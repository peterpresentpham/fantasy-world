import { create } from 'zustand';
import { TLandform, TTerrainOverride } from 'src/global';

type TTerrainEditorStore = {
  editMode: boolean;
  selectedLandform: TLandform | null;
  lockedOverrides: Record<number, TTerrainOverride>;
  setEditMode: (enabled: boolean) => void;
  setSelectedLandform: (landform: TLandform | null) => void;
  lockOverrides: (overrides: Record<number, TTerrainOverride>) => void;
  clearLockedOverrides: () => void;
};

export const useTerrainEditorStore = create<TTerrainEditorStore>((set) => ({
  editMode: false,
  selectedLandform: null,
  lockedOverrides: {},
  setEditMode: (enabled) => set({ editMode: enabled }),
  setSelectedLandform: (landform) => set({ selectedLandform: landform }),
  lockOverrides: (overrides) => set({ lockedOverrides: overrides }),
  clearLockedOverrides: () => set({ lockedOverrides: {} }),
}));
