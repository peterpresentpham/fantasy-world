'use client';

import { useMemo } from 'react';
import { useMapContext } from 'src/contexts/map.context';
import { buildWorldSummary } from 'src/services/utils/worldSummary';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';

/** Facts about the current world, rebuilt only when the map or seed changes. */
export default function useWorldSummary() {
  const { mesh } = useMapContext();
  const seed = useMapExplorerStore((s) => s.seed);
  return useMemo(() => buildWorldSummary(mesh, seed), [mesh, seed]);
}
