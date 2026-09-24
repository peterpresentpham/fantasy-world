import { TGenerationConfig, TMesh, TTerrainOverride } from 'src/types/global';

export type TWireStages = {
  mesh: TMesh;
  topography: TMesh;
  hydrology: TMesh;
  population: TMesh;
  geopolitics: TMesh;
};

export type TWorkerRequest = {
  requestId: number;
  config: TGenerationConfig;
  terrainOverrides: Record<number, TTerrainOverride>;
};

export type TWorkerResponse =
  | { requestId: number; ok: true; stages: TWireStages }
  | { requestId: number; ok: false; error: string };
