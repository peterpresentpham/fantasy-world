import BlurCard from 'src/components/BlurCard';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';
import CommitSlider from '../CommitSlider';

export default function CountryModePanel() {
  const nationCount = useMapExplorerStore((s) => s.nationCount);
  const setNationCount = useMapExplorerStore((s) => s.setNationCount);
  const resetCounter = useMapExplorerStore((s) => s.resetCounter);

  return (
    <BlurCard title="Nations">
      <CommitSlider
        label="Number of nations"
        value={nationCount}
        min={2}
        max={40}
        step={1}
        lowLabel="Few, large"
        highLabel="Many, small"
        resetKey={resetCounter}
        onCommit={setNationCount}
      />
    </BlurCard>
  );
}
