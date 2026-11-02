import { TMesh } from 'src/types/global';
import { createSeededRandom } from './math';

export type TWorldSummary = {
  name: string;
  nationCount: number;
  ethnicCount: number;
  landPercent: number;
  population: number;
  riverCount: number;
  longestRiver: { name: string; length: number } | null;
  /** nations ordered by population, biggest first */
  nations: { id: number; name: string; population: number }[];
};

const START = ['Ael', 'Bor', 'Cal', 'Dra', 'El', 'Far', 'Gal', 'Hael', 'Ith', 'Kor', 'Lun', 'Mor'];
const MIDDLE = ['an', 'dor', 'en', 'ia', 'or', 'ur', 'ae', 'is'];
const END = ['dia', 'mar', 'nor', 'ra', 'thas', 'vell', 'wyn', 'zar'];

/** A stable name for a seed, so a shared link shows the same title. */
export function buildWorldName(seed: string): string {
  const next = createSeededRandom(seed);
  const pick = (list: string[]) => list[Math.floor(next() * list.length)];
  return `${pick(START)}${pick(MIDDLE)}${pick(END)}`;
}

export function buildWorldSummary(mesh: TMesh, seed: string): TWorldSummary {
  const populationByNation = new Map<number, number>();
  let land = 0;
  let population = 0;
  for (const cell of mesh.cells) {
    if (cell.isWater) continue;
    land += 1;
    population += cell.population;
    if (cell.nationId !== null && cell.nationId >= 0) {
      populationByNation.set(
        cell.nationId,
        (populationByNation.get(cell.nationId) ?? 0) + cell.population
      );
    }
  }

  const longest = mesh.rivers.reduce<TMesh['rivers'][number] | null>(
    (best, river) => (!best || river.length > best.length ? river : best),
    null
  );

  return {
    name: buildWorldName(seed),
    nationCount: mesh.nations.length,
    ethnicCount: mesh.ethnics.length,
    landPercent: mesh.cells.length ? Math.round((land / mesh.cells.length) * 100) : 0,
    population,
    riverCount: mesh.rivers.length,
    longestRiver: longest ? { name: longest.name, length: longest.length } : null,
    nations: mesh.nations
      .map((nation) => ({
        id: nation.id,
        name: nation.name,
        population: populationByNation.get(nation.id) ?? 0,
      }))
      .sort((a, b) => b.population - a.population),
  };
}

export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}
