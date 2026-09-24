'use client';

import { useMemo } from 'react';
import { TCell, TDelaunayMesh, TEthnic, TTerranStatisticData } from 'src/types/global';
import { toPercent } from 'src/services/utils';

export type TEthnicData = {
  ethnics: TEthnic;
  ethnicCells: TCell[];
  totalPopulation: number;
  nations: { id: number; name: string; population: number }[];
  landforms: TTerranStatisticData[];
  biomes: TTerranStatisticData[];
};

type TEthnicReturnData = {
  data?: TEthnicData;
};

export default function useEthnicStatistic(
  ethnicId: number | null,
  mesh: TDelaunayMesh
): TEthnicReturnData {
  const data = useMemo(() => {
    if (ethnicId === null) return undefined;
    const ethnics = mesh.ethnics.find((group) => group.id === ethnicId);
    if (!ethnics) return undefined;

    const ethnicCells = mesh.cells.filter((cell) => !cell.isWater && cell.ethnicId === ethnicId);
    const totalPopulation = ethnicCells.reduce((sum, cell) => sum + cell.population, 0);

    const nationNameById = new Map(mesh.nations.map((nation) => [nation.id, nation.name]));
    const populationByNation = new Map<number, number>();
    const landformCount = new Map<string, number>();
    const biomeCount = new Map<string, number>();

    for (const cell of ethnicCells) {
      if (cell.nationId !== null) {
        populationByNation.set(
          cell.nationId,
          (populationByNation.get(cell.nationId) || 0) + cell.population
        );
      }
      landformCount.set(cell.landform, (landformCount.get(cell.landform) || 0) + 1);
      biomeCount.set(cell.biome, (biomeCount.get(cell.biome) || 0) + 1);
    }

    const nations = Array.from(populationByNation.entries())
      .map(([id, population]) => ({
        id,
        name: nationNameById.get(id) || `Nation #${id}`,
        population,
      }))
      .sort((a, b) => b.population - a.population);

    const landforms = Array.from(landformCount.entries())
      .map(([terrain, count]) => ({
        terrain,
        count,
        percent: toPercent(count, ethnicCells.length),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    const biomes = Array.from(biomeCount.entries())
      .map(([terrain, count]) => ({
        terrain,
        count,
        percent: toPercent(count, ethnicCells.length),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return { ethnics, ethnicCells, totalPopulation, nations, landforms, biomes };
  }, [ethnicId, mesh.cells, mesh.ethnics, mesh.nations]);

  return { data };
}
