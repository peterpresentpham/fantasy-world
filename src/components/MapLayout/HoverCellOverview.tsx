'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMapContext } from 'src/contexts/map.context';
import { clamp } from 'src/services/utils/math';
import { describeCell } from 'src/services/rendering/descriptors/describeCell';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';

const PANEL_OFFSET = 14;
const PANEL_PADDING = 10;
const PANEL_ESTIMATED_WIDTH = 280;
const PANEL_ESTIMATED_HEIGHT = 300;
const TOOLTIP_DELAY_MS = 300;

type TGroupedRow = { label: string; value: string; accent?: boolean };

export default function HoverCellOverview() {
  const hoverIndex = useMapExplorerStore((s) => s.hoverIndex);
  const cellDataEnabled = useMapExplorerStore((s) => s.displaySettings.cellData);
  const { mesh, paintVersion } = useMapContext();
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [delayedHoverIndex, setDelayedHoverIndex] = useState<number | null>(null);
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    function handleResize() {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
      const canvas = document.getElementById('map-base-canvas');
      if (!(canvas instanceof HTMLCanvasElement)) return;
      setCanvasRect(canvas.getBoundingClientRect());
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (hoverIndex === null) {
      setDelayedHoverIndex(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setDelayedHoverIndex(hoverIndex);
    }, TOOLTIP_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [hoverIndex]);

  useEffect(() => {
    const canvas = document.getElementById('map-base-canvas');
    if (!(canvas instanceof HTMLCanvasElement)) return;
    setCanvasRect(canvas.getBoundingClientRect());
  }, [mesh.width, mesh.height]);

  const { cell, description } = useMemo(() => {
    const nextCell = delayedHoverIndex !== null ? mesh.cells[delayedHoverIndex] : null;
    if (nextCell) return { cell: nextCell, description: describeCell(nextCell) };
    return { cell: undefined, description: undefined };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delayedHoverIndex, mesh, paintVersion]);

  const rows = useMemo<TGroupedRow[]>(() => {
    if (!description) return [];
    return [
      { label: 'Terrain', value: description.terrainType, accent: true },
      { label: 'Elevation', value: description.elevation },
      { label: 'Biome', value: description.biome, accent: true },
      { label: 'Temp', value: description.temperature },
      { label: 'Precip', value: description.precipitation },
      { label: 'Rain Shadow', value: description.rainShadow },
      { label: 'River', value: description.riverState },
      { label: 'Flow', value: description.flow },
      { label: 'Suitability', value: description.suitability },
      { label: 'Population', value: description.population, accent: true },
      { label: 'Nation', value: description.nationId },
      { label: 'Province', value: description.provinceId },
      { label: 'Ethnic', value: description.ethnicId },
      { label: 'Zone', value: description.zoneType },
    ];
  }, [description]);

  const positionStyle = useMemo(() => {
    if (!cell || !canvasRect) return { left: PANEL_PADDING, top: PANEL_PADDING };

    const scaleX = canvasRect.width / Math.max(1, mesh.width);
    const scaleY = canvasRect.height / Math.max(1, mesh.height);
    const anchorX = canvasRect.left + cell.site[0] * scaleX;
    const anchorY = canvasRect.top + cell.site[1] * scaleY;

    const flipX =
      anchorX + PANEL_OFFSET + PANEL_ESTIMATED_WIDTH > viewportSize.width - PANEL_PADDING;
    const flipY =
      anchorY + PANEL_OFFSET + PANEL_ESTIMATED_HEIGHT > viewportSize.height - PANEL_PADDING;

    const rawLeft = flipX ? anchorX - PANEL_ESTIMATED_WIDTH - PANEL_OFFSET : anchorX + PANEL_OFFSET;
    const rawTop = flipY ? anchorY - PANEL_ESTIMATED_HEIGHT - PANEL_OFFSET : anchorY + PANEL_OFFSET;

    return {
      left: clamp(
        rawLeft,
        PANEL_PADDING,
        viewportSize.width - PANEL_ESTIMATED_WIDTH - PANEL_PADDING
      ),
      top: clamp(
        rawTop,
        PANEL_PADDING,
        viewportSize.height - PANEL_ESTIMATED_HEIGHT - PANEL_PADDING
      ),
    };
  }, [canvasRect, cell, mesh.width, mesh.height, viewportSize]);

  if (!cellDataEnabled || !description || !cell) return null;

  return (
    <div className="pointer-events-none fixed z-1000000" style={positionStyle}>
      <div className="fantasy-glass-strong w-72 rounded-xl p-3 pb-2.5 shadow-2xl">
        <p className="fantasy-text-muted mb-2 text-xs font-bold tracking-wider uppercase">
          CELL #{cell.id}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {rows.map((row) => (
            <span
              key={row.label}
              className="inline-flex items-baseline gap-1 text-xs leading-tight"
            >
              <span className="fantasy-text-muted">{row.label}</span>
              <span className={row.accent ? 'fantasy-text-gold font-semibold' : 'font-medium'}>
                {row.value}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
