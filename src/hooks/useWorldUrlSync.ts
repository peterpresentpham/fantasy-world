'use client';

import { useEffect } from 'react';
import { buildWorldSearch } from 'src/services/utils/worldUrl';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';
import { useShallow } from 'zustand/react/shallow';

/** Keeps the address bar pointing at the current world so the link can be shared as it is. */
export default function useWorldUrlSync() {
  const world = useMapExplorerStore(
    useShallow((s) => ({
      seed: s.seed,
      topography: s.topography,
      seaLevel: s.seaLevel,
      nationCount: s.nationCount,
      cellCount: s.cellCount,
    }))
  );

  useEffect(() => {
    const search = buildWorldSearch(world);
    if (search === window.location.search) return;
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${search}${window.location.hash}`
    );
  }, [world]);
}
