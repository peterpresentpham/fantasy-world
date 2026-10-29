import { useEffect, useState } from 'react';
import BlurCard from 'src/components/BlurCard';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';

export default function SeaLevelPanel() {
  const { seaLevel, setSeaLevel, resetCounter } = useMapExplorerStore();
  const [seaLevelDraft, setSeaLevelDraft] = useState(seaLevel);

  useEffect(() => {
    setSeaLevelDraft(seaLevel);
  }, [resetCounter, seaLevel]);

  function applySeaLevel() {
    setSeaLevel(seaLevelDraft);
  }

  return (
    <BlurCard title="Sea Level">
      <Input
        type="number"
        min={0.1}
        max={0.9}
        step={0.01}
        value={seaLevelDraft}
        onChange={(event) => setSeaLevelDraft(Number(event.target.value))}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="fantasy-text-muted text-xs">Applied: {seaLevel.toFixed(2)}</p>
        <Button type="button" onClick={applySeaLevel}>
          Confirm
        </Button>
      </div>
    </BlurCard>
  );
}
