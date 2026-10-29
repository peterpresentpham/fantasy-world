import { DEFAULT_CONFIG } from 'src/configs/map/common';
import { TGenerationConfig, TGenerationStage } from 'src/types/global';
import { describe, expect, it } from 'vitest';
import { createGeneratorState, MapGenerator } from './MapGenerator';

const config: TGenerationConfig = {
  width: DEFAULT_CONFIG.width,
  height: DEFAULT_CONFIG.height,
  seed: 'stage-order',
  cellCount: 1500,
  seaLevel: DEFAULT_CONFIG.seaLevel,
  topography: DEFAULT_CONFIG.topography,
  nationCount: DEFAULT_CONFIG.nationCount,
  climateControl: DEFAULT_CONFIG.climateControl,
};

function collect(generator: MapGenerator) {
  const stages: TGenerationStage[] = [];
  generator.generate({}, (stage) => stages.push(stage));
  return stages;
}

describe('MapGenerator onStage', () => {
  it('reports every stage once, in pipeline order', () => {
    const generator = new MapGenerator(config, true, createGeneratorState());
    expect(collect(generator)).toEqual([
      'mesh',
      'topography',
      'hydrology',
      'population',
      'geopolitics',
    ]);
  });

  it('still reports every stage when only some are served from the cache', () => {
    const state = createGeneratorState();
    new MapGenerator(config, false, state).generate();
    const changedNations = { ...config, nationCount: config.nationCount + 2 };
    expect(collect(new MapGenerator(changedNations, false, state))).toEqual([
      'mesh',
      'topography',
      'hydrology',
      'geopolitics',
    ]);
  });

  it('does not change the generated map', () => {
    const plain = new MapGenerator(config, true, createGeneratorState()).generate();
    const observed = new MapGenerator(config, true, createGeneratorState()).generate({}, () => {});
    const pick = (s: typeof plain) => s.geopolitics.cells.map((c) => [c.elevation, c.nationId]);
    expect(pick(observed)).toEqual(pick(plain));
  });
});
