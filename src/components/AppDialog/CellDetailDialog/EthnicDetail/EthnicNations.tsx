'use client';

import { ListIcon, Table2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import BlurCard from 'src/components/BlurCard';
import PieChart from 'src/components/charts/PieChart';
import { Button } from 'src/components/ui/button';
import { formatPopulation, getNationColor } from 'src/services/utils';
import { TPieChartData } from 'src/types/global';

type TNationPopulation = {
  id: number;
  name: string;
  population: number;
};

type TProps = {
  nations: TNationPopulation[];
};

export default function EthnicNations({ nations }: TProps) {
  const [showData, setShowData] = useState(false);

  const pieData: Array<TPieChartData & { name: string }> = useMemo(
    () =>
      nations.map((n) => ({
        label: n.name,
        value: n.population,
        color: getNationColor(n.id),
        name: n.name,
      })),
    [nations]
  );

  if (nations.length === 0) {
    return (
      <BlurCard title="Population by Nation">
        <p className="py-2 text-center text-slate-500">No nation coverage</p>
      </BlurCard>
    );
  }

  return (
    <BlurCard title="Population by Nation" containerProps={{ className: 'space-y-4' }}>
      {/* Legend / Data rows */}
      <div className="flex flex-wrap gap-1.5">
        {showData
          ? pieData.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1 rounded border border-white/10 bg-slate-900/45 px-2 py-0.5 text-[11px] text-slate-200"
              >
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.label}</span>
                <span className="ml-1 font-medium text-slate-100 tabular-nums">
                  {formatPopulation(item.value)}
                </span>
              </span>
            ))
          : pieData.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1 rounded border border-white/10 bg-slate-900/45 px-2 py-0.5 text-[11px] text-slate-200"
              >
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </span>
            ))}
      </div>

      {/* Data toggle */}
      <div className="flex justify-center">
        <Button
          size="xs"
          variant="ghost"
          onClick={() => setShowData((v) => !v)}
          className={showData ? 'text-sky-300' : ''}
        >
          {showData ? <Table2Icon className="size-3.5" /> : <ListIcon className="size-3.5" />}
        </Button>
      </div>

      {/* Chart */}
      <div className="flex justify-center rounded-lg border border-white/10 bg-slate-900/30 p-4">
        <PieChart
          data={pieData}
          renderTooltip={(t) => (
            <>
              <div className="font-semibold">{t.datum.name}</div>
              <div className="text-slate-200">Population: {formatPopulation(t.value)}</div>
              <div className="text-slate-200">Share: {t.percent}%</div>
            </>
          )}
        />
      </div>
    </BlurCard>
  );
}
