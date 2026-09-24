'use client';

import { useMemo } from 'react';
import { toPercent } from 'src/services/utils';
import { TCell, TDelaunayMesh, TNation, TTerranStatisticData } from 'src/types/global';

export type TNationEthnicData = {
  id: number;
  name: string;
  count: number;
  percent: number;
  population: number;
  economy: number;
  populationPercent: number;
};

export type TNationProvinceData = {
  id: number;
  population: number;
  economy: number;
  cellCount: number;
};

export type TNationData = {
  cells: TCell[];
  population: number;
  economy: number;
  landforms: TTerranStatisticData[];
  biomes: TTerranStatisticData[];
  ethnics: TNationEthnicData[];
  provinces: TNationProvinceData[];
};

type TNationReturnData = {
  nation?: TNation;
  data?: TNationData;
};

export default function useNationStatistic(
  nationId: number | null,
  mesh: TDelaunayMesh
): TNationReturnData {
  const nation = useMemo(() => {
    return nationId !== null ? mesh.nations.find((item) => item.id === nationId) : undefined;
  }, [mesh.nations, nationId]);

  const data = useMemo(() => {
    if (nation) {
      const cells = mesh.cells.filter((cell) => !cell.isWater && cell.nationId === nation.id);
      const landformCounts = new Map<string, number>();
      const biomeCounts = new Map<string, number>();
      const ethnicCounts = new Map<number, number>();
      const ethnicPopulation = new Map<number, number>();
      const ethnicEconomy = new Map<number, number>();
      let population = 0;
      let economy = 0;

      const provincePopulationMap = new Map<number, number>();
      const provinceEconomyMap = new Map<number, number>();
      const provinceCellCountMap = new Map<number, number>();

      for (const cell of cells) {
        landformCounts.set(cell.landform, (landformCounts.get(cell.landform) || 0) + 1);
        biomeCounts.set(cell.biome, (biomeCounts.get(cell.biome) || 0) + 1);
        population += cell.population;
        economy += cell.economy;
        if (cell.ethnicId !== null) {
          ethnicCounts.set(cell.ethnicId, (ethnicCounts.get(cell.ethnicId) || 0) + 1);
          ethnicPopulation.set(
            cell.ethnicId,
            (ethnicPopulation.get(cell.ethnicId) || 0) + cell.population
          );
          ethnicEconomy.set(cell.ethnicId, (ethnicEconomy.get(cell.ethnicId) || 0) + cell.economy);
        }
        if (cell.provinceId !== null) {
          provincePopulationMap.set(
            cell.provinceId,
            (provincePopulationMap.get(cell.provinceId) || 0) + cell.population
          );
          provinceEconomyMap.set(
            cell.provinceId,
            (provinceEconomyMap.get(cell.provinceId) || 0) + cell.economy
          );
          provinceCellCountMap.set(
            cell.provinceId,
            (provinceCellCountMap.get(cell.provinceId) || 0) + 1
          );
        }
      }

      const landforms = Array.from(landformCounts.entries())
        .map(([terrain, count]) => ({
          terrain,
          count,
          percent: toPercent(count, cells.length),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
      const biomes = Array.from(biomeCounts.entries())
        .map(([terrain, count]) => ({
          terrain,
          count,
          percent: toPercent(count, cells.length),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      const ethnicNameById = new Map(mesh.ethnics.map((group) => [group.id, group.name]));
      const ethnics = Array.from(ethnicCounts.entries())
        .map(([id, count]) => ({
          id,
          name: ethnicNameById.get(id) || `Ethnic #${id}`,
          count,
          percent: toPercent(count, cells.length),
          population: ethnicPopulation.get(id) || 0,
          economy: ethnicEconomy.get(id) || 0,
          populationPercent: toPercent(ethnicPopulation.get(id) || 0, population),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      const provinces = Array.from(provincePopulationMap.entries())
        .map(([id, population]) => ({
          id,
          population,
          economy: provinceEconomyMap.get(id) || 0,
          cellCount: provinceCellCountMap.get(id) || 0,
        }))
        .sort((a, b) => a.id - b.id);

      return { cells, population, economy, landforms, biomes, ethnics, provinces };
    }
  }, [mesh.cells, mesh.ethnics, nation]);

  return { nation, data };
}
