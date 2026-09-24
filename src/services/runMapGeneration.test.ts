import { DEFAULT_CONFIG } from 'src/configs/map/common';
import { TDelaunayMesh, TGenerationConfig, TGenerationStages } from 'src/types/global';
import { describe, expect, it } from 'vitest';
import { MapGenerator } from './pipeline/MapGenerator';

type TStageSignature = {
  cells: number;
  edges: number;
  vertices: number;
  landCells: number;
  riverCells: number;
  lakeCells: number;
  totalPopulation: number;
  nationCount: number;
  ethnicGroupCount: number;
  hash: string;
};

type TPipelineSignature = {
  mesh: TStageSignature;
  topography: TStageSignature;
  hydrology: TStageSignature;
  population: TStageSignature;
  geopolitics: TStageSignature;
};

function runMapGenerationStages(config: TGenerationConfig): TGenerationStages {
  const generator = new MapGenerator(config);
  return generator.generate();
}

function fnv1a64Hex(parts: readonly string[]) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;

  for (const part of parts) {
    for (let index = 0; index < part.length; index += 1) {
      hash ^= BigInt(part.charCodeAt(index));
      hash = (hash * prime) & 0xffffffffffffffffn;
    }
  }

  return hash.toString(16).padStart(16, '0');
}

function toStageSignature(mesh: TDelaunayMesh): TStageSignature {
  let landCells = 0;
  let riverCells = 0;
  let lakeCells = 0;
  let totalPopulation = 0;
  const hashParts: string[] = [];

  for (const cell of mesh.cells) {
    if (!cell.isWater) landCells += 1;
    if (cell.isRiver) riverCells += 1;
    if (cell.isLake) lakeCells += 1;
    totalPopulation += cell.population;

    hashParts.push(
      [
        cell.id,
        Math.round(cell.site[0] * 1000),
        Math.round(cell.site[1] * 1000),
        Math.round(cell.elevation * 1_000_000),
        cell.isWater ? 1 : 0,
        cell.landform,
        cell.biome,
        Math.round(cell.flow * 1000),
        cell.downstreamId ?? -99,
        Math.round(cell.erosion * 1_000_000),
        cell.isRiver ? 1 : 0,
        cell.isLake ? 1 : 0,
        Math.round(cell.temperature * 1_000_000),
        Math.round(cell.precipitation * 1_000_000),
        Math.round(cell.rainShadow * 1_000_000),
        cell.population,
        Math.round(cell.waterAccessScore * 1_000_000),
        cell.nationId ?? -1,
        cell.provinceId ?? -1,
        cell.ethnicId ?? -1,
        cell.zoneType,
        cell.isCapital ? 1 : 0,
        cell.isEconomicHub ? 1 : 0,
      ].join('|')
    );
  }

  return {
    cells: mesh.cells.length,
    edges: mesh.edges.length,
    vertices: mesh.vertices.length,
    landCells,
    riverCells,
    lakeCells,
    totalPopulation,
    nationCount: mesh.nations.length,
    ethnicGroupCount: mesh.ethnics.length,
    hash: fnv1a64Hex(hashParts),
  };
}

function toPipelineSignature(config: TGenerationConfig): TPipelineSignature {
  const stages = runMapGenerationStages(config);
  return {
    mesh: toStageSignature(stages.mesh),
    topography: toStageSignature(stages.topography),
    hydrology: toStageSignature(stages.hydrology),
    population: toStageSignature(stages.population),
    geopolitics: toStageSignature(stages.geopolitics),
  };
}

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

const BASELINE_CONFIGS: TGenerationConfig[] = [
  makeConfig('world-deterministic-001'),
  makeConfig('world-deterministic-002'),
  makeConfig('world-deterministic-003'),
  {
    ...makeConfig('world-deterministic-004'),
    cellCount: 1600,
    seaLevel: 0.5,
    topography: 'archipelago',
  },
  {
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
];

describe('runMapGenerationStages deterministic snapshots', () => {
  it('returns identical stage signatures for same config', () => {
    const config = makeConfig('world-deterministic-001');
    const first = toPipelineSignature(config);
    const second = toPipelineSignature(config);
    expect(second).toEqual(first);
  });

  it('matches locked snapshot for baseline seed and config', () => {
    const signature = toPipelineSignature(makeConfig('world-deterministic-001'));
    expect(signature).toMatchInlineSnapshot(`
      {
        "geopolitics": {
          "cells": 2000,
          "edges": 6001,
          "ethnicGroupCount": 13,
          "hash": "c6b890affd3dc211",
          "lakeCells": 138,
          "landCells": 813,
          "nationCount": 10,
          "riverCells": 117,
          "totalPopulation": 2363162,
          "vertices": 4002,
        },
        "hydrology": {
          "cells": 2000,
          "edges": 6001,
          "ethnicGroupCount": 0,
          "hash": "0af5219f20d41934",
          "lakeCells": 138,
          "landCells": 813,
          "nationCount": 0,
          "riverCells": 117,
          "totalPopulation": 0,
          "vertices": 4002,
        },
        "mesh": {
          "cells": 2000,
          "edges": 6001,
          "ethnicGroupCount": 0,
          "hash": "4e5ccd9f78425bb3",
          "lakeCells": 0,
          "landCells": 2000,
          "nationCount": 0,
          "riverCells": 0,
          "totalPopulation": 0,
          "vertices": 4002,
        },
        "population": {
          "cells": 2000,
          "edges": 6001,
          "ethnicGroupCount": 0,
          "hash": "f4f51ff36fc41612",
          "lakeCells": 138,
          "landCells": 813,
          "nationCount": 0,
          "riverCells": 117,
          "totalPopulation": 674972,
          "vertices": 4002,
        },
        "topography": {
          "cells": 2000,
          "edges": 6001,
          "ethnicGroupCount": 0,
          "hash": "aeb3d2a4b9423764",
          "lakeCells": 0,
          "landCells": 948,
          "nationCount": 0,
          "riverCells": 0,
          "totalPopulation": 0,
          "vertices": 4002,
        },
      }
    `);
  });

  it('matches locked snapshots for baseline config matrix', () => {
    const signatures = BASELINE_CONFIGS.map((config) => ({
      seed: config.seed,
      cellCount: config.cellCount,
      seaLevel: config.seaLevel,
      topography: config.topography,
      nationCount: config.nationCount,
      climateControl: config.climateControl,
      signature: toPipelineSignature(config),
    }));
    expect(signatures).toMatchInlineSnapshot(`
      [
        {
          "cellCount": 2000,
          "climateControl": {
            "humanImpact": 0.5,
            "precipitationOffset": 0.3,
            "precipitationScale": 1.5,
            "temperatureContrast": 1.5,
            "temperatureOffset": 0.2,
          },
          "nationCount": 10,
          "seaLevel": 0.5,
          "seed": "world-deterministic-001",
          "signature": {
            "geopolitics": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 13,
              "hash": "c6b890affd3dc211",
              "lakeCells": 138,
              "landCells": 813,
              "nationCount": 10,
              "riverCells": 117,
              "totalPopulation": 2363162,
              "vertices": 4002,
            },
            "hydrology": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 0,
              "hash": "0af5219f20d41934",
              "lakeCells": 138,
              "landCells": 813,
              "nationCount": 0,
              "riverCells": 117,
              "totalPopulation": 0,
              "vertices": 4002,
            },
            "mesh": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 0,
              "hash": "4e5ccd9f78425bb3",
              "lakeCells": 0,
              "landCells": 2000,
              "nationCount": 0,
              "riverCells": 0,
              "totalPopulation": 0,
              "vertices": 4002,
            },
            "population": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 0,
              "hash": "f4f51ff36fc41612",
              "lakeCells": 138,
              "landCells": 813,
              "nationCount": 0,
              "riverCells": 117,
              "totalPopulation": 674972,
              "vertices": 4002,
            },
            "topography": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 0,
              "hash": "aeb3d2a4b9423764",
              "lakeCells": 0,
              "landCells": 948,
              "nationCount": 0,
              "riverCells": 0,
              "totalPopulation": 0,
              "vertices": 4002,
            },
          },
          "topography": "balanced",
        },
        {
          "cellCount": 2000,
          "climateControl": {
            "humanImpact": 0.5,
            "precipitationOffset": 0.3,
            "precipitationScale": 1.5,
            "temperatureContrast": 1.5,
            "temperatureOffset": 0.2,
          },
          "nationCount": 10,
          "seaLevel": 0.5,
          "seed": "world-deterministic-002",
          "signature": {
            "geopolitics": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 16,
              "hash": "4bd1698f723265ee",
              "lakeCells": 114,
              "landCells": 689,
              "nationCount": 10,
              "riverCells": 31,
              "totalPopulation": 2068782,
              "vertices": 4002,
            },
            "hydrology": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 0,
              "hash": "177d6510d0149fc5",
              "lakeCells": 114,
              "landCells": 689,
              "nationCount": 0,
              "riverCells": 31,
              "totalPopulation": 0,
              "vertices": 4002,
            },
            "mesh": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 0,
              "hash": "9f7c4a421dd264b7",
              "lakeCells": 0,
              "landCells": 2000,
              "nationCount": 0,
              "riverCells": 0,
              "totalPopulation": 0,
              "vertices": 4002,
            },
            "population": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 0,
              "hash": "931258abefac0ae0",
              "lakeCells": 114,
              "landCells": 689,
              "nationCount": 0,
              "riverCells": 31,
              "totalPopulation": 923537,
              "vertices": 4002,
            },
            "topography": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 0,
              "hash": "9f198dbfd2e25f17",
              "lakeCells": 0,
              "landCells": 769,
              "nationCount": 0,
              "riverCells": 0,
              "totalPopulation": 0,
              "vertices": 4002,
            },
          },
          "topography": "balanced",
        },
        {
          "cellCount": 2000,
          "climateControl": {
            "humanImpact": 0.5,
            "precipitationOffset": 0.3,
            "precipitationScale": 1.5,
            "temperatureContrast": 1.5,
            "temperatureOffset": 0.2,
          },
          "nationCount": 10,
          "seaLevel": 0.5,
          "seed": "world-deterministic-003",
          "signature": {
            "geopolitics": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 20,
              "hash": "7d54cb9615f3f92f",
              "lakeCells": 131,
              "landCells": 544,
              "nationCount": 10,
              "riverCells": 7,
              "totalPopulation": 2017071,
              "vertices": 4002,
            },
            "hydrology": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 0,
              "hash": "a1b84847287e9786",
              "lakeCells": 131,
              "landCells": 544,
              "nationCount": 0,
              "riverCells": 7,
              "totalPopulation": 0,
              "vertices": 4002,
            },
            "mesh": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 0,
              "hash": "499cdb455de6ebc9",
              "lakeCells": 0,
              "landCells": 2000,
              "nationCount": 0,
              "riverCells": 0,
              "totalPopulation": 0,
              "vertices": 4002,
            },
            "population": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 0,
              "hash": "fc7024db74edd26c",
              "lakeCells": 131,
              "landCells": 544,
              "nationCount": 0,
              "riverCells": 7,
              "totalPopulation": 861615,
              "vertices": 4002,
            },
            "topography": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 0,
              "hash": "48c5addeb6841659",
              "lakeCells": 0,
              "landCells": 661,
              "nationCount": 0,
              "riverCells": 0,
              "totalPopulation": 0,
              "vertices": 4002,
            },
          },
          "topography": "balanced",
        },
        {
          "cellCount": 1600,
          "climateControl": {
            "humanImpact": 0.5,
            "precipitationOffset": 0.3,
            "precipitationScale": 1.5,
            "temperatureContrast": 1.5,
            "temperatureOffset": 0.2,
          },
          "nationCount": 10,
          "seaLevel": 0.5,
          "seed": "world-deterministic-004",
          "signature": {
            "geopolitics": {
              "cells": 1600,
              "edges": 4801,
              "ethnicGroupCount": 15,
              "hash": "8e950bc84770a2d8",
              "lakeCells": 12,
              "landCells": 361,
              "nationCount": 10,
              "riverCells": 39,
              "totalPopulation": 1384335,
              "vertices": 3202,
            },
            "hydrology": {
              "cells": 1600,
              "edges": 4801,
              "ethnicGroupCount": 0,
              "hash": "28b05ceb70972326",
              "lakeCells": 12,
              "landCells": 361,
              "nationCount": 0,
              "riverCells": 39,
              "totalPopulation": 0,
              "vertices": 3202,
            },
            "mesh": {
              "cells": 1600,
              "edges": 4801,
              "ethnicGroupCount": 0,
              "hash": "ac12a4ed4dc479ae",
              "lakeCells": 0,
              "landCells": 1600,
              "nationCount": 0,
              "riverCells": 0,
              "totalPopulation": 0,
              "vertices": 3202,
            },
            "population": {
              "cells": 1600,
              "edges": 4801,
              "ethnicGroupCount": 0,
              "hash": "c3f6da103150039f",
              "lakeCells": 12,
              "landCells": 361,
              "nationCount": 0,
              "riverCells": 39,
              "totalPopulation": 448257,
              "vertices": 3202,
            },
            "topography": {
              "cells": 1600,
              "edges": 4801,
              "ethnicGroupCount": 0,
              "hash": "6ca5c51f603e62f2",
              "lakeCells": 0,
              "landCells": 372,
              "nationCount": 0,
              "riverCells": 0,
              "totalPopulation": 0,
              "vertices": 3202,
            },
          },
          "topography": "archipelago",
        },
        {
          "cellCount": 2400,
          "climateControl": {
            "humanImpact": 0.35,
            "precipitationOffset": 0.3,
            "precipitationScale": 0.9,
            "temperatureContrast": 1.5,
            "temperatureOffset": -0.06,
          },
          "nationCount": 10,
          "seaLevel": 0.58,
          "seed": "world-deterministic-005",
          "signature": {
            "geopolitics": {
              "cells": 2400,
              "edges": 7201,
              "ethnicGroupCount": 16,
              "hash": "abbd6a41796b3c3d",
              "lakeCells": 40,
              "landCells": 797,
              "nationCount": 10,
              "riverCells": 25,
              "totalPopulation": 5072256,
              "vertices": 4802,
            },
            "hydrology": {
              "cells": 2400,
              "edges": 7201,
              "ethnicGroupCount": 0,
              "hash": "98b4bab3eb9766f6",
              "lakeCells": 40,
              "landCells": 797,
              "nationCount": 0,
              "riverCells": 25,
              "totalPopulation": 0,
              "vertices": 4802,
            },
            "mesh": {
              "cells": 2400,
              "edges": 7201,
              "ethnicGroupCount": 0,
              "hash": "c2a8187839e58c2a",
              "lakeCells": 0,
              "landCells": 2400,
              "nationCount": 0,
              "riverCells": 0,
              "totalPopulation": 0,
              "vertices": 4802,
            },
            "population": {
              "cells": 2400,
              "edges": 7201,
              "ethnicGroupCount": 0,
              "hash": "c3ed7899a4cc3317",
              "lakeCells": 40,
              "landCells": 797,
              "nationCount": 0,
              "riverCells": 25,
              "totalPopulation": 1714552,
              "vertices": 4802,
            },
            "topography": {
              "cells": 2400,
              "edges": 7201,
              "ethnicGroupCount": 0,
              "hash": "dc390e5772b29c4c",
              "lakeCells": 0,
              "landCells": 834,
              "nationCount": 0,
              "riverCells": 0,
              "totalPopulation": 0,
              "vertices": 4802,
            },
          },
          "topography": "ranges",
        },
      ]
    `);
  });
});
