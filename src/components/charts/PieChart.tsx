'use client';

import { arc as d3Arc, pie as d3Pie } from 'd3-shape';
import { type ReactNode, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { TBaseChartData, TPieChartData } from 'src/types/global';

const INNER_RADIUS_RATIO = 0.55;

type TPieTooltipData<T extends TPieChartData> = {
  datum: T;
  label: string;
  value: number;
  percent: string;
};

type TProps<T extends TPieChartData> = TBaseChartData & {
  data: T[];
  renderTooltip?: (tooltip: TPieTooltipData<T>) => ReactNode;
};

export default function PieChart<T extends TPieChartData>(params: TProps<T>) {
  const { data, width = 300, height = 300, renderTooltip } = params;
  const radius = width / 2;

  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    data: TPieTooltipData<T>;
  } | null>(null);

  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);
  const arcs = useMemo(
    () =>
      d3Pie<T>()
        .value((d) => d.value)
        .padAngle(0.02)(data),
    [data]
  );
  const arcPath = useMemo(
    () =>
      d3Arc<(typeof arcs)[number]>()
        .outerRadius(radius)
        .innerRadius(radius * INNER_RADIUS_RATIO),
    [radius]
  );

  return (
    <div className="relative w-full" style={{ maxWidth: width }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full">
        <g transform={`translate(${width / 2},${height / 2})`}>
          {arcs.map((arc) => {
            const percent = ((arc.data.value / total) * 100).toFixed(1);

            return (
              <path
                key={arc.data.label}
                d={arcPath(arc) || ''}
                fill={arc.data.color}
                className="cursor-pointer transition-opacity hover:opacity-80"
                onMouseMove={(e) =>
                  setTooltip({
                    x: e.clientX,
                    y: e.clientY,
                    data: {
                      datum: arc.data,
                      label: arc.data.label,
                      value: arc.data.value,
                      percent,
                    },
                  })
                }
                onMouseLeave={() => setTooltip(null)}
              />
            );
          })}
        </g>
      </svg>
      {tooltip &&
        createPortal(
          <div
            className="pointer-events-none fixed z-100 rounded-xl bg-black px-3 py-2 text-sm text-white shadow-lg"
            style={{ top: tooltip.y + 12, left: tooltip.x + 12 }}
          >
            {renderTooltip ? (
              renderTooltip(tooltip.data)
            ) : (
              <>
                <div className="font-semibold">{tooltip.data.label}</div>
                <div>Value: {tooltip.data.value}</div>
                <div>{tooltip.data.percent}%</div>
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
