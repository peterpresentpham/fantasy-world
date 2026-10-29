import {
  TDelaunayMesh,
  TGenerationConfig,
  TGenerationStage,
  TGenerationStages,
  TTerrainOverride,
} from 'src/types/global';
import { buildGeopolitics } from 'src/services/geopolitics';
import { buildPopulation } from 'src/services/geopolitics/population';
import { buildHydrology } from 'src/services/hydrology';
import { buildTopography } from 'src/services/terrain/buildTopography';
import { buildMesh } from 'src/services/terrain/mesh';
import { inferBiomeForLandform } from 'src/services/terrain/terrainPainter';
import { CacheManager } from './CacheManager';

// Reuse state across generations: result/stage cache plus the last built mesh.
// Callers may pass their own instance (e.g. tests) to avoid sharing it.
export type TGeneratorState = {
  cache: CacheManager;
  lastMesh: { key: string; mesh: TDelaunayMesh } | null;
};

export function createGeneratorState(): TGeneratorState {
  return { cache: new CacheManager({ maxResults: 5 }), lastMesh: null };
}

const defaultState = createGeneratorState();

// Inject elevation overrides into topography cells so hydrology (rivers, climate)
// computes correctly based on painted terrain.
function injectElevationOverrides(
  mesh: TDelaunayMesh,
  overrides: Record<number, TTerrainOverride>
): TDelaunayMesh {
  const cells = mesh.cells.map((cell, i) => {
    const ov = overrides[i];
    if (!ov) return cell;
    return { ...cell, elevation: ov.elevation, isWater: ov.isWater };
  });
  return { ...mesh, cells };
}

// Re-apply landform and biome overrides after hydrology re-classifies them.
// Also re-applies elevation so erosion doesn't alter painted mountains/coasts.
function applyLandformOverrides(
  mesh: TDelaunayMesh,
  overrides: Record<number, TTerrainOverride>
): TDelaunayMesh {
  const cells = [...mesh.cells];
  for (const [cellIdStr, ov] of Object.entries(overrides)) {
    const id = Number(cellIdStr);
    const cell = cells[id];
    if (!cell) continue;
    cells[id] = {
      ...cell,
      elevation: ov.elevation,
      isWater: ov.isWater,
      landform: ov.landform,
      biome: inferBiomeForLandform(ov.landform, cell.temperature, cell.precipitation, cell.biome),
    };
  }
  return { ...mesh, cells };
}

export class MapGenerator {
  private readonly config: TGenerationConfig;
  private readonly forceRefresh: boolean;
  private readonly state: TGeneratorState;

  constructor(config: TGenerationConfig, forceRefresh = false, state = defaultState) {
    this.config = config;
    this.forceRefresh = forceRefresh;
    this.state = state;
  }

  /** `onStage` fires as each pipeline stage starts, including stages served from the cache. */
  generate(
    terrainOverrides: Record<number, TTerrainOverride> = {},
    onStage?: (stage: TGenerationStage) => void
  ): TGenerationStages {
    const hasOverrides = Object.keys(terrainOverrides).length > 0;
    const { cache } = this.state;

    // Full-result cache only when there are no terrain overrides
    if (!this.forceRefresh && !hasOverrides) {
      const cached = cache.get(this.config);
      if (cached) return cached;
    }

    const {
      width,
      height,
      seed,
      cellCount,
      seaLevel,
      topography: topographyPreset,
      climateControl,
      nationCount,
    } = this.config;

    const configKey = [seed, width, height, cellCount].join('|');

    onStage?.('mesh');
    let mesh: TDelaunayMesh;
    if (
      !this.forceRefresh &&
      this.state.lastMesh !== null &&
      this.state.lastMesh.key === configKey
    ) {
      mesh = this.state.lastMesh.mesh;
    } else {
      const newMesh = buildMesh({ width, height, seed, cellCount });
      mesh = newMesh;
      this.state.lastMesh = { key: configKey, mesh: newMesh };
    }

    // Topography only depends on mesh + seaLevel + topography preset, so it
    // can be reused across changes to nationCount/climateControl.
    onStage?.('topography');
    const cachedTopography =
      !this.forceRefresh && !hasOverrides ? cache.getTopography(this.config) : null;
    let topography: TDelaunayMesh;
    if (cachedTopography) {
      topography = cachedTopography.topography;
    } else {
      topography = buildTopography({ mesh, seed, seaLevel, topography: topographyPreset });
      if (!hasOverrides) cache.setTopography(this.config, { topography });
    }

    // Phase 1: inject painted elevations so river/climate generation uses them
    const topoForHydrology = hasOverrides
      ? injectElevationOverrides(topography, terrainOverrides)
      : topography;

    // Hydrology + population additionally depend on climateControl, so they
    // can be reused across changes to nationCount alone — the only stage
    // left that varies with it is geopolitics, below.
    onStage?.('hydrology');
    const cachedPostPopulation =
      !this.forceRefresh && !hasOverrides ? cache.getPostPopulation(this.config) : null;
    let hydrology: TDelaunayMesh;
    let population: TDelaunayMesh;
    if (cachedPostPopulation) {
      hydrology = cachedPostPopulation.hydrology;
      population = cachedPostPopulation.population;
    } else {
      hydrology = buildHydrology({ mesh: topoForHydrology, seaLevel, seed, climateControl });

      // Phase 2: re-apply landform labels after hydrology re-classifies them
      const hydrologyForPop = hasOverrides
        ? applyLandformOverrides(hydrology, terrainOverrides)
        : hydrology;

      onStage?.('population');
      population = buildPopulation({ mesh: hydrologyForPop, seed });
      if (!hasOverrides) cache.setPostPopulation(this.config, { hydrology, population });
    }

    onStage?.('geopolitics');
    const geopolitics = buildGeopolitics({ mesh: population, seed, nationCount });

    const result: TGenerationStages = {
      mesh,
      topography,
      hydrology,
      population,
      geopolitics,
    };

    if (!hasOverrides) {
      cache.set(this.config, result);
    }

    return result;
  }

  getConfig(): TGenerationConfig {
    return this.config;
  }
}
