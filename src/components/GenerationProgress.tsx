'use client';

import { Check, Circle, Loader2 } from 'lucide-react';
import { GENERATION_STAGES } from 'src/configs/map/generationStages';
import { cn } from 'src/lib/utils';
import { useGenerationStore } from 'src/store/generationStore';

export default function GenerationProgress() {
  const stage = useGenerationStore((s) => s.stage);
  const currentIndex = Math.max(
    0,
    GENERATION_STAGES.findIndex((item) => item.id === stage)
  );

  return (
    <div
      role="status"
      aria-live="polite"
      className="fantasy-glass-strong absolute inset-0 z-20 flex items-center justify-center"
    >
      <div className="fantasy-panel w-72 max-w-[calc(100%-2rem)] px-5 py-4 text-sm">
        <p className="font-heading mb-3 text-base">Generating map&hellip;</p>
        <ol className="space-y-2">
          {GENERATION_STAGES.map((item, index) => {
            const done = index < currentIndex;
            const active = index === currentIndex;
            return (
              <li
                key={item.id}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2',
                  done && 'text-success',
                  active && 'text-foreground font-medium',
                  !done && !active && 'text-muted-foreground'
                )}
              >
                {done && <Check className="size-4" aria-hidden="true" />}
                {active && (
                  <Loader2 className="fantasy-text-gold size-4 animate-spin" aria-hidden="true" />
                )}
                {!done && !active && <Circle className="size-4 opacity-40" aria-hidden="true" />}
                <span>{item.label}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
