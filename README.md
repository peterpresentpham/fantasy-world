# Fantasy World

**Fantasy World** is a deterministic procedural world-map generator. Given a seed string, it generates a complete synthetic world — from terrain elevation and river networks to nations, provinces, ethnic regions, capitals, and economic hubs — all deterministically repeatable.

Built with **Next.js 16 (App Router)**, **React 19**, **TypeScript (strict)**, and **Canvas HTML5 rendering**.

Production URL: [https://fantasy.peter-present.xyz/](https://fantasy.peter-present.xyz/)

---

## 🌍 What You Can Do

- Generate repeatable worlds from a seed — same seed = same map
- Choose from **6 terrain presets**: `balanced`, `ranges`, `rifted`, `archipelago`, `volcanic`, `continental`
- Adjust sea level, temperature offset/contrast, precipitation scale/offset, human impact, nation count, cell count
- **Manual terrain painting**: select a landform type and click/drag cells to override terrain with natural noise-driven elevation
- Interactive map with toggleable layers: Landform, Biome, Population (heatmap), Temperature (heatmap), Precipitation, Rain Shadow, Economy (heatmap), Rivers, Nation borders/fill, Province borders, Ethnic borders/fill/labels, Labels, Cell data
- Hover for cell-level stats; click to open nation/ethnic detail dialogs
- Find optimal logistics routes between two points (Dijkstra)
- Export/Import world snapshots (JSON)
- 3D isometric view and Three.js 3D rendering

---

## 🏗 How World Generation Works

The pipeline runs in **5 sequential stages** via `MapGenerator` (`src/services/pipeline/MapGenerator.ts`):

### 1. Mesh

Jittered grid points → Delaunay triangulation → Voronoi diagram via **d3-delaunay**. Each cell has a site, polygon, vertices, edges, and neighbors. Configurable 4,000–15,000 cells.

### 2. Topography (`src/services/terrain/`)

- **Noise**: Multi-octave fBm, Ridged, and Billow fractals + domain warping via `simplex2D` (`noise.ts`)
- **Tectonic plates**: Voronoi plate generation → convergent/divergent/transform boundary classification → isostatic elevation baseline + uplift/rift (`tectonics.ts`, `isostasy.ts`)
- **Elevation blend**: 7-component weighted sum — macro noise, secondary noise, ridged noise, billow noise, erosion mask, tectonic uplift, coastal noise (`computeElevation.ts`)
- **Preset shaping**: range chains, valley bands, plateau clusters, island seeds, volcanic hotspots (`preset.ts`, `shape.ts`)
- **Post-processing**: high-mountain reinforcement (quadratic boost for top 14% peaks), Stream Power hydraulic erosion (`erosion.ts`)
- **6 presets**: `balanced`, `ranges`, `rifted`, `archipelago`, `volcanic`, `continental`

Elevation classified into **10 landforms** (`TLandform`):

| Landform | Description |
|---|---|
| `marine_deep` | Deep ocean |
| `marine_shallow` | Shallow waters / continental shelf |
| `coast` | Coastal land/beach zone |
| `lake` | Inland lake |
| `plain` | Flat lowlands |
| `valley` | Low-lying area between high terrain |
| `hills` | Rolling terrain |
| `mountain` | High elevation peaks |
| `plateau` | Elevated flat regions |
| `volcanic_field` | Volcanic highlands |

### 3. Hydrology (`src/services/hydrology/`)

- **Temperature**: Latitude cooling + elevation lapse rate + maritime moderation (`temperature.ts`)
- **Wind**: 3-zone global Hadley-cell circulation (trade winds, westerlies, polar easterlies) with per-cell directional field (`wind.ts`)
- **Precipitation**: Moisture advection from wind + orographic uplift + rain shadow on lee side (`precipitation.ts`)
- **Rivers**: D8 flow routing → depression filling → precipitation-weighted accumulation → named river tracing with confluence resolution + width smoothing (`river.ts`)
- **Lakes**: Elevation-sink expansion → filtered to 12 largest → inland water classification (`lakes.ts`)
- **Landform & biome classification**: Score-based competition between candidates using elevation, slope, flow, and climate signals (`landformClassifier.ts`, `biomeClassifier.ts`)

Climate outputs classified into **16 biomes** (`TBiome`):

`unknown`, `plain`, `ice`, `tundra`, `boreal_forest`, `temperate_forest`, `tropical_forest`, `grassland`, `savanna`, `steppe`, `desert_hot`, `desert_cold`, `wetland`, `montane_shrub`, `freshwater`, `marine`

### 4. Population (`src/services/geopolitics/population.ts`)

- BFS water-access scoring (ocean + river/lake distance decay)
- Climate suitability curves (ideal temperature/precipitation)
- Biome `populationFactor` + landform `humanSettlementBoost`
- Urban seed placement → radial Gaussian boost → 2-pass neighbor averaging
- Economy derived from population × landform × water access synergy

### 5. Geopolitics (`src/services/geopolitics/`)

- **Nations** (`nations.ts`): Scored seed selection → cost-based Voronoi frontier expansion → post-processing passes (terrain alignment, mountain split limits, contiguity enforcement, size diversification)
- **Provinces** (`provinces/`): Per-nation seed placement → cost expansion → population-cap enforcement → contiguity repair
- **Ethnic regions** (`ethnic.ts`): Per-landmass seeded expansion → nation dominance → mountain fragmentation → border smoothing
- **Capitals & hubs** (`capitals.ts`): Weighted by population, economy, centrality, terrain safety and flatness
- Maritime zones: territorial/international waters via BFS from coasts

---

## ✏ Manual Terrain Painting

A brush tool lets you override generated terrain without re-running the pipeline:

1. Click **"✏ Edit Terrain"** (top-left of the map)
2. Select a landform type from the picker
3. Click or drag over cells — each cell receives a noise-driven elevation appropriate for that landform

Elevation targets per landform (with fractal noise variation for naturalness):

| Landform | Strategy |
|---|---|
| `mountain` | elevation ≥ 0.90 (triggers classifier hard-override) |
| `plateau` | seaLevel + 0.48, very low noise (flat surface needed for plateau bonus) |
| `hills` | seaLevel + 0.22, ±0.05 noise (slope variation prevents plain misclassification) |
| `plain` | seaLevel + 0.10, low noise |
| `valley` | seaLevel + 0.06, works best where surrounding cells are already higher |
| `coast` | seaLevel + 0.008 |

Immediate neighbors are lightly blended (12%) to soften cliff edges. "Clear All Edits" restores original elevations. Overrides are lost on regeneration.

---

## 🗺 Visualization

Canvas-rendered with toggleable layers:

| Layer | Description |
|---|---|
| Landform | Colored by landform type + optional shaded relief |
| Biome | Colored by biome classification |
| Population | Heatmap (green → red) |
| Temperature | Heatmap (blue → red) |
| Precipitation | Blue intensity |
| Rain Shadow | Grayscale orographic effect |
| Economy | Heatmap |
| Rivers | Blue with glow, width-scaled by flow |
| Nation Borders/Fill | Per-nation color with natural wavy borders |
| Province Borders | Sub-national dashed boundaries |
| Ethnic Borders/Fill/Labels | Ethnic region coloring |
| Labels | Nation/ethnic names at centroid |
| Cell Data | Per-cell hover popup |

Also includes **isometric** mode (pseudo-3D offset projection) and **Three.js 3D** rendering with vertex-colored terrain mesh.

Dialogs: **Map Config** (settings, layers, export/import), **Nation Detail** (population, economy, ethnicity breakdown with `@visx` pie charts), **Ethnic Detail**, **Route Finder** (Dijkstra logistics game), and **Cell Hover Tooltip**.

---

## 🛠 Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | 16.2.4 | App Router, SSR |
| **React** | 19.2.4 | UI |
| **TypeScript** | ^5 | Strict mode |
| **Tailwind CSS** | ^4 | Styling |
| **Zustand** | ^5.0.12 | State management (persistent) |
| **d3-delaunay** | ^6.0.4 | Voronoi/Delaunay mesh |
| **Radix UI** | ^1.4.3 | UI primitives |
| **Lucide React** | ^1.12.0 | Icons |
| **@visx** | ^3.12.0 | Charts (pie, group) |
| **Three.js** | ^0.184.0 | 3D rendering |
| **shadcn** | ^4.6.0 | Component system |
| **Vitest** | ^4.1.5 | Testing |
| **Canvas API** | — | Map rendering |

---

## 🚀 Getting Started

```bash
yarn install
yarn dev
# Open http://localhost:3000
```

## 📜 Scripts

```bash
yarn dev          # Dev server
yarn build        # Production build
yarn start        # Production server
yarn test         # Run tests
yarn bench:map    # Benchmark map generation
yarn eslint       # Lint
yarn format       # Prettier
```

---

## 🧪 Key Design Decisions

- **Determinism**: all randomness via `createSeededRandom(seed)` (FNV-1a hash + LCG) — same seed = identical world every time; never use `Math.random()` in generation code
- **Layered pipeline**: 5 stages (Mesh → Topography → Hydrology → Population → Geopolitics), each consuming the previous stage's `TDelaunayMesh`
- **Cost-based expansion**: nations, provinces, and ethnic regions all use `runMultiSourceExpansion()` (Dijkstra-like frontier with terrain/biome/noise costs) for natural-looking boundaries
- **Score-based classification**: landforms and biomes are determined by weighted scoring across multiple candidates, not hard elevation thresholds — this produces smooth natural transitions
- **Spatial index**: `delaunay.find(x, y)` for O(log n) hover/click cell detection
- **Caching**: `CacheManager` avoids re-running identical configs; mesh-level fast path skips rebuild when seed + dimensions are unchanged
- **Unified border traversal**: `drawBordersUnified()` traverses cells once per frame for all active border types (nation, ethnic, province), avoiding triple cell scans
- **Manual terrain overrides**: `paintTerrain()` in `MapContext` mutates cell fields directly and triggers a shallow mesh re-render — no pipeline re-run needed

---

## 📝 Notes

- Generation is **client-side only** — no backend
- Config persists to `localStorage` with versioned migration (Zustand persist middleware)
- All shared types are prefixed with `T` and live in `src/types/` or `src/global.ts`
- See [CLAUDE.md](./CLAUDE.md) for coding conventions and architecture rules
- See [documents/](./documents/) for detailed implementation specs for each geopolitics subsystem
