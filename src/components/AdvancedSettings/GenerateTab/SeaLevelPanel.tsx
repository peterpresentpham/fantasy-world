import BlurCard from 'src/components/BlurCard';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';
import CommitSlider from '../CommitSlider';

export default function SeaLevelPanel() {
  const seaLevel = useMapExplorerStore((s) => s.seaLevel);
  const setSeaLevel = useMapExplorerStore((s) => s.setSeaLevel);
  const resetCounter = useMapExplorerStore((s) => s.resetCounter);

  return (
    <BlurCard title="Sea Level">
      <CommitSlider
        label="Sea level"
        value={seaLevel}
        min={0.1}
        max={0.9}
        step={0.01}
        lowLabel="More land"
        highLabel="More ocean"
        format={(value) => value.toFixed(2)}
        resetKey={resetCounter}
        onCommit={setSeaLevel}
      />
    </BlurCard>
  );
}
