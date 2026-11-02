'use client';

import { useEffect } from 'react';
import { useMapContext } from 'src/contexts/map.context';
import { useLogisticsGameStore } from 'src/store/logisticsGameStore';

/** Keeps the route up to date while route mode is on, wherever its controls are shown. */
export default function useLogisticsRoute() {
  const { mesh } = useMapContext();
  const enabled = useLogisticsGameStore((s) => s.enabled);
  const startCellId = useLogisticsGameStore((s) => s.startCellId);
  const goalCellId = useLogisticsGameStore((s) => s.goalCellId);
  const roadEdges = useLogisticsGameStore((s) => s.roadEdges);
  const recalculateRoute = useLogisticsGameStore((s) => s.recalculateRoute);

  useEffect(() => {
    if (!enabled) return;
    recalculateRoute(mesh);
  }, [enabled, mesh, recalculateRoute, startCellId, goalCellId, roadEdges]);
}
