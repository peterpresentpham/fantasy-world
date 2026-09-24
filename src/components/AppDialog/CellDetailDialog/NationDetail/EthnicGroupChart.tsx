'use client';

import BarChart from 'src/components/charts/BarChart';
import PieChart from 'src/components/charts/PieChart';
import { formatPopulation } from 'src/services/utils';
import { TBarChartData, TPieChartData } from 'src/types/global';
import { TEthnicChartOption } from './EthnicGroups';

type TProps = {
  activeChart: TEthnicChartOption;
  cellPie: Array<TPieChartData & { cells: number; ethnicName: string }>;
  populationPie: Array<TPieChartData & { ethnicName: string }>;
  economyPie: Array<TPieChartData & { ethnicName: string }>;
  popPerCell: TBarChartData[];
  ecoPerPerson: TBarChartData[];
};

export default function EthnicGroupChart({
  activeChart,
  cellPie,
  populationPie,
  economyPie,
  popPerCell,
  ecoPerPerson,
}: TProps) {
  return (
    <div className="flex justify-center rounded-lg border border-white/10 bg-slate-900/30 p-4">
      {activeChart === 'cells' && (
        <PieChart
          data={cellPie}
          renderTooltip={(t) => (
            <>
              <div className="font-semibold">{t.datum.ethnicName}</div>
              <div className="text-slate-200">Cells: {t.datum.cells}</div>
              <div className="text-slate-200">Share: {t.percent}%</div>
            </>
          )}
        />
      )}
      {activeChart === 'population' && (
        <PieChart
          data={populationPie}
          renderTooltip={(t) => (
            <>
              <div className="font-semibold">{t.datum.ethnicName}</div>
              <div className="text-slate-200">Population: {formatPopulation(t.value)}</div>
              <div className="text-slate-200">Share: {t.percent}%</div>
            </>
          )}
        />
      )}
      {activeChart === 'economy' && (
        <PieChart
          data={economyPie}
          renderTooltip={(t) => (
            <>
              <div className="font-semibold">{t.datum.ethnicName}</div>
              <div className="text-slate-200">Economy: {formatPopulation(t.value)}</div>
              <div className="text-slate-200">Share: {t.percent}%</div>
            </>
          )}
        />
      )}
      {activeChart === 'pop-per-cell' && (
        <BarChart
          data={popPerCell}
          renderTooltip={(t) => (
            <>
              <div className="font-semibold">{t.label}</div>
              <div className="text-slate-200">Population/Cell: {t.value.toFixed(1)}</div>
            </>
          )}
        />
      )}
      {activeChart === 'eco-per-person' && (
        <BarChart
          data={ecoPerPerson}
          renderTooltip={(t) => (
            <>
              <div className="font-semibold">{t.label}</div>
              <div className="text-slate-200">Economy/Person: {t.value.toFixed(4)}</div>
            </>
          )}
        />
      )}
    </div>
  );
}
