'use client';

import BlurCard from 'src/components/BlurCard';
import TerrainStatistic from 'src/components/TerrainStatistic';
import { TEthnicData } from 'src/hooks/useEthnicStatistic';
import { formatPopulation } from 'src/services/utils';
import { TDelaunayMesh } from 'src/types/global';
import EthnicMiniMap from './EthnicMiniMap';
import EthnicNations from './EthnicNations';

type TProps = {
  data: TEthnicData;
  mesh: TDelaunayMesh;
};

export default function EthnicDetail({ data, mesh }: TProps) {
  return (
    <>
      <EthnicMiniMap ethnicId={data.ethnics.id} mesh={mesh} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <BlurCard title="Population">
          <p className="mt-1 text-lg font-bold text-cyan-300">
            {formatPopulation(data.totalPopulation)}
          </p>
          <p className="text-xs text-slate-500">
            {(data.totalPopulation / Math.max(1, data.ethnicCells.length)).toFixed(1)} / cell
          </p>
        </BlurCard>
        <BlurCard title="Land Cells">
          <p className="mt-1 text-lg font-bold text-sky-300">
            {data.ethnicCells.length.toLocaleString()}
          </p>
        </BlurCard>
        <BlurCard title="Nations Spanned">
          <p className="mt-1 text-lg font-bold text-amber-300">{data.nations.length}</p>
        </BlurCard>
        <BlurCard title="Avg Pop / Cell">
          <p className="mt-1 text-lg font-bold text-emerald-300">
            {(data.totalPopulation / Math.max(1, data.ethnicCells.length)).toFixed(0)}
          </p>
        </BlurCard>
      </div>
      <EthnicNations nations={data.nations} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TerrainStatistic title="Landform" data={data.landforms} />
        <TerrainStatistic title="Biome" data={data.biomes} />
      </div>
    </>
  );
}
