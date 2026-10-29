'use client';

import { useEffect } from 'react';
import { VIEW_PRESETS } from 'src/configs/map/viewPresets';
import { isTypingTarget, resolveHotkey } from 'src/services/utils/hotkeys';
import { generateRandomSeed } from 'src/services/utils/seed';
import { applyViewPreset } from 'src/services/utils/viewPreset';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';
import { useUiStore } from 'src/store/uiStore';
import { useViewportStore } from 'src/store/viewportStore';

/** Global map shortcuts. Ignored while typing or while any modal dialog is open. */
export default function useMapHotkeys() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || isTypingTarget(event.target as HTMLElement | null)) return;
      if (document.querySelector('[role="dialog"]')) return;
      const action = resolveHotkey(event);
      if (!action) return;

      const explorer = useMapExplorerStore.getState();
      const viewport = useViewportStore.getState();
      switch (action.type) {
        case 'randomSeed':
          explorer.setSeed(generateRandomSeed());
          break;
        case 'viewPreset': {
          const preset = VIEW_PRESETS[action.index];
          if (!preset) return;
          explorer.setDisplaySettings(applyViewPreset(explorer.displaySettings, preset));
          break;
        }
        case 'zoomIn':
          viewport.zoomStep(1);
          break;
        case 'zoomOut':
          viewport.zoomStep(-1);
          break;
        case 'zoomReset':
          viewport.reset();
          break;
        case 'closePanel': {
          const ui = useUiStore.getState();
          if (ui.detailOpen) ui.closeDetail();
          else if (ui.configOpen) ui.setConfigOpen(false);
          else return;
          break;
        }
      }
      event.preventDefault();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
