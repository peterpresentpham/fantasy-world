'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMapContext } from 'src/contexts/map.context';
import { describeCell } from 'src/services/rendering/descriptors/describeCell';
import { clamp } from 'src/services/utils/math';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';

const PANEL_OFFSET = 16;
const PANEL_PADDING = 10;
const PANEL_WIDTH = 288;
const COMPACT_HEIGHT = 120;
const FULL_HEIGHT = 300;
const TOOLTIP_DELAY_MS = 300;

type TRow = { label: string; value: string; accent?: boolean };

export default function HoverCellOverview() {
  const hoverIndex = useMapExplorerStore((s) => s.hoverIndex);
  const point = useMapExplorerStore((s) => s.hoverClientPoint);
  const cellDataEnabled = useMapExplorerStore((s) => s.displaySettings.cellData);
  const { mesh, paintVersion } = useMapContext();
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [delayedIndex, setDelayedIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Shift') setExpanded(event.type === 'keydown');
    };
    const collapse = () => setExpanded(false);
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('blur', collapse);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', collapse);
    };
  }, []);

  useEffect(() => {
    if (hoverIndex === null) {
      setDelayedIndex(null);
      return;
    }
    const timer = window.setTimeout(() => setDelayedIndex(hoverIndex), TOOLTIP_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [hoverIndex]);

  const { cell, description } = useMemo(() => {
    const next = delayedIndex !== null ? mesh.cells[delayedIndex] : null;
    if (next) return { cell: next, description: describeCell(next) };
    return { cell: undefined, description: undefined };
    // `paintVersion`: cells are mutated in place while painting, so re-describe on each stroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delayedIndex, mesh, paintVersion]);

  const compactRows = useMemo<TRow[]>(
    () =>
      description
        ? [
            { label: 'Terrain', value: description.terrainType, accent: true },
            { label: 'Biome', value: description.biome, accent: true },
            { label: 'Nation', value: description.nationId },
            { label: 'Population', value: description.population, accent: true },
          ]
        : [],
    [description]
  );

  const extraRows = useMemo<TRow[]>(
    () =>
      description
        ? [
            { label: 'Elevation', value: description.elevation },
            { label: 'Temp', value: description.temperature },
            { label: 'Precip', value: description.precipitation },
            { label: 'Rain Shadow', value: description.rainShadow },
            { label: 'River', value: description.riverState },
            { label: 'Flow', value: description.flow },
            { label: 'Suitability', value: description.suitability },
            { label: 'Province', value: description.provinceId },
            { label: 'Ethnic', value: description.ethnicId },
            { label: 'Zone', value: description.zoneType },
          ]
        : [],
    [description]
  );

  const summary =
    description && cell
      ? `Cell ${cell.id}: ${description.terrainType}, ${description.biome}, ${description.nationId}`
      : 'Hover over the map to inspect a cell.';

  const height = expanded ? FULL_HEIGHT : COMPACT_HEIGHT;
  const style = useMemo(() => {
    if (!point) return null;
    const flipX = point.x + PANEL_OFFSET + PANEL_WIDTH > viewport.width - PANEL_PADDING;
    const flipY = point.y + PANEL_OFFSET + height > viewport.height - PANEL_PADDING;
    const left = flipX ? point.x - PANEL_WIDTH - PANEL_OFFSET : point.x + PANEL_OFFSET;
    const top = flipY ? point.y - height - PANEL_OFFSET : point.y + PANEL_OFFSET;
    return {
      left: clamp(
        left,
        PANEL_PADDING,
        Math.max(PANEL_PADDING, viewport.width - PANEL_WIDTH - PANEL_PADDING)
      ),
      top: clamp(
        top,
        PANEL_PADDING,
        Math.max(PANEL_PADDING, viewport.height - height - PANEL_PADDING)
      ),
    };
  }, [point, viewport, height]);

  return (
    <>
      <p id="map-hover-description" className="sr-only" aria-live="polite">
        {summary}
      </p>
      {cellDataEnabled && cell && style && (
        <div className="pointer-events-none fixed z-1000000" style={style}>
          <div className="fantasy-glass-strong w-72 rounded-xl p-3 pb-2.5 shadow-2xl">
            <p className="fantasy-text-muted mb-2 text-xs font-bold tracking-wider uppercase">
              CELL #{cell.id}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {(expanded ? [...compactRows, ...extraRows] : compactRows).map((row) => (
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
            {!expanded && (
              <p className="fantasy-text-muted mt-2 text-[10px]">Hold Shift for details</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
