'use client';

import BarChart from 'src/components/charts/BarChart';
import PieChart from 'src/components/charts/PieChart';
import { formatPopulation } from 'src/services/utils';
import { TBarChartData, TPieChartData } from 'src/types/global';
import { TProvinceChartOption } from './NationPopulation';

type TProps = {
  activeChart: TProvinceChartOption;
  populationPie: Array<TPieChartData & { cellCount: number }>;
  economyPie: Array<TPieChartData & { cellCount: number }>;
  cellPie: Array<TPieChartData & { cellCount: number }>;
  popBar: TBarChartData[];
  ecoBar: TBarChartData[];
};

export default function ProvinceChart({
  activeChart,
  populationPie,
  economyPie,
  cellPie,
  popBar,
  ecoBar,
}: TProps) {
  return (
    <div className="border-border bg-muted/40 flex justify-center rounded-lg border p-4">
      {activeChart === 'population' && (
        <PieChart
          data={populationPie}
          renderTooltip={(t) => (
            <>
              <div className="font-semibold">{t.label}</div>
              <div className="text-foreground">Population: {formatPopulation(t.value)}</div>
              <div className="text-foreground">Share: {t.percent}%</div>
            </>
          )}
        />
      )}
      {activeChart === 'economy' && (
        <PieChart
          data={economyPie}
          renderTooltip={(t) => (
            <>
              <div className="font-semibold">{t.label}</div>
              <div className="text-foreground">Economy: {formatPopulation(t.value)}</div>
              <div className="text-foreground">Share: {t.percent}%</div>
            </>
          )}
        />
      )}
      {activeChart === 'cells' && (
        <PieChart
          data={cellPie}
          renderTooltip={(t) => (
            <>
              <div className="font-semibold">{t.label}</div>
              <div className="text-foreground">Cells: {t.datum.cellCount}</div>
              <div className="text-foreground">Share: {t.percent}%</div>
            </>
          )}
        />
      )}
      {activeChart === 'pop-per-cell' && (
        <BarChart
          data={popBar}
          renderTooltip={(t) => (
            <>
              <div className="font-semibold">{t.label}</div>
              <div className="text-foreground">Avg Pop/Cell: {t.value.toFixed(1)}</div>
            </>
          )}
        />
      )}
      {activeChart === 'eco-per-cell' && (
        <BarChart
          data={ecoBar}
          renderTooltip={(t) => (
            <>
              <div className="font-semibold">{t.label}</div>
              <div className="text-foreground">Avg Economy/Cell: {t.value.toFixed(2)}</div>
            </>
          )}
        />
      )}
    </div>
  );
}
