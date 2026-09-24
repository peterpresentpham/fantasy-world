import { TDelaunayMesh, TGenerationConfig, TGenerationStages } from 'src/types/global';

// ─── Config ────────────────────────────────────────────────────────────────────

interface TCacheOptions {
  /** Maximum number of complete generation results cached */
  maxResults: number;
  /** Whether to enable stage-level caching (mesh → cache → reuse for same config) */
  enableStageCaching: boolean;
}

const DEFAULT_CACHE_OPTIONS: TCacheOptions = {
  maxResults: 5,
  enableStageCaching: true,
};

// ─── Cache Keys ────────────────────────────────────────────────────────────────
// Each key below is a prefix of the next, matching the pipeline's actual data
// dependencies (mesh -> topography -> hydrology+population -> geopolitics),
// so a config change only invalidates the stages that actually depend on it —
// e.g. changing nationCount alone only recomputes geopolitics.

/**
 * Deterministic fingerprint of a TGenerationConfig.
 * Ensures that two identical configs always produce the same key.
 */
function hashConfig(config: TGenerationConfig): string {
  const parts: string[] = [
    config.seed,
    String(config.width),
    String(config.height),
    String(config.cellCount),
    String(config.seaLevel),
    config.topography,
    String(config.nationCount),
    String(config.climateControl.temperatureOffset.toFixed(6)),
    String(config.climateControl.temperatureContrast.toFixed(6)),
    String(config.climateControl.precipitationScale.toFixed(6)),
    String(config.climateControl.precipitationOffset.toFixed(6)),
    String(config.climateControl.humanImpact.toFixed(6)),
  ];
  return parts.join('|');
}

/** Everything buildTopography's result depends on. */
function hashTopographyStage(config: TGenerationConfig): string {
  return [
    config.seed,
    String(config.width),
    String(config.height),
    String(config.cellCount),
    String(config.seaLevel),
    config.topography,
  ].join('|');
}

/** Everything buildHydrology + buildPopulation's results depend on. */
function hashPostPopulationStage(config: TGenerationConfig): string {
  const climate = config.climateControl;
  return [
    hashTopographyStage(config),
    String(climate.temperatureOffset.toFixed(6)),
    String(climate.temperatureContrast.toFixed(6)),
    String(climate.precipitationScale.toFixed(6)),
    String(climate.precipitationOffset.toFixed(6)),
    String(climate.humanImpact.toFixed(6)),
  ].join('|');
}

// ─── Generic LRU Map ───────────────────────────────────────────────────────────

class LruMap<TValue> {
  private readonly entries = new Map<string, { value: TValue; lastAccess: number }>();

  constructor(private readonly maxSize: number) {}

  get(key: string): TValue | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    entry.lastAccess = Date.now();
    return entry.value;
  }

  set(key: string, value: TValue): void {
    const existing = this.entries.get(key);
    if (existing) {
      existing.value = value;
      existing.lastAccess = Date.now();
      return;
    }

    if (this.entries.size >= this.maxSize) {
      let oldestKey: string | null = null;
      let oldestTimestamp = Infinity;
      for (const [entryKey, entry] of this.entries) {
        if (entry.lastAccess < oldestTimestamp) {
          oldestTimestamp = entry.lastAccess;
          oldestKey = entryKey;
        }
      }
      if (oldestKey) this.entries.delete(oldestKey);
    }

    this.entries.set(key, { value, lastAccess: Date.now() });
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }

  keys(): string[] {
    return Array.from(this.entries.keys());
  }
}

// ─── CacheManager ──────────────────────────────────────────────────────────────

type TTopographyCacheEntry = { topography: TDelaunayMesh };
type TPostPopulationCacheEntry = { hydrology: TDelaunayMesh; population: TDelaunayMesh };

/**
 * Manages generation result cache with LRU eviction, at three granularities:
 *
 * - Full result (get/set) — the whole config is unchanged (display-only tweaks).
 * - Topography stage — seed/dimensions/cellCount/seaLevel/topography preset
 *   unchanged, so mesh + topography can be reused.
 * - Post-population stage — the above plus climateControl unchanged, so
 *   hydrology + population can be reused (only geopolitics, which is the
 *   only stage depending on nationCount, needs recomputing).
 */
export class CacheManager {
  private readonly cache: LruMap<TGenerationStages>;
  private readonly topographyCache: LruMap<TTopographyCacheEntry>;
  private readonly postPopulationCache: LruMap<TPostPopulationCacheEntry>;
  private readonly options: TCacheOptions;

  constructor(options?: Partial<TCacheOptions>) {
    this.options = { ...DEFAULT_CACHE_OPTIONS, ...options };
    this.cache = new LruMap(this.options.maxResults);
    this.topographyCache = new LruMap(this.options.maxResults);
    this.postPopulationCache = new LruMap(this.options.maxResults);
  }

  /**
   * Get cached result by config key.
   * Updates LRU timestamp on access.
   */
  get(config: TGenerationConfig): TGenerationStages | null {
    if (!this.options.enableStageCaching) return null;
    return this.cache.get(hashConfig(config));
  }

  /**
   * Store a generation result in cache.
   * Evicts oldest entry if at capacity.
   */
  set(config: TGenerationConfig, result: TGenerationStages): void {
    if (!this.options.enableStageCaching) return;
    this.cache.set(hashConfig(config), result);
  }

  /**
   * Check if a specific config is cached.
   */
  has(config: TGenerationConfig): boolean {
    if (!this.options.enableStageCaching) return false;
    return this.cache.has(hashConfig(config));
  }

  getTopography(config: TGenerationConfig): TTopographyCacheEntry | null {
    if (!this.options.enableStageCaching) return null;
    return this.topographyCache.get(hashTopographyStage(config));
  }

  setTopography(config: TGenerationConfig, entry: TTopographyCacheEntry): void {
    if (!this.options.enableStageCaching) return;
    this.topographyCache.set(hashTopographyStage(config), entry);
  }

  getPostPopulation(config: TGenerationConfig): TPostPopulationCacheEntry | null {
    if (!this.options.enableStageCaching) return null;
    return this.postPopulationCache.get(hashPostPopulationStage(config));
  }

  setPostPopulation(config: TGenerationConfig, entry: TPostPopulationCacheEntry): void {
    if (!this.options.enableStageCaching) return;
    this.postPopulationCache.set(hashPostPopulationStage(config), entry);
  }

  /**
   * Clear all cached results, at every granularity.
   */
  clear(): void {
    this.cache.clear();
    this.topographyCache.clear();
    this.postPopulationCache.clear();
  }

  /**
   * Number of cached full-result entries.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Return cache statistics for debugging.
   */
  stats(): { size: number; maxResults: number; keys: string[] } {
    return {
      size: this.cache.size,
      maxResults: this.options.maxResults,
      keys: this.cache.keys(),
    };
  }
}
