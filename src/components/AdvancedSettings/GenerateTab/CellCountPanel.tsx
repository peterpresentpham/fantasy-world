import { useEffect, useState } from 'react';
import BlurCard from 'src/components/BlurCard';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { DEFAULT_CONFIG } from 'src/configs/map/common';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';

export default function CellCountPanel() {
  const { cellCount, setCellCount, resetCounter } = useMapExplorerStore();
  const [draftCount, setDraftCount] = useState(String(cellCount));
  const [error, setError] = useState('');

  useEffect(() => {
    setDraftCount(String(cellCount));
    setError('');
  }, [resetCounter, cellCount]);

  function handleApplyCount() {
    const nextValue = Number(draftCount);
    if (
      !Number.isFinite(nextValue) ||
      !Number.isInteger(nextValue) ||
      nextValue < DEFAULT_CONFIG.minCells ||
      nextValue > DEFAULT_CONFIG.maxCells
    ) {
      setError(
        `Cell count must be an integer between ${DEFAULT_CONFIG.minCells} and ${DEFAULT_CONFIG.maxCells}.`
      );
      return;
    }

    setCellCount(nextValue);
    setError('');
  }

  return (
    <BlurCard title="Mesh Density">
      <div className="space-y-2">
        <label className="fantasy-text-muted text-xs">
          Cell count ({DEFAULT_CONFIG.minCells}-{DEFAULT_CONFIG.maxCells})
        </label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={DEFAULT_CONFIG.minCells}
            max={DEFAULT_CONFIG.maxCells}
            step={1}
            value={draftCount}
            onChange={(event) => setDraftCount(event.target.value)}
          />
          <Button type="button" onClick={handleApplyCount} size="sm">
            Apply
          </Button>
        </div>
        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>
    </BlurCard>
  );
}
