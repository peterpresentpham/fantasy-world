import { DEFAULT_CONFIG } from 'src/configs/map/common';
import { TOPOGRAPHY_PRESET_CONFIG } from 'src/configs/map/topography';
import { TTopography } from 'src/types/global';

export type TWorldParams = {
  seed: string;
  topography: TTopography;
  seaLevel: number;
  nationCount: number;
  cellCount: number;
};

const MAX_SEED_LENGTH = 64;

function parseNumber(value: string | null) {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Reads a shared-world link. Anything missing or out of range is left out. */
export function parseWorldParams(search: string): Partial<TWorldParams> {
  const query = new URLSearchParams(search);
  const result: Partial<TWorldParams> = {};

  const seed = query.get('seed')?.trim();
  if (seed && seed.length <= MAX_SEED_LENGTH) result.seed = seed;

  const topography = query.get('topo');
  if (topography && Object.hasOwn(TOPOGRAPHY_PRESET_CONFIG, topography)) {
    result.topography = topography as TTopography;
  }

  const seaLevel = parseNumber(query.get('sea'));
  if (seaLevel !== null && seaLevel >= 0.1 && seaLevel <= 0.9) result.seaLevel = seaLevel;

  const nationCount = parseNumber(query.get('nations'));
  if (
    nationCount !== null &&
    Number.isInteger(nationCount) &&
    nationCount >= 2 &&
    nationCount <= 40
  ) {
    result.nationCount = nationCount;
  }

  const cellCount = parseNumber(query.get('cells'));
  if (
    cellCount !== null &&
    Number.isInteger(cellCount) &&
    cellCount >= DEFAULT_CONFIG.minCells &&
    cellCount <= DEFAULT_CONFIG.maxCells
  ) {
    result.cellCount = cellCount;
  }

  return result;
}

/** Builds the query string for a world: the seed always, other settings only when not default. */
export function buildWorldSearch(world: TWorldParams): string {
  const query = new URLSearchParams();
  query.set('seed', world.seed);
  if (world.topography !== DEFAULT_CONFIG.topography) query.set('topo', world.topography);
  if (world.seaLevel !== DEFAULT_CONFIG.seaLevel) query.set('sea', String(world.seaLevel));
  if (world.nationCount !== DEFAULT_CONFIG.nationCount) {
    query.set('nations', String(world.nationCount));
  }
  if (world.cellCount !== DEFAULT_CONFIG.cellCount) query.set('cells', String(world.cellCount));
  return `?${query.toString()}`;
}
