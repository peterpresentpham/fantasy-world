'use client';

import { useCallback } from 'react';
import { MAX_ZOOM } from 'src/configs/map/viewport';
import { useMapContext } from 'src/contexts/map.context';
import { getNationFocus } from 'src/services/utils/focus';
import { useViewportStore } from 'src/store/viewportStore';

/** Returns a function that zooms the map to a nation. */
export default function useFocusNation() {
  const { mesh } = useMapContext();
  return useCallback(
    (nationId: number) => {
      const focus = getNationFocus(mesh.cells, nationId, mesh.width, mesh.height, MAX_ZOOM);
      if (!focus) return;
      // Opening the side panel resizes the frame; look once the new size has been measured.
      window.setTimeout(
        () => useViewportStore.getState().focusOn(focus.fraction, focus.scale),
        150
      );
    },
    [mesh]
  );
}
