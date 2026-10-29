import { useEffect, useState } from 'react';
import BlurCard from 'src/components/BlurCard';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { generateRandomSeed } from 'src/services/utils/seed';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';

export default function SeedPanel() {
  const { seed, setSeed, resetCounter } = useMapExplorerStore();
  const [seedDraft, setSeedDraft] = useState(seed);

  useEffect(() => {
    setSeedDraft(seed);
  }, [resetCounter, seed]);

  function applySeed() {
    const normalizedSeed = seedDraft.trim() || 'world000';
    setSeed(normalizedSeed);
  }

  function applyRandomSeed() {
    const nextSeed = generateRandomSeed();
    setSeedDraft(nextSeed);
    setSeed(nextSeed);
  }

  return (
    <BlurCard title="Seed">
      <Input
        value={seedDraft}
        onChange={(event) => setSeedDraft(event.target.value)}
        placeholder="world000"
      />
      <div className="mt-2 flex gap-2">
        <Button type="button" variant="secondary" size="lg" onClick={applySeed}>
          Apply seed
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={applyRandomSeed}>
          Randomize
        </Button>
      </div>
    </BlurCard>
  );
}
