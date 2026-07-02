'use client';

import { Group } from '@visx/group';
import { Pie } from '@visx/shape';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TBaseChartData, TPieChartData } from 'src/global';

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const radius = width / 2;

  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    data: TPieTooltipData<T>;
  } | null>(null);

  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);

  return (
    <div ref={containerRef} className="relative w-fit">
      <svg width={width} height={height}>
        <Group top={height / 2} left={width / 2}>
          <Pie
            data={data}
            pieValue={(d) => d.value}
            outerRadius={radius}
            innerRadius={radius - 80}
            padAngle={0.02}
          >
            {(pie) =>
              pie.arcs.map((arc) => {
                const percent = ((arc.data.value / total) * 100).toFixed(1);

                return (
                  <g key={arc.data.label}>
                    <path
                      d={pie.path(arc) || ''}
                      fill={arc.data.color}
                      className="cursor-pointer transition-opacity hover:opacity-80"
                      onMouseMove={(e) => {
                        const rect = containerRef.current?.getBoundingClientRect();

                        if (!rect) return;

                        setTooltip({
                          x: e.clientX,
                          y: e.clientY,
                          data: {
                            datum: arc.data,
                            label: arc.data.label,
                            value: arc.data.value,
                            percent,
                          },
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  </g>
                );
              })
            }
          </Pie>
        </Group>
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
