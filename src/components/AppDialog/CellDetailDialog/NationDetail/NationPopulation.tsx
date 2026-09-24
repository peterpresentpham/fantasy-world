'use client';

import { useMemo, useState } from 'react';
import BlurCard from 'src/components/BlurCard';
import ChartTagList from 'src/components/charts/ChartTagList';
import ChartToolbar from 'src/components/charts/ChartToolbar';
import { TBarChartData, TPieChartData } from 'src/types/global';
import { TNationProvinceData } from 'src/hooks/useNationStatistic';
import { formatPopulation } from 'src/services/utils';
import ProvinceChart from './ProvinceChart';

type TProps = {
  provinces: TNationProvinceData[];
};

export type TProvinceChartOption =
  | 'population'
  | 'economy'
  | 'cells'
  | 'pop-per-cell'
  | 'eco-per-cell';

const COLOR_STEP = 47;

const CHART_OPTIONS: { key: TProvinceChartOption; label: string }[] = [
  { key: 'population', label: 'Population' },
  { key: 'economy', label: 'Economy' },
  { key: 'cells', label: 'Cells' },
  { key: 'pop-per-cell', label: 'Pop / Cell' },
  { key: 'eco-per-cell', label: 'Eco / Cell' },
];

function provinceColor(index: number) {
  return `hsl(${(index * COLOR_STEP) % 360} 72% 55%)`;
}

function formatValue(key: TProvinceChartOption, value: number): string {
  switch (key) {
    case 'population':
      return formatPopulation(value);
    case 'economy':
      return formatPopulation(value);
    case 'cells':
      return value.toLocaleString();
    case 'pop-per-cell':
      return value.toFixed(1);
    case 'eco-per-cell':
      return value.toFixed(2);
  }
}

export default function NationPopulation({ provinces }: TProps) {
  const [activeChart, setActiveChart] = useState<TProvinceChartOption>('population');
  const [showData, setShowData] = useState(false);

  const legend = useMemo(
    () => provinces.map((p, i) => ({ label: `P#${p.id}`, color: provinceColor(i) })),
    [provinces]
  );

  const { populationPie, economyPie, cellPie, popBar, ecoBar } = useMemo(() => {
    const pp: Array<TPieChartData & { cellCount: number }> = [];
    const ep: Array<TPieChartData & { cellCount: number }> = [];
    const cp: Array<TPieChartData & { cellCount: number }> = [];
    const pb: TBarChartData[] = [];
    const eb: TBarChartData[] = [];

    provinces.forEach((p, i) => {
      const c = provinceColor(i);
      pp.push({
        label: `P#${p.id}`,
        value: p.population,
        color: c,
        cellCount: p.cellCount,
      });
      ep.push({ label: `P#${p.id}`, value: p.economy, color: c, cellCount: p.cellCount });
      cp.push({ label: `P#${p.id}`, value: p.cellCount, color: c, cellCount: p.cellCount });
      pb.push({ label: `P#${p.id}`, value: p.population / Math.max(1, p.cellCount), color: c });
      eb.push({ label: `P#${p.id}`, value: p.economy / Math.max(1, p.cellCount), color: c });
    });

    return { populationPie: pp, economyPie: ep, cellPie: cp, popBar: pb, ecoBar: eb };
  }, [provinces]);

  const activeData = useMemo(() => {
    switch (activeChart) {
      case 'population':
        return populationPie;
      case 'economy':
        return economyPie;
      case 'cells':
        return cellPie;
      case 'pop-per-cell':
        return popBar;
      case 'eco-per-cell':
        return ecoBar;
    }
  }, [activeChart, populationPie, economyPie, cellPie, popBar, ecoBar]);

  if (provinces.length === 0) {
    return (
      <BlurCard title="Provinces">
        <p className="py-2 text-center text-slate-500">No provinces.</p>
      </BlurCard>
    );
  }

  return (
    <BlurCard title="Provinces" containerProps={{ className: 'space-y-4' }}>
      <ChartTagList
        items={showData ? activeData : legend}
        formatValue={showData ? (value) => formatValue(activeChart, value) : undefined}
      />
      <ChartToolbar
        options={CHART_OPTIONS}
        activeKey={activeChart}
        onSelect={setActiveChart}
        showData={showData}
        onToggleData={() => setShowData((v) => !v)}
      />
      <ProvinceChart
        activeChart={activeChart}
        populationPie={populationPie}
        economyPie={economyPie}
        cellPie={cellPie}
        popBar={popBar}
        ecoBar={ecoBar}
      />
    </BlurCard>
  );
}
