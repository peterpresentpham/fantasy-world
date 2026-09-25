'use client';

import { Settings2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from 'src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from 'src/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from 'src/components/ui/tabs';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';
import DisplayModePanel from './DisplayModePanel';
import EthnicPanel from './EthnicPanel';
import ExportTab from './ExportTab';
import GenerateTab from './GenerateTab';
import NationsPanel from './NationsPanel';
import PalettePanel from './PalettePanel';
import TerrainEditorPanel from './TerrainEditorPanel';

const T_MAP_CONFIG_ACTIVE_PANEL_KEY = 'map-config-active-panel';
const T_ALLOWED_PANELS = new Set([
  'generation',
  'display',
  'palette',
  'nations',
  'ethnic',
  'export',
  'terrain',
]);

export default function MapConfigDialog() {
  const { resetToDefaults } = useMapExplorerStore();
  const [activePanel, setActivePanel] = useState('generation');

  useEffect(() => {
    const stored = window.localStorage.getItem(T_MAP_CONFIG_ACTIVE_PANEL_KEY);
    if (!stored || !T_ALLOWED_PANELS.has(stored)) return;
    setActivePanel(stored);
  }, []);

  useEffect(() => {
    if (!T_ALLOWED_PANELS.has(activePanel)) return;
    window.localStorage.setItem(T_MAP_CONFIG_ACTIVE_PANEL_KEY, activePanel);
  }, [activePanel]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          className="fantasy-glass-strong pointer-events-auto h-10 px-3 shadow-lg"
        >
          <Settings2 className="size-4" />
          <span className="sr-only">Map configuration</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        overlayClassName="bg-transparent backdrop-blur-none!"
        className="fixed inset-0 z-50 flex w-full translate-x-0 translate-y-0 flex-col rounded-none border-none bg-black/25 p-4 sm:max-w-none md:inset-auto md:top-auto md:right-4 md:bottom-4 md:left-auto md:h-auto md:max-h-[calc(100dvh-2rem)] md:w-95 md:translate-x-0 md:translate-y-0 md:rounded-xl md:bg-black/35 md:p-5"
      >
        <DialogHeader>
          <DialogTitle>Map Configuration</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Tabs value={activePanel} onValueChange={setActivePanel} className="mt-1 gap-0">
            <TabsList
              variant="line"
              className="fantasy-glass w-full flex-wrap justify-start gap-1 rounded-lg p-1.5 group-data-horizontal/tabs:h-auto"
            >
              {/* TabsTrigger's base style sets h-[calc(100%-1px)] (100% of
                  TabsList), which assumes a single-row, fixed-height list.
                  With TabsList wrapping to multiple rows at h-auto, that
                  percentage creates a circular size dependency the browser
                  resolves inconsistently — every trigger needs an explicit
                  h-auto here to break the cycle. */}
              <TabsTrigger className="h-auto flex-none py-1.5" value="generation">
                Generation
              </TabsTrigger>
              <TabsTrigger className="h-auto flex-none py-1.5" value="display">
                Display
              </TabsTrigger>
              <TabsTrigger className="h-auto flex-none py-1.5" value="nations">
                Nations
              </TabsTrigger>
              <TabsTrigger className="h-auto flex-none py-1.5" value="ethnic">
                Ethnic
              </TabsTrigger>
              <TabsTrigger className="h-auto flex-none py-1.5" value="terrain">
                Edit Terrain
              </TabsTrigger>
              <TabsTrigger className="h-auto flex-none py-1.5" value="export">
                Export
              </TabsTrigger>
              <TabsTrigger className="h-auto flex-none py-1.5" value="palette">
                Palette
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            type="button"
            onClick={resetToDefaults}
            className="mt-1 w-full shrink-0 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/20"
          >
            Reset to Default Config
          </Button>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
            {activePanel === 'generation' && <GenerateTab />}
            {activePanel === 'display' && <DisplayModePanel />}
            {activePanel === 'nations' && <NationsPanel />}
            {activePanel === 'ethnic' && <EthnicPanel />}
            {activePanel === 'terrain' && <TerrainEditorPanel />}
            {activePanel === 'export' && <ExportTab />}
            {activePanel === 'palette' && <PalettePanel />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
