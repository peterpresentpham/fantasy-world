'use client';

import { CircleHelp, Pencil, SlidersHorizontal, XIcon } from 'lucide-react';
import AdvancedSettings from 'src/components/AdvancedSettings';
import SummaryBody from 'src/components/WorldSummary/SummaryBody';
import { Button } from 'src/components/ui/button';
import useFocusNation from 'src/hooks/useFocusNation';
import useWorldSummary from 'src/hooks/useWorldSummary';
import { useUiStore } from 'src/store/uiStore';
import RouteButton from './RouteButton';
import SampleWorldsSelect from './SampleWorldsSelect';
import ShareButtons from './ShareButtons';
import ThemeToggle from './ThemeToggle';
import TopographyQuickSelect from './TopographyQuickSelect';
import ViewModeSwitch from './ViewModeSwitch';

/** Everything that does not fit the slim phone toolbar, as a sheet sliding up from the bottom. */
export default function ToolsSheet() {
  const focusNation = useFocusNation();
  const configOpen = useUiStore((s) => s.configOpen);
  const setConfigOpen = useUiStore((s) => s.setConfigOpen);
  const openConfig = useUiStore((s) => s.openConfig);
  const setToolsOpen = useUiStore((s) => s.setToolsOpen);
  const showIntro = useUiStore((s) => s.showIntro);
  const openDetail = useUiStore((s) => s.openDetail);
  const summary = useWorldSummary();

  return (
    <>
      <button
        type="button"
        aria-label="Close tools"
        className="fixed inset-0 z-30 bg-black/40"
        onClick={() => setToolsOpen(false)}
      />
      <div className="fantasy-glass-strong animate-in slide-in-from-bottom fixed inset-x-0 bottom-0 z-40 flex max-h-[75dvh] flex-col gap-3 overflow-y-auto rounded-t-2xl border-t p-4 duration-200">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg">Map tools</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Hide tools"
            onClick={() => setToolsOpen(false)}
          >
            <XIcon />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TopographyQuickSelect />
          <SampleWorldsSelect />
        </div>
        <ViewModeSwitch />
        <div className="flex flex-wrap items-center gap-2">
          <RouteButton />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Edit terrain"
            title="Edit terrain"
            onClick={() => openConfig('terrain')}
          >
            <Pencil />
          </Button>
          <ShareButtons />
          <ThemeToggle />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="About this map"
            title="About this map"
            onClick={showIntro}
          >
            <CircleHelp />
          </Button>
        </div>
        <section aria-label="World summary" className="border-border rounded-lg border p-3">
          <h3 className="font-heading mb-2 text-base">{summary.name}</h3>
          <SummaryBody
            summary={summary}
            onPickNation={(id) => {
              setToolsOpen(false);
              openDetail(id, null);
              focusNation(id);
            }}
          />
        </section>
        <Button
          type="button"
          variant={configOpen ? 'default' : 'secondary'}
          size="sm"
          className="self-start"
          aria-label="Advanced settings"
          aria-expanded={configOpen}
          aria-controls="advanced-settings"
          onClick={() => setConfigOpen(!configOpen)}
        >
          <SlidersHorizontal /> Advanced
        </Button>
        {configOpen && <AdvancedSettings />}
      </div>
    </>
  );
}
