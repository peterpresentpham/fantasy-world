# World generation

Stage-by-stage description of the current algorithms. File paths are under `src/services/`; constants are in `src/configs/map/`. Rivers and lakes have their own page: [hydrology.md](./hydrology.md); political stages: [geopolitics.md](./geopolitics.md).

## 1. Mesh (`terrain/mesh.ts`)

- Points come from a jittered grid (`genPoints`): `columns = ceil(sqrt(N·w/h))`, each point moved by up to ±36% of the grid spacing.
- `d3-delaunay` builds the Delaunay triangulation and Voronoi diagram. Vertices and edges are de-duplicated by coordinate; neighbours come from the Delaunay graph.
- One Lloyd relaxation pass (`MESH_RELAXATION`, 70% of the way to each cell's centroid) evens out cell sizes: the spread of cell areas drops from 0.19 to 0.14 (coefficient of variation) while the mesh stays slightly irregular.
- Defaults (`configs/map/common.ts`): 1200×760, 15000 cells, allowed range 4000–15000.

## 2. Topography (`terrain/`)

`buildTopography.ts` runs, in order: plates → base elevation → preset shaping → high-mountain reinforcement → hydraulic erosion → water test (`elevation < seaLevel`).

- **Plates** (`tectonics.ts`): 4–7 plates, each with a random centre, a 60% chance of being continental and a random velocity. Cells join the nearest centre. Boundary cells are classified convergent, divergent or transform from the relative velocity along the line to the neighbouring plate.
- **Base elevation** (`computeElevation.ts`): a weighted blend of domain-warped simplex noise (fBm, ridged, billow, an erosion mask, coastal noise), random uplift and basin blobs, tectonic uplift and rifts, an isostasy term (`isostasy.ts`) and a continental shelf. The result is clamped to 0–1. Plate boundaries are found by a breadth-first search over the mesh (`boundaryField.ts`), so every cell knows its real distance to the nearest boundary and the boundary's kind. Convergent boundaries raise mountain belts (wider and higher where two continental plates meet, with a trench on the oceanic side of a subduction zone), continental divergent boundaries open rifts and oceanic ones raise a low ridge. `TECTONIC_PRESET_SCALE` lets each preset lean more or less on uplift and rifting.
- **Presets** (`preset.ts`, `shape.ts`, `configs/map/topography.ts`) add features on top: `balanced`, `ranges` (range chains), `rifted` (escarpments and plateaus), `archipelago` (replaces the elevation with island blobs), `volcanic` (hotspots and calderas), `continental` (flat-topped plateaus).
- **Mountain reinforcement**: the top 14% of land is boosted quadratically.
- **Erosion** (`erosion.ts`): one stream-power pass (`E = K·√A·S`), capped per cell, with simple deposition.
- **Sea level** (`seaLevel.ts`) keeps 0.5 as the shoreline height for everything downstream, but the generator re-scales elevations (order preserved) so a target share of cells is land: `LAND_FRACTION` in `configs/map/topography.ts` gives a target per preset (balanced about 38% final, continental 43%, ranges 44%, rifted 33%, archipelago 16%, volcanic 32%) and the Sea level slider adds or removes land from there. Without this the land share swung from 10% to 53% between seeds; now it stays within about 3 points of the target.
- **Sea floor** (`seaFloor.ts`, `SEA_FLOOR`): water depth follows the distance to the nearest land (a shallow shelf about 0.022 of the map diagonal wide, a slope over the next 0.04, then the basin), with 30% of the old noise kept. About 58% of the sea counts as shallow water. Water never turns into land here.
- **Hotspots** of the volcanic preset sit over plate interiors, at least 0.1 of the map diagonal from any plate boundary (`terrainGuide.ts`).

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
- **Biomes** (`biomeClassifier.ts`): mountains are special-cased by temperature (ice, tundra, montane shrub); wet flat lowlands on a big river become wetland; everything else is a Whittaker-style lookup, where temperature (with a small cooling for high ground) picks a zone from ice to hot and the aridity index (precipitation over evaporation) picks the biome inside it. A clean-up pass removes desert speckle and a human-settlement pass turns suitable cells into `plain`. Thresholds live in `BIOME_THRESHOLDS.whittaker` (`configs/map/terrain.ts`).

Biomes: `plain`, `ice`, `tundra`, `boreal_forest`, `temperate_forest`, `tropical_forest`, `grassland`, `savanna`, `steppe`, `desert_hot`, `desert_cold`, `wetland`, `montane_shrub`, `freshwater`, `marine` (and `unknown`).

## 4. Population (`geopolitics/population.ts`)

- Per-cell score = biome population factor × climate fitness × water access × landform settlement boost × noise, scaled by cell suitability.
- Climate fitness is two tent curves around an ideal temperature and precipitation.
- Water access decays with distance from the sea (BFS hops) and adds bonuses for river and lake cells and for river corridors.
- 4–18 city centres (by land size) are the highest-scoring cells kept apart; each adds a radial boost. Two smoothing passes follow, then caps for ice, tundra, mountain and desert.
- Final population = density^1.08 × a scale × a biome carrying capacity; economy grows faster than population and gets terrain, water and coast bonuses.
- Population is computed once, before nations exist.
