import { useEffect, useState } from 'react';
import BlurCard from 'src/components/BlurCard';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';

export default function CountryModePanel() {
  const { nationCount, setNationCount, resetCounter } = useMapExplorerStore();
  const [draftCount, setDraftCount] = useState(String(nationCount));
  const [error, setError] = useState('');

  useEffect(() => {
    setDraftCount(String(nationCount));
    setError('');
  }, [resetCounter, nationCount]);

  function handleApplyCount() {
    const nextValue = Number(draftCount);
    if (
      !Number.isFinite(nextValue) ||
      !Number.isInteger(nextValue) ||
      nextValue < 2 ||
      nextValue > 40
    ) {
      setError('Nation count must be an integer between 2 and 40.');
      return;
    }
    const success = setNationCount(nextValue);
    if (!success) {
      setError('Nation count must be an integer between 2 and 40.');
      return;
    }
    setError('');
  }

  return (
    <BlurCard title="Nation Mode">
      <div className="space-y-2">
        <label className="fantasy-text-muted text-xs">Nation count (2-40)</label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={2}
            max={40}
            step={1}
            value={draftCount}
            onChange={(event) => setDraftCount(event.target.value)}
          />
          <Button type="button" onClick={handleApplyCount} size="sm">
            Apply
          </Button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </BlurCard>
  );
}
