import CellCountPanel from './CellCountPanel';
import ClimateControlPanel from './ClimateControlPanel';
import CountryModePanel from './CountryModePanel';
import LogisticsGamePanel from './LogisticsGamePanel';
import SeaLevelPanel from './SeaLevelPanel';
import SeedPanel from './SeedPanel';
import TopographySelect from './TopographySelect';

export default function GenerateTab() {
  return (
    <div className="space-y-4">
      <TopographySelect />
      <CellCountPanel />
      <SeedPanel />
      <SeaLevelPanel />
      <CountryModePanel />
      <ClimateControlPanel />
      <LogisticsGamePanel />
    </div>
  );
}
