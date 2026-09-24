'use client';

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TBarChartData, TBaseChartData } from 'src/types/global';

type TBarTooltipData<T extends TBarChartData> = {
  datum: T;
  label: string;
  value: number;
};

type TProps<T extends TBarChartData> = TBaseChartData & {
  data: T[];
  maxValue?: number;
  renderTooltip?: (tooltip: TBarTooltipData<T>) => ReactNode;
};

export default function BarChart<T extends TBarChartData>({
  data,
  width: explicitWidth,
  height = 260,
  maxValue,
  renderTooltip,
}: TProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    data: TBarTooltipData<T>;
  } | null>(null);

  useEffect(() => {
    if (explicitWidth) return;

    function updateWidth() {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    }

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [explicitWidth]);

  const width = explicitWidth ?? Math.max(280, containerWidth);

  const margin = { top: 12, right: 8, bottom: 42, left: 8 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const gap = 8;
  const safeCount = Math.max(1, data.length);
  const barWidth = Math.max(8, (innerWidth - gap * (safeCount - 1)) / safeCount);

  const computedMaxValue = useMemo(
    () => maxValue ?? Math.max(1, ...data.map((item) => item.value)),
    [data, maxValue]
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <svg width={width} height={height}>
        <line
          x1={margin.left}
          y1={margin.top + innerHeight}
          x2={margin.left + innerWidth}
          y2={margin.top + innerHeight}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={1}
        />
        {data.map((item, index) => {
          const x = margin.left + index * (barWidth + gap);
          const valueRatio = item.value / computedMaxValue;
          const barHeight = valueRatio * innerHeight;
          const y = margin.top + innerHeight - barHeight;

          return (
            <g key={item.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={4}
                fill={item.color}
                className="cursor-pointer transition-opacity hover:opacity-80"
                onMouseMove={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();

                  if (!rect) return;

                  setTooltip({
                    x: e.clientX,
                    y: e.clientY,
                    data: {
                      datum: item,
                      label: item.label,
                      value: item.value,
                    },
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              />
              <text
                x={x + barWidth / 2}
                y={margin.top + innerHeight + 16}
                textAnchor="middle"
                fontSize={11}
                fill="rgba(255,255,255,0.9)"
              >
                {item.label}
              </text>
            </g>
          );
        })}
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
                <div>{tooltip.data.value.toFixed(2)}</div>
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
