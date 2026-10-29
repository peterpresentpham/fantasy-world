# World generation

Stage-by-stage description of the current algorithms. File paths are under `src/services/`; constants are in `src/configs/map/`. Rivers and lakes have their own page: [hydrology.md](./hydrology.md); political stages: [geopolitics.md](./geopolitics.md).

## 1. Mesh (`terrain/mesh.ts`)

- Points come from a jittered grid (`genPoints`): `columns = ceil(sqrt(N·w/h))`, each point moved by up to ±36% of the grid spacing.
- `d3-delaunay` builds the Delaunay triangulation and Voronoi diagram. Vertices and edges are de-duplicated by coordinate; neighbours come from the Delaunay graph.
- There is no Lloyd relaxation, so cells are only mildly irregular.
- Defaults (`configs/map/common.ts`): 1200×760, 15000 cells, allowed range 4000–15000.

## 2. Topography (`terrain/`)

`buildTopography.ts` runs, in order: plates → base elevation → preset shaping → high-mountain reinforcement → hydraulic erosion → water test (`elevation < seaLevel`).

- **Plates** (`tectonics.ts`): 4–7 plates, each with a random centre, a 60% chance of being continental and a random velocity. Cells join the nearest centre. Boundary cells are classified convergent, divergent or transform from the relative velocity along the line to the neighbouring plate.
- **Base elevation** (`computeElevation.ts`): a weighted blend of domain-warped simplex noise (fBm, ridged, billow, an erosion mask, coastal noise), random uplift and basin blobs, tectonic uplift and rifts, an isostasy term (`isostasy.ts`) and a continental shelf. The result is clamped to 0–1.
- **Presets** (`preset.ts`, `shape.ts`, `configs/map/topography.ts`) add features on top: `balanced`, `ranges` (range chains), `rifted` (escarpments and plateaus), `archipelago` (replaces the elevation with island blobs), `volcanic` (hotspots and calderas), `continental` (flat-topped plateaus).
- **Mountain reinforcement**: the top 14% of land is boosted quadratically.
- **Erosion** (`erosion.ts`): one stream-power pass (`E = K·√A·S`), capped per cell, with simple deposition.
- **Sea level** is a fixed threshold (default 0.5), so the land fraction varies with seed and preset.

### Landforms (`terrain/landformClassifier.ts`, run during hydrology)

Each land cell scores every candidate from elevation above sea level, local relief (cell minus the mean of its neighbours), flow and terrain tags; the best score wins. Thresholds are in `configs/map/terrain.ts`.

`marine_deep`, `marine_shallow`, `coast`, `lake`, `plain`, `valley`, `hills`, `mountain`, `plateau`, `volcanic_field`.

## 3. Climate and biomes (`hydrology/`, `terrain/biomeClassifier.ts`)

Values are normalised to 0–1. User controls (`climateControl`: temperature offset and contrast, precipitation scale and offset, human impact) are applied to the computed fields.

- **Temperature** (`temperature.ts`): latitude cooling (symmetric about the map's mid-height), a lapse rate that falls with rainfall, ocean moderation, lee-side warming and windward cooling, small cold-pooling and a global seasonal offset, then one smoothing pass.
- **Wind** (`wind.ts`): three belts by latitude — trades, westerlies, polar easterlies — each with a per-cell direction and noise.
- **Water influence** (`climate.ts`): a blurred water mask that decides how maritime a cell is.
- **Precipitation** (`precipitation.ts`): base rain from water influence plus a latitude band curve (wet near the equator and mid-latitudes, dry in the subtropics), elevation and mountain bonuses, minus rain shadow. Moisture is advected along the wind for several iterations; windward slopes lift it into clouds and rain, leeward slopes dry it.
- **Aridity**: precipitation divided by a potential-evapotranspiration proxy from temperature and openness.
- **Biomes** (`biomeClassifier.ts`): each land cell scores ten hand-weighted candidates from temperature, precipitation, aridity, seasonality and latitude; mountains are special-cased by temperature; a clean-up pass removes desert speckle and a human-settlement pass turns suitable cells into `plain`.

Biomes: `plain`, `ice`, `tundra`, `boreal_forest`, `temperate_forest`, `tropical_forest`, `grassland`, `savanna`, `steppe`, `desert_hot`, `desert_cold`, `wetland`, `montane_shrub`, `freshwater`, `marine` (and `unknown`).

## 4. Population (`geopolitics/population.ts`)

- Per-cell score = biome population factor × climate fitness × water access × landform settlement boost × noise, scaled by cell suitability.
- Climate fitness is two tent curves around an ideal temperature and precipitation.
- Water access decays with distance from the sea (BFS hops) and adds bonuses for river and lake cells and for river corridors.
- 4–18 city centres (by land size) are the highest-scoring cells kept apart; each adds a radial boost. Two smoothing passes follow, then caps for ice, tundra, mountain and desert.
- Final population = density^1.08 × a scale × a biome carrying capacity; economy grows faster than population and gets terrain, water and coast bonuses.
- Population is computed once, before nations exist.
