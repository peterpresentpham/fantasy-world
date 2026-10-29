'use client';

import { Dices } from 'lucide-react';
import { KeyboardEvent, useEffect, useState } from 'react';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { generateRandomSeed } from 'src/services/utils/seed';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';

export default function SeedQuickControl() {
  const seed = useMapExplorerStore((s) => s.seed);
  const setSeed = useMapExplorerStore((s) => s.setSeed);
  const resetCounter = useMapExplorerStore((s) => s.resetCounter);
  const [draft, setDraft] = useState(seed);

  useEffect(() => {
    setDraft(seed);
  }, [seed, resetCounter]);

  function commit() {
    const next = draft.trim() || 'world000';
    setDraft(next);
    if (next !== seed) setSeed(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      setDraft(seed);
      event.currentTarget.blur();
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        aria-label="Seed"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        className="h-8 w-32 text-xs"
        spellCheck={false}
      />
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label="Randomize seed"
        title="Randomize seed"
        onClick={() => setSeed(generateRandomSeed())}
      >
        <Dices />
      </Button>
    </div>
  );
}
