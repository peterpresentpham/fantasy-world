'use client';

import { useMemo } from 'react';
import { useMapContext } from 'src/contexts/map.context';
import { formatPopulation, getNationColor } from 'src/services/utils';

type TEthnicPopulationRow = {
  id: number;
  name: string;
  totalPopulation: number;
};

export default function EthnicPanel() {
  const { mesh } = useMapContext();

  const rows = useMemo<TEthnicPopulationRow[]>(() => {
    return mesh.ethnics
      .map((group) => {
        const cells = mesh.cells.filter((cell) => cell.ethnicId === group.id && !cell.isWater);
        let ethnicPopulation = 0;

        for (const cell of cells) {
          ethnicPopulation += cell.population;
        }

        return { id: group.id, name: group.name, totalPopulation: ethnicPopulation };
      })
      .sort((a, b) => b.totalPopulation - a.totalPopulation);
  }, [mesh.cells, mesh.ethnics]);

  return (
    <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
      {rows.map((row) => (
        <div key={row.id} className="fantasy-glass rounded-xl px-3 py-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold" style={{ color: getNationColor(row.id) }}>
              {row.name}
            </span>
            <span className="fantasy-text-muted">#{row.id}</span>
          </div>

          <div className="mt-1 text-[11px]">
            <span className="font-medium">Ethnic Population:</span>{' '}
            {formatPopulation(row.totalPopulation)}
          </div>
        </div>
      ))}
      {rows.length === 0 && (
        <p className="fantasy-text-muted text-xs">No ethnic groups generated.</p>
      )}
    </div>
  );
}
