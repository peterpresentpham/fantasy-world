'use client';

import { buildRoadEdgeKey, findLogisticsRoute } from 'src/services/logistics/routeFinder';
import { TDelaunayMesh } from 'src/types/global';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type TLogisticsState = {
  enabled: boolean;
  startCellId: number | null;
  goalCellId: number | null;
  budget: number;
  roadEdges: string[];
  routeCellIds: number[];
  routeTotalCost: number;
  routeDistance: number;
  routeRisk: number;
  routeScore: number;
};

type TLogisticsActions = {
  setEnabled: (enabled: boolean) => void;
  setStartCellId: (cellId: number | null) => void;
  setGoalCellId: (cellId: number | null) => void;
  handleMapCellClick: (cellId: number) => void;
  resetRouteSelection: () => void;
  recalculateRoute: (mesh: TDelaunayMesh) => void;
  buildRoadOnCurrentRoute: () => void;
  resetGame: () => void;
};

type TLogisticsGameStore = TLogisticsState & TLogisticsActions;

const DEFAULT_STATE: TLogisticsState = {
  enabled: false,
  startCellId: null,
  goalCellId: null,
  budget: 140,
  roadEdges: [],
  routeCellIds: [],
  routeTotalCost: 0,
  routeDistance: 0,
  routeRisk: 0,
  routeScore: 0,
};

export const useLogisticsGameStore = create<TLogisticsGameStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,
      setEnabled(enabled) {
        set({ enabled });
      },
      setStartCellId(startCellId) {
        set({ startCellId });
      },
      setGoalCellId(goalCellId) {
        set({ goalCellId });
      },
      handleMapCellClick(cellId) {
        const { startCellId, goalCellId } = get();
        if (startCellId === null) {
          set({ startCellId: cellId });
          return;
        }
        if (goalCellId === null) {
          set({ goalCellId: cellId });
          return;
        }
        set({ startCellId: cellId, goalCellId: null, routeCellIds: [] });
      },
      resetRouteSelection() {
        set({
          startCellId: null,
          goalCellId: null,
          routeCellIds: [],
          routeTotalCost: 0,
          routeDistance: 0,
          routeRisk: 0,
          routeScore: 0,
        });
      },
      recalculateRoute(mesh) {
        const { startCellId, goalCellId, roadEdges } = get();
        if (startCellId === null || goalCellId === null) {
          set({
            routeCellIds: [],
            routeTotalCost: 0,
            routeDistance: 0,
            routeRisk: 0,
            routeScore: 0,
          });
          return;
        }

        const result = findLogisticsRoute({
          cells: mesh.cells,
          startCellId,
          goalCellId,
          roadEdges: new Set(roadEdges),
        });

        if (!result) {
          set({
            routeCellIds: [],
            routeTotalCost: 0,
            routeDistance: 0,
            routeRisk: 0,
            routeScore: 0,
          });
          return;
        }

        set({
          routeCellIds: result.pathCellIds,
          routeTotalCost: result.totalCost,
          routeDistance: result.distance,
          routeRisk: result.riskScore,
          routeScore: result.score,
        });
      },
      buildRoadOnCurrentRoute() {
        const { routeCellIds, roadEdges, budget } = get();
        if (routeCellIds.length < 2) return;

        const candidateEdges = buildRoadEdgeKey(routeCellIds);
        const existing = new Set(roadEdges);
        const newEdges = candidateEdges.filter((key) => !existing.has(key));
        if (newEdges.length === 0) return;

        const roadUnitCost = 2;
        const affordableCount = Math.min(newEdges.length, Math.floor(budget / roadUnitCost));
        if (affordableCount <= 0) return;

        const bought = newEdges.slice(0, affordableCount);
        const nextBudget = budget - bought.length * roadUnitCost;
        set({ roadEdges: [...roadEdges, ...bought], budget: nextBudget });
      },
      resetGame() {
        set({ ...DEFAULT_STATE });
      },
    }),
    {
      name: 'logistics-game-store',
      partialize: (state) => ({
        enabled: state.enabled,
        budget: state.budget,
        roadEdges: state.roadEdges,
      }),
    }
  )
);
