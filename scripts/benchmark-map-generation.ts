import { performance } from 'node:perf_hooks';
import { DEFAULT_CONFIG } from 'src/configs/map/common';
import { buildGeopolitics } from 'src/services/geopolitics';
import { buildPopulation } from 'src/services/geopolitics/population';
import { buildHydrology } from 'src/services/hydrology';
import { MapGenerator } from 'src/services/pipeline/MapGenerator';
import { buildTopography } from 'src/services/terrain/buildTopography';
import { buildMesh } from 'src/services/terrain/mesh';
import { TGenerationConfig } from 'src/types/global';

type TBenchConfig = {
  name: string;
  config: TGenerationConfig;
};

function makeConfig(seed: string): TGenerationConfig {
  return {
    width: DEFAULT_CONFIG.width,
    height: DEFAULT_CONFIG.height,
    seed,
    cellCount: 2000,
    seaLevel: DEFAULT_CONFIG.seaLevel,
    topography: DEFAULT_CONFIG.topography,
    nationCount: DEFAULT_CONFIG.nationCount,
    climateControl: DEFAULT_CONFIG.climateControl,
  };
}

const BENCH_CONFIGS: TBenchConfig[] = [
  { name: 'baseline-001', config: makeConfig('world-deterministic-001') },
  { name: 'baseline-002', config: makeConfig('world-deterministic-002') },
  {
    name: 'archipelago-1600',
    config: {
      ...makeConfig('world-deterministic-004'),
      cellCount: 1600,
      seaLevel: 0.5,
      topography: 'archipelago',
    },
  },
  {
    name: 'ranges-2400',
    config: {
      ...makeConfig('world-deterministic-005'),
      cellCount: 2400,
      seaLevel: 0.58,
      topography: 'ranges',
      nationCount: 10,
      climateControl: {
        ...DEFAULT_CONFIG.climateControl,
        temperatureOffset: -0.06,
        precipitationScale: 0.9,
        humanImpact: 0.35,
      },
    },
  },
];

function formatMs(value: number) {
  return `${value.toFixed(2)}ms`;
}

function runBench(name: string, config: TGenerationConfig) {
  const generator = new MapGenerator(config);
  const start = performance.now();
  const stages = generator.generate();
  const end = performance.now();

  console.debug(
    [
      `[${name}]`,
      `total=${formatMs(end - start)}`,
      `cells=${stages.geopolitics.cells.length}`,
      `rivers=${stages.geopolitics.rivers.length}`,
      `nations=${stages.geopolitics.nations.length}`,
    ].join(' ')
  );
}

function runStageBench(name: string, config: TGenerationConfig) {
  const { width, height, seed, cellCount, seaLevel, topography, climateControl, nationCount } =
    config;

  const t0 = performance.now();
  const mesh = buildMesh({ width, height, seed, cellCount });
  const t1 = performance.now();
  const topo = buildTopography({ mesh, seed, seaLevel, topography });
  const t2 = performance.now();
  const hydro = buildHydrology({ mesh: topo, seaLevel, seed, climateControl });
  const t3 = performance.now();
  const pop = buildPopulation({ mesh: hydro, seed });
  const t4 = performance.now();
  const geo = buildGeopolitics({ mesh: pop, seed, nationCount });
  const t5 = performance.now();

  console.debug(
    [
      `[${name}:stages]`,
      `mesh=${formatMs(t1 - t0)}`,
      `topography=${formatMs(t2 - t1)}`,
      `hydrology=${formatMs(t3 - t2)}`,
      `population=${formatMs(t4 - t3)}`,
      `geopolitics=${formatMs(t5 - t4)}`,
      `total=${formatMs(t5 - t0)}`,
      `cells=${geo.cells.length}`,
    ].join(' ')
  );
}

console.debug('Map generation benchmark');
for (const bench of BENCH_CONFIGS) {
  runStageBench(bench.name, bench.config);
  runBench(bench.name, bench.config);
}
