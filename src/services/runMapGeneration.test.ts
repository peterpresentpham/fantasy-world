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
          "ethnicGroupCount": 12,
          "hash": "d77d332516de8a11",
          "lakeCells": 47,
          "landCells": 807,
          "nationCount": 10,
          "riverCells": 0,
          "totalPopulation": 2203899,
          "vertices": 4002,
        },
        "hydrology": {
          "cells": 2000,
          "edges": 6001,
          "ethnicGroupCount": 0,
          "hash": "cb048ebd768a2a66",
          "lakeCells": 47,
          "landCells": 807,
          "nationCount": 0,
          "riverCells": 0,
          "totalPopulation": 0,
          "vertices": 4002,
        },
        "mesh": {
          "cells": 2000,
          "edges": 6001,
          "ethnicGroupCount": 0,
          "hash": "c8dad34f0c637291",
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
          "hash": "5fc91acbb8a17d36",
          "lakeCells": 47,
          "landCells": 807,
          "nationCount": 0,
          "riverCells": 0,
          "totalPopulation": 2100790,
          "vertices": 4002,
        },
        "topography": {
          "cells": 2000,
          "edges": 6001,
          "ethnicGroupCount": 0,
          "hash": "b3fdd298708713d1",
          "lakeCells": 0,
          "landCells": 840,
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
            "precipitationOffset": 0.12,
            "precipitationScale": 1.3,
            "temperatureContrast": 1,
            "temperatureOffset": 0,
          },
          "nationCount": 10,
          "seaLevel": 0.5,
          "seed": "world-deterministic-001",
          "signature": {
            "geopolitics": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 12,
              "hash": "d77d332516de8a11",
              "lakeCells": 47,
              "landCells": 807,
              "nationCount": 10,
              "riverCells": 0,
              "totalPopulation": 2203899,
              "vertices": 4002,
            },
            "hydrology": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 0,
              "hash": "cb048ebd768a2a66",
              "lakeCells": 47,
              "landCells": 807,
              "nationCount": 0,
              "riverCells": 0,
              "totalPopulation": 0,
              "vertices": 4002,
            },
            "mesh": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 0,
              "hash": "c8dad34f0c637291",
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
              "hash": "5fc91acbb8a17d36",
              "lakeCells": 47,
              "landCells": 807,
              "nationCount": 0,
              "riverCells": 0,
              "totalPopulation": 2100790,
              "vertices": 4002,
            },
            "topography": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 0,
              "hash": "b3fdd298708713d1",
              "lakeCells": 0,
              "landCells": 840,
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
            "precipitationOffset": 0.12,
            "precipitationScale": 1.3,
            "temperatureContrast": 1,
            "temperatureOffset": 0,
          },
          "nationCount": 10,
          "seaLevel": 0.5,
          "seed": "world-deterministic-002",
          "signature": {
            "geopolitics": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 12,
              "hash": "d124c3b948c03faf",
              "lakeCells": 73,
              "landCells": 795,
              "nationCount": 10,
              "riverCells": 6,
              "totalPopulation": 2018953,
              "vertices": 4002,
            },
            "hydrology": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 0,
              "hash": "e0ada72d68d58bbe",
              "lakeCells": 73,
              "landCells": 795,
              "nationCount": 0,
              "riverCells": 6,
              "totalPopulation": 0,
              "vertices": 4002,
            },
            "mesh": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 0,
              "hash": "93efd1e657b4c13a",
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
              "hash": "3f2e59c0d1872f2e",
              "lakeCells": 73,
              "landCells": 795,
              "nationCount": 0,
              "riverCells": 6,
              "totalPopulation": 1929638,
              "vertices": 4002,
            },
            "topography": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 0,
              "hash": "c923f327381c0029",
              "lakeCells": 0,
              "landCells": 840,
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
            "precipitationOffset": 0.12,
            "precipitationScale": 1.3,
            "temperatureContrast": 1,
            "temperatureOffset": 0,
          },
          "nationCount": 10,
          "seaLevel": 0.5,
          "seed": "world-deterministic-003",
          "signature": {
            "geopolitics": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 13,
              "hash": "4e603900288ec84d",
              "lakeCells": 110,
              "landCells": 744,
              "nationCount": 10,
              "riverCells": 0,
              "totalPopulation": 4041018,
              "vertices": 4002,
            },
            "hydrology": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 0,
              "hash": "cf4047551228beec",
              "lakeCells": 110,
              "landCells": 744,
              "nationCount": 0,
              "riverCells": 0,
              "totalPopulation": 0,
              "vertices": 4002,
            },
            "mesh": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 0,
              "hash": "3898267119817e22",
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
              "hash": "1a20036f000ffb9d",
              "lakeCells": 110,
              "landCells": 744,
              "nationCount": 0,
              "riverCells": 0,
              "totalPopulation": 3935136,
              "vertices": 4002,
            },
            "topography": {
              "cells": 2000,
              "edges": 6001,
              "ethnicGroupCount": 0,
              "hash": "eba00260670e3831",
              "lakeCells": 0,
              "landCells": 840,
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
            "precipitationOffset": 0.12,
            "precipitationScale": 1.3,
            "temperatureContrast": 1,
            "temperatureOffset": 0,
          },
          "nationCount": 10,
          "seaLevel": 0.5,
          "seed": "world-deterministic-004",
          "signature": {
            "geopolitics": {
              "cells": 1600,
              "edges": 4801,
              "ethnicGroupCount": 5,
              "hash": "6dbbd0a7d0d92987",
              "lakeCells": 0,
              "landCells": 272,
              "nationCount": 10,
              "riverCells": 0,
              "totalPopulation": 1579570,
              "vertices": 3202,
            },
            "hydrology": {
              "cells": 1600,
              "edges": 4801,
              "ethnicGroupCount": 0,
              "hash": "be120b832528e63f",
              "lakeCells": 0,
              "landCells": 272,
              "nationCount": 0,
              "riverCells": 0,
              "totalPopulation": 0,
              "vertices": 3202,
            },
            "mesh": {
              "cells": 1600,
              "edges": 4801,
              "ethnicGroupCount": 0,
              "hash": "e6f168c5090afb59",
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
              "hash": "e8b1a5d632a834dc",
              "lakeCells": 0,
              "landCells": 272,
              "nationCount": 0,
              "riverCells": 0,
              "totalPopulation": 1443507,
              "vertices": 3202,
            },
            "topography": {
              "cells": 1600,
              "edges": 4801,
              "ethnicGroupCount": 0,
              "hash": "a54ae51b2103395e",
              "lakeCells": 0,
              "landCells": 272,
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
            "precipitationOffset": 0.12,
            "precipitationScale": 0.9,
            "temperatureContrast": 1,
            "temperatureOffset": -0.06,
          },
          "nationCount": 10,
          "seaLevel": 0.58,
          "seed": "world-deterministic-005",
          "signature": {
            "geopolitics": {
              "cells": 2400,
              "edges": 7201,
              "ethnicGroupCount": 12,
              "hash": "86e6776f5aa52361",
              "lakeCells": 74,
              "landCells": 873,
              "nationCount": 10,
              "riverCells": 0,
              "totalPopulation": 3275366,
              "vertices": 4802,
            },
            "hydrology": {
              "cells": 2400,
              "edges": 7201,
              "ethnicGroupCount": 0,
              "hash": "36920e5cb4ae7bdd",
              "lakeCells": 74,
              "landCells": 873,
              "nationCount": 0,
              "riverCells": 0,
              "totalPopulation": 0,
              "vertices": 4802,
            },
            "mesh": {
              "cells": 2400,
              "edges": 7201,
              "ethnicGroupCount": 0,
              "hash": "9ebc9764cf29bd5f",
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
              "hash": "5f5a83e8ca3053c6",
              "lakeCells": 74,
              "landCells": 873,
              "nationCount": 0,
              "riverCells": 0,
              "totalPopulation": 3042292,
              "vertices": 4802,
            },
            "topography": {
              "cells": 2400,
              "edges": 7201,
              "ethnicGroupCount": 0,
              "hash": "5fbf3775fd6bd36a",
              "lakeCells": 0,
              "landCells": 912,
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
