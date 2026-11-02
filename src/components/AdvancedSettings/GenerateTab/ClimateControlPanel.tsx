import BlurCard from 'src/components/BlurCard';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';
import { TClimateControl } from 'src/types/global';
import CommitSlider from '../CommitSlider';

type TSliderDef = {
  key: keyof TClimateControl;
  label: string;
  min: number;
  max: number;
  low: string;
  high: string;
};

const SLIDERS: TSliderDef[] = [
  {
    key: 'temperatureOffset',
    label: 'Warmth',
    min: -0.45,
    max: 0.45,
    low: 'Colder',
    high: 'Warmer',
  },
  {
    key: 'temperatureContrast',
    label: 'Temperature contrast',
    min: 0.35,
    max: 1.9,
    low: 'Mild everywhere',
    high: 'Poles vs equator',
  },
  {
    key: 'precipitationScale',
    label: 'Rain strength',
    min: 0.3,
    max: 2.2,
    low: 'Weaker',
    high: 'Stronger',
  },
  {
    key: 'precipitationOffset',
    label: 'Wetness',
    min: -0.45,
    max: 0.45,
    low: 'Drier',
    high: 'Wetter',
  },
  { key: 'humanImpact', label: 'Human impact', min: 0, max: 1, low: 'Wild', high: 'Settled' },
];

export default function ClimateControlPanel() {
  const climateControl = useMapExplorerStore((s) => s.climateControl);
  const setClimateControl = useMapExplorerStore((s) => s.setClimateControl);
  const resetCounter = useMapExplorerStore((s) => s.resetCounter);

  return (
    <BlurCard title="Climate">
      <div className="space-y-3">
        {SLIDERS.map((slider) => (
          <CommitSlider
            key={slider.key}
            label={slider.label}
            value={climateControl[slider.key]}
            min={slider.min}
            max={slider.max}
            step={0.01}
            lowLabel={slider.low}
            highLabel={slider.high}
            format={(value) => value.toFixed(2)}
            resetKey={resetCounter}
            onCommit={(value) => setClimateControl({ ...climateControl, [slider.key]: value })}
          />
        ))}
      </div>
    </BlurCard>
  );
}
