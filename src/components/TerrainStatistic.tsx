import { BIOME_CONFIG, LANDFORM_CONFIG } from 'src/configs/map/landform-biome';
import { TBiome, TLandform, TPieChartData } from 'src/types/global';
import BlurCard from './BlurCard';
import PieChart from './charts/PieChart';

interface TStatistic {
  terrain: string;
  count: number;
  percent: number;
}

interface TProps {
  data: TStatistic[];
  title?: string;
}

export default function TerrainStatistic({ data, title = 'Terrain' }: TProps) {
  const pieData: Array<TPieChartData & { type: string; cellCount: number; icon: string }> =
    data.map((item) => {
      const landformKey = item.terrain as TLandform;
      const biomeKey = item.terrain as TBiome;
      const landform = LANDFORM_CONFIG[landformKey];
      const biome = BIOME_CONFIG[biomeKey];

      if (landform) {
        return {
          type: item.terrain,
          label: landform.label,
          value: item.percent,
          color: landform.color,
          cellCount: item.count,
          icon: landform.icon,
        };
      }

      if (biome) {
        return {
          type: item.terrain,
          label: biome.label,
          value: item.percent,
          color: biome.color,
          cellCount: item.count,
          icon: biome.icon,
        };
      }

      return {
        type: item.terrain,
        label: item.terrain,
        value: item.percent,
        color: '#64748b',
        cellCount: item.count,
        icon: '🌿',
      };
    });

  return (
    <BlurCard title={title}>
      <div className="mt-2 flex justify-center">
        <PieChart
          data={pieData}
          renderTooltip={(tooltip) => (
            <div className="w-25">
              <div className="font-semibold">
                {tooltip.label} {tooltip.datum.icon}
              </div>
              <div>Cells: {tooltip.datum.cellCount}</div>
              <div>Percent: {tooltip.percent}%</div>
            </div>
          )}
        />
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {pieData.map((item) => (
          <div
            key={`terrain-legend-${item.type}`}
            className="inline-flex items-center gap-1 rounded border border-white/10 bg-slate-900/45 px-2 py-1 text-[11px] text-slate-200"
          >
            <span
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </BlurCard>
  );
}
