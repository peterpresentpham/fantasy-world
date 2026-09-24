'use client';

import { useMemo, useState } from 'react';
import BlurCard from 'src/components/BlurCard';
import ChartTagList from 'src/components/charts/ChartTagList';
import ChartToolbar from 'src/components/charts/ChartToolbar';
import { TNationEthnicData } from 'src/hooks/useNationStatistic';
import { formatPopulation, getNationColor } from 'src/services/utils';
import { TBarChartData, TPieChartData } from 'src/types/global';
import EthnicGroupChart from './EthnicGroupChart';

type TProps = {
  ethnics: TNationEthnicData[];
};

export type TEthnicChartOption =
  | 'cells'
  | 'population'
  | 'economy'
  | 'pop-per-cell'
  | 'eco-per-person';

const CHART_OPTIONS: { key: TEthnicChartOption; label: string }[] = [
  { key: 'cells', label: 'Cells' },
  { key: 'population', label: 'Population' },
  { key: 'economy', label: 'Economy' },
  { key: 'pop-per-cell', label: 'Pop / Cell' },
  { key: 'eco-per-person', label: 'Eco / Person' },
];

function formatValue(key: TEthnicChartOption, value: number): string {
  switch (key) {
    case 'population':
      return formatPopulation(value);
    case 'economy':
      return formatPopulation(value);
    case 'cells':
      return value.toLocaleString();
    case 'pop-per-cell':
      return value.toFixed(1);
    case 'eco-per-person':
      return value.toFixed(4);
  }
}

export default function EthnicGroups({ ethnics }: TProps) {
  const [activeChart, setActiveChart] = useState<TEthnicChartOption>('cells');
  const [showData, setShowData] = useState(false);

  const legend = useMemo(
    () =>
      ethnics.map((item) => ({
        label: item.name,
        color: getNationColor(item.id),
      })),
    [ethnics]
  );

  const { cellPie, populationPie, economyPie, popPerCell, ecoPerPerson } = useMemo(() => {
    const cPie: Array<TPieChartData & { cells: number; ethnicName: string }> = [];
    const pPie: Array<TPieChartData & { ethnicName: string }> = [];
    const ePie: Array<TPieChartData & { ethnicName: string }> = [];
    const ppc: TBarChartData[] = [];
    const epp: TBarChartData[] = [];

    ethnics.forEach((item) => {
      const color = getNationColor(item.id);
      cPie.push({
        label: item.name,
        value: item.count,
        color,
        cells: item.count,
        ethnicName: item.name,
      });
      pPie.push({ label: item.name, value: item.population, color, ethnicName: item.name });
      ePie.push({ label: item.name, value: item.economy, color, ethnicName: item.name });
      ppc.push({ label: item.name, value: item.population / Math.max(1, item.count), color });
      epp.push({ label: item.name, value: item.economy / Math.max(1, item.population), color });
    });

    return {
      cellPie: cPie,
      populationPie: pPie,
      economyPie: ePie,
      popPerCell: ppc,
      ecoPerPerson: epp,
    };
  }, [ethnics]);

  const activeData = useMemo(() => {
    switch (activeChart) {
      case 'cells':
        return cellPie;
      case 'population':
        return populationPie;
      case 'economy':
        return economyPie;
      case 'pop-per-cell':
        return popPerCell;
      case 'eco-per-person':
        return ecoPerPerson;
    }
  }, [activeChart, cellPie, populationPie, economyPie, popPerCell, ecoPerPerson]);

  if (ethnics.length === 0) {
    return (
      <BlurCard title="Ethnic Groups">
        <p className="py-2 text-center text-slate-500">No ethnic data in this nation.</p>
      </BlurCard>
    );
  }

  return (
    <BlurCard title="Ethnic Groups" containerProps={{ className: 'space-y-4' }}>
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
      <EthnicGroupChart
        activeChart={activeChart}
        cellPie={cellPie}
        populationPie={populationPie}
        economyPie={economyPie}
        popPerCell={popPerCell}
        ecoPerPerson={ecoPerPerson}
      />
    </BlurCard>
  );
}
