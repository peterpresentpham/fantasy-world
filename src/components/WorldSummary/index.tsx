'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from 'src/components/ui/button';
import useWorldSummary from 'src/hooks/useWorldSummary';
import { useUiStore } from 'src/store/uiStore';
import useFocusNation from 'src/hooks/useFocusNation';
import SummaryBody from './SummaryBody';

/** Facts about the current world, as a card on the map; picking a nation opens its details. */
export default function WorldSummary() {
  const focusNation = useFocusNation();
  const summary = useWorldSummary();
  const open = useUiStore((s) => s.summaryOpen);
  const setOpen = useUiStore((s) => s.setSummaryOpen);
  const openDetail = useUiStore((s) => s.openDetail);

  return (
    <section
      aria-label="World summary"
      className="fantasy-glass-strong pointer-events-auto absolute bottom-16 left-3 z-10 hidden max-h-[45%] w-56 flex-col rounded-lg p-1 sm:flex"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="justify-between"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="font-heading truncate">{summary.name}</span>
        {open ? <ChevronDown /> : <ChevronUp />}
      </Button>
      {open && (
        <div className="min-h-0 overflow-y-auto px-2 pb-2">
          <SummaryBody
            summary={summary}
            onPickNation={(id) => {
              openDetail(id, null);
              focusNation(id);
            }}
          />
        </div>
      )}
    </section>
  );
}
