'use client';

import { XIcon } from 'lucide-react';
import { Button } from 'src/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from 'src/components/ui/tabs';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';
import { TConfigPanel, useUiStore } from 'src/store/uiStore';
import DisplayModePanel from './DisplayModePanel';
import EthnicPanel from './EthnicPanel';
import ExportTab from './ExportTab';
import GenerateTab from './GenerateTab';
import NationsPanel from './NationsPanel';
import PalettePanel from './PalettePanel';
import TerrainEditorPanel from './TerrainEditorPanel';

const TABS: readonly { value: TConfigPanel; label: string }[] = [
  { value: 'generation', label: 'Generation' },
  { value: 'display', label: 'Display' },
  { value: 'nations', label: 'Nations' },
  { value: 'ethnic', label: 'Ethnic' },
  { value: 'terrain', label: 'Edit Terrain' },
  { value: 'export', label: 'Export' },
  { value: 'palette', label: 'Palette' },
];

const PANELS: Record<TConfigPanel, () => React.JSX.Element> = {
  generation: GenerateTab,
  display: DisplayModePanel,
  nations: NationsPanel,
  ethnic: EthnicPanel,
  terrain: TerrainEditorPanel,
  export: ExportTab,
  palette: PalettePanel,
};

/** Advanced controls, shown as an expandable section attached to the map toolbar. */
export default function AdvancedSettings() {
  const resetToDefaults = useMapExplorerStore((s) => s.resetToDefaults);
  const activePanel = useUiStore((s) => s.configPanel);
  const setActivePanel = useUiStore((s) => s.setConfigPanel);
  const setConfigOpen = useUiStore((s) => s.setConfigOpen);
  const ActivePanel = PANELS[activePanel];

  return (
    <section
      id="advanced-settings"
      aria-label="Advanced settings"
      className="border-border flex max-h-[calc(100dvh-10rem)] w-[min(26rem,calc(100vw-2rem))] flex-col self-center border-t pt-2"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-heading text-base">Advanced</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close advanced settings"
          onClick={() => setConfigOpen(false)}
        >
          <XIcon />
        </Button>
      </div>
      <Tabs
        value={activePanel}
        onValueChange={(value) => setActivePanel(value as TConfigPanel)}
        className="gap-0"
      >
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
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} className="h-auto flex-none py-1.5" value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Button
        type="button"
        variant="destructive"
        onClick={resetToDefaults}
        className="mt-1 w-full shrink-0 rounded-xl px-4 py-2"
      >
        Reset to Default Config
      </Button>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        <ActivePanel />
      </div>
    </section>
  );
}
