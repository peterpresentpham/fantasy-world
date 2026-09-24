'use client';

import { Delaunay } from 'd3-delaunay';
import {
  TDelaunayMesh,
  TGenerationConfig,
  TGenerationStages,
  TMesh,
  TTerrainOverride,
} from 'src/types/global';
import { TWireStages, TWorkerRequest, TWorkerResponse } from './workerProtocol';

let worker: Worker | null = null;
let nextRequestId = 0;
const pending = new Map<
  number,
  { resolve: (stages: TGenerationStages) => void; reject: (error: Error) => void }
>();

function attachDelaunay(mesh: TMesh, delaunay: Delaunay<[number, number]>): TDelaunayMesh {
  return { ...mesh, delaunay };
}

function toGenerationStages(stages: TWireStages): TGenerationStages {
  // Cell sites are identical across all five stages (only set once in the
  // mesh stage and carried through unchanged) — one Delaunay index covers
  // all of them, matching the shared reference the synchronous pipeline
  // already produced.
  const delaunay = Delaunay.from(stages.mesh.cells.map((cell) => cell.site));
  return {
    mesh: attachDelaunay(stages.mesh, delaunay),
    topography: attachDelaunay(stages.topography, delaunay),
    hydrology: attachDelaunay(stages.hydrology, delaunay),
    population: attachDelaunay(stages.population, delaunay),
    geopolitics: attachDelaunay(stages.geopolitics, delaunay),
  };
}

function getWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(new URL('./mapGenerator.worker.ts', import.meta.url));
  worker.onmessage = (event: MessageEvent<TWorkerResponse>) => {
    const response = event.data;
    const entry = pending.get(response.requestId);
    if (!entry) return;
    pending.delete(response.requestId);

    if (!response.ok) {
      entry.reject(new Error(response.error));
      return;
    }
    entry.resolve(toGenerationStages(response.stages));
  };
  worker.onerror = (event: ErrorEvent) => {
    const error = new Error(event.message || 'Map generation worker crashed');
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
  };

  return worker;
}

/**
 * Runs the full generation pipeline off the main thread. Resolves with the
 * same shape MapGenerator.generate() returns synchronously, with a fresh
 * Delaunay index rebuilt from the transferred cell sites (Delaunay instances
 * aren't structured-cloneable).
 */
export function generateInWorker(
  config: TGenerationConfig,
  terrainOverrides: Record<number, TTerrainOverride> = {}
): Promise<TGenerationStages> {
  return new Promise((resolve, reject) => {
    const requestId = nextRequestId;
    nextRequestId += 1;
    pending.set(requestId, { resolve, reject });

    const request: TWorkerRequest = { requestId, config, terrainOverrides };
    getWorker().postMessage(request);
  });
}
