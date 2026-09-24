import { TDelaunayMesh, TGenerationStages, TMesh } from 'src/types/global';
import { MapGenerator } from './MapGenerator';
import { TWireStages, TWorkerRequest, TWorkerResponse } from './workerProtocol';

// `self` under this project's `dom`-only tsconfig lib resolves to `Window`,
// whose `postMessage` requires a `targetOrigin`. `Worker` describes the same
// global scope's message API with the single-argument overload we want, and
// is already available under `dom` lib — casting through it avoids adding
// (and conflicting with) the `webworker` lib.
const ctx = self as unknown as Worker;

function stripDelaunay(mesh: TDelaunayMesh): TMesh {
  const { width, height, cells, edges, vertices, nations, ethnics, rivers } = mesh;
  return { width, height, cells, edges, vertices, nations, ethnics, rivers };
}

function toWireStages(stages: TGenerationStages): TWireStages {
  return {
    mesh: stripDelaunay(stages.mesh),
    topography: stripDelaunay(stages.topography),
    hydrology: stripDelaunay(stages.hydrology),
    population: stripDelaunay(stages.population),
    geopolitics: stripDelaunay(stages.geopolitics),
  };
}

ctx.onmessage = (event: MessageEvent<TWorkerRequest>) => {
  const { requestId, config, terrainOverrides } = event.data;

  try {
    const generator = new MapGenerator(config);
    const stages = generator.generate(terrainOverrides);
    const response: TWorkerResponse = { requestId, ok: true, stages: toWireStages(stages) };
    ctx.postMessage(response);
  } catch (error) {
    const response: TWorkerResponse = {
      requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    ctx.postMessage(response);
  }
};
