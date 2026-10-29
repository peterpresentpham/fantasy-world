'use client';

import { TGenerationStage } from 'src/types/global';
import { create } from 'zustand';

// Which pipeline stage the worker is currently running. Transient UI state, never persisted.
type TGenerationStore = {
  stage: TGenerationStage | null;
  setStage: (stage: TGenerationStage | null) => void;
};

export const useGenerationStore = create<TGenerationStore>()((set) => ({
  stage: null,
  setStage(stage) {
    set({ stage });
  },
}));
