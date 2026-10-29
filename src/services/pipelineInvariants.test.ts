import { DEFAULT_CONFIG } from 'src/configs/map/common';
import { sortIndicesByElevation } from 'src/services/hydrology/river';
import { TGenerationConfig, TGenerationStages, TTopography } from 'src/types/global';
import { beforeAll, describe, expect, it } from 'vitest';
import { MapGenerator, createGeneratorState } from './pipeline/MapGenerator';

// Properties that must hold for EVERY generated world. `quick` (default) checks one config;
// `FANTASY_TEST_PROFILE=full` (npm run test:full) sweeps seeds, presets, sizes and nation counts.
const PRESETS: TTopography[] = [
  'balanced',
  'ranges',
  'rifted',
  'archipelago',
  'volcanic',
  'continental',
];

function makeConfig(seed: string, overrides: Partial<TGenerationConfig> = {}): TGenerationConfig {
  return {
    width: DEFAULT_CONFIG.width,
    height: DEFAULT_CONFIG.height,
    seed,
    cellCount: 4000,
    seaLevel: DEFAULT_CONFIG.seaLevel,
    topography: DEFAULT_CONFIG.topography,
    nationCount: DEFAULT_CONFIG.nationCount,
    climateControl: DEFAULT_CONFIG.climateControl,
    ...overrides,
  };
}

function buildConfigs(): TGenerationConfig[] {
  const quick = [makeConfig('world-deterministic-001')];
  if (process.env.FANTASY_TEST_PROFILE !== 'full') return quick;

  const configs = [...quick];
  PRESETS.forEach((topography, index) => {
    configs.push(makeConfig(`full-${topography}-a`, { topography, cellCount: 4000 + index * 500 }));
    configs.push(
      makeConfig(`full-${topography}-b`, {
        topography,
        cellCount: 6000,
        nationCount: 4 + index * 3,
        seaLevel: 0.45 + index * 0.03,
      })
    );
  });
  return configs;
}

const CONFIGS = buildConfigs();
const label = (c: TGenerationConfig) =>
  `${c.seed} (${c.topography}, ${c.cellCount} cells, ${c.nationCount} nations, sea ${c.seaLevel})`;

const generate = (config: TGenerationConfig) =>
  new MapGenerator(config, true, createGeneratorState()).generate();

describe('determinism', () => {
  it('same config yields identical cell data', () => {
    const pick = (s: TGenerationStages) =>
      s.geopolitics.cells.map((c) => [
        c.elevation,
        c.nationId,
        c.provinceId,
        c.ethnicId,
        c.population,
        c.isRiver,
      ]);
    expect(pick(generate(CONFIGS[0]))).toEqual(pick(generate(CONFIGS[0])));
  });

  it('a different seed yields a different map', () => {
    const elevations = (config: TGenerationConfig) =>
      generate(config).topography.cells.map((c) => c.elevation);
    const other = { ...CONFIGS[0], seed: `${CONFIGS[0].seed}-other` };
    expect(elevations(other)).not.toEqual(elevations(CONFIGS[0]));
  });
});

describe('sortIndicesByElevation', () => {
  it('orders indices by descending elevation, ties by index', () => {
    const elevation = Float32Array.from([0.5, 0.1, 0.9, 0.3]);
    expect(Array.from(sortIndicesByElevation(elevation))).toEqual([2, 0, 3, 1]);
    expect(Array.from(sortIndicesByElevation(new Float32Array([1, 1, 1])))).toEqual([0, 1, 2]);
  });
});

describe.each(CONFIGS.map((config) => [label(config), config] as const))(
  'pipeline invariants: %s',
  (_name, config) => {
    let stages: TGenerationStages;

    beforeAll(() => {
      stages = generate(config);
    });

    it('mesh has symmetric neighbors and in-range ids', () => {
      const { cells } = stages.mesh;
      expect(cells.length).toBeGreaterThan(0);
      for (const cell of cells) {
        for (const n of cell.neighbors) {
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThan(cells.length);
          expect(cells[n].neighbors).toContain(cell.id);
        }
      }
    });

    it('river cells drain into a neighboring cell and carry a river id', () => {
      for (const cell of stages.hydrology.cells) {
        expect(cell.flow).toBeGreaterThanOrEqual(0);
        if (!cell.isRiver) continue;
        expect(cell.riverId).not.toBeNull();
        if (cell.downstreamId !== null) expect(cell.neighbors).toContain(cell.downstreamId);
      }
    });

    it('every river lists existing cells', () => {
      const { cells, rivers } = stages.geopolitics;
      for (const river of rivers) {
        expect(river.cells.length).toBeGreaterThan(0);
        for (const id of river.cells) expect(cells[id]).toBeDefined();
      }
    });

    it('population is finite, non-negative, and zero on open water', () => {
      for (const cell of stages.population.cells) {
        expect(Number.isFinite(cell.population)).toBe(true);
        expect(cell.population).toBeGreaterThanOrEqual(0);
      }
      for (const cell of stages.geopolitics.cells) {
        if (cell.isWater && !cell.isLake) expect(cell.population).toBe(0);
      }
    });

    it('nation ids are valid and capitals belong to their nation', () => {
      const { cells, nations } = stages.geopolitics;
      const ids = new Set(nations.map((n) => n.id));
      for (const cell of cells) {
        if (cell.nationId !== null) expect(ids.has(cell.nationId)).toBe(true);
      }
      for (const nation of nations) {
        if (nation.capitalCellId === null) continue;
        expect(cells[nation.capitalCellId].nationId).toBe(nation.id);
      }
    });

    it('every nation owns at least one land cell', () => {
      const { cells, nations } = stages.geopolitics;
      for (const nation of nations) {
        expect(cells.some((c) => c.nationId === nation.id && !c.isWater)).toBe(true);
      }
    });

    it('ethnic ids reference real ethnic groups', () => {
      const { cells, ethnics } = stages.geopolitics;
      const ids = new Set(ethnics.map((e) => e.id));
      for (const cell of cells) {
        if (cell.ethnicId !== null) expect(ids.has(cell.ethnicId)).toBe(true);
      }
    });
  }
);
