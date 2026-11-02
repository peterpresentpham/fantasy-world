'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Button } from 'src/components/ui/button';
import useSheetAvoidance from 'src/hooks/useSheetAvoidance';
import { useMapContext } from 'src/contexts/map.context';
import { buildLegend } from 'src/services/utils/legend';
import { detectViewPreset } from 'src/services/utils/viewPreset';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';
import { useUiStore } from 'src/store/uiStore';

/** Explains the colours of the current view. Hidden when the layers were mixed by hand. */
export default function MapLegend() {
  const avoidSheet = useSheetAvoidance();
  const { mesh } = useMapContext();
  const displaySettings = useMapExplorerStore((s) => s.displaySettings);
  const open = useUiStore((s) => s.legendOpen);
  const setOpen = useUiStore((s) => s.setLegendOpen);
  const preset = detectViewPreset(displaySettings);

  // The map is tiny on a phone, so start with the legend folded there.
  useEffect(() => {
    if (window.matchMedia('(max-width: 639px)').matches) setOpen(false);
  }, [setOpen]);
  const legend = useMemo(() => (preset ? buildLegend(preset.id, mesh) : null), [preset, mesh]);

  if (!preset || !legend) return null;

  return (
    <section
      aria-label="Map legend"
      className={`fantasy-glass-strong pointer-events-auto absolute right-3 bottom-3 z-10 flex max-h-[60%] w-44 flex-col rounded-lg p-1 ${avoidSheet}`}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="justify-between"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {preset.label}
        {open ? <ChevronDown /> : <ChevronUp />}
      </Button>
      {open && (
        <div className="min-h-0 overflow-y-auto px-2 pb-2">
          <p className="text-muted-foreground mb-2 text-[11px] leading-snug">
            {preset.description}
          </p>
          {legend.kind === 'swatches' ? (
            <ul className="space-y-1">
              {legend.items.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-xs">
                  <span
                    aria-hidden="true"
                    className="border-border size-3 shrink-0 rounded-sm border"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div>
              <div
                aria-hidden="true"
                className="h-2.5 rounded-full"
                style={{ backgroundImage: `linear-gradient(to right, ${legend.stops.join(', ')})` }}
              />
              <div className="text-muted-foreground mt-1 flex justify-between text-[11px]">
                <span>{legend.from}</span>
                <span>{legend.to}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
