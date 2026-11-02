'use client';

import { Wrench } from 'lucide-react';
import { Button } from 'src/components/ui/button';
import { useUiStore } from 'src/store/uiStore';
import LayerQuickToggles from './LayerQuickToggles';
import SeedQuickControl from './SeedQuickControl';
import ToolsSheet from './ToolsSheet';

/** Phone layout: seed and views on a slim bar, everything else in a bottom sheet. */
export default function MobileToolbar() {
  const toolsOpen = useUiStore((s) => s.toolsOpen);
  const setToolsOpen = useUiStore((s) => s.setToolsOpen);

  return (
    <>
      <div
        role="toolbar"
        aria-label="Map tools"
        className="fantasy-glass-strong absolute inset-x-2 top-2 z-30 flex flex-col gap-2 rounded-xl p-2 shadow-lg"
      >
        <div className="flex items-center gap-2">
          <SeedQuickControl />
          <Button
            type="button"
            variant={toolsOpen ? 'default' : 'secondary'}
            size="sm"
            className="ml-auto"
            aria-expanded={toolsOpen}
            onClick={() => setToolsOpen(!toolsOpen)}
          >
            <Wrench /> Tools
          </Button>
        </div>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <LayerQuickToggles />
        </div>
      </div>
      {toolsOpen && <ToolsSheet />}
    </>
  );
}
