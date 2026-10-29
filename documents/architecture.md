# Architecture

## Layout

| Path                          | Role                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `app/`                        | Routing and metadata only; `page.tsx` renders a view                                                                          |
| `src/views/HomeView/`         | The single page: map canvas, 3D view, layout                                                                                  |
| `src/components/`             | UI: `MapToolbar`, `AdvancedSettings`, `CellDetailPanel`, `MapViewControls`, `IntroHero`, `GenerationProgress`, `ui/` (shadcn) |
| `src/services/`               | All domain logic, grouped by domain (below)                                                                                   |
| `src/configs/`                | Constants and tuning values                                                                                                   |
| `src/store/`, `src/contexts/` | Zustand stores and the map context                                                                                            |
| `src/hooks/`                  | React hooks (canvas, overlay, viewport, hotkeys, 3D)                                                                          |
| `src/types/`                  | Shared types, all prefixed `T`                                                                                                |
| `e2e/`                        | Playwright tests                                                                                                              |

`src/services/`: `terrain/` (mesh, elevation, landforms, biomes), `hydrology/` (climate, rivers, lakes), `geopolitics/` (population, nations, provinces, ethnic, capitals), `pipeline/` (orchestrator, worker, cache), `rendering/` (canvas, 3D geometry), `logistics/` (routing), `utils/` (math, graph, geometry, viewport, hotkeys).

## Generation pipeline

`MapGenerator.generate(overrides, onStage?)` in `services/pipeline/MapGenerator.ts` runs five stages. Each stage takes the previous stage's `TDelaunayMesh` and returns a new one.

1. **Mesh** (`terrain/mesh.ts`)
2. **Topography** (`terrain/buildTopography.ts`)
3. **Hydrology** (`hydrology/index.ts`)
4. **Population** (`geopolitics/population.ts`)
5. **Geopolitics** (`geopolitics/index.ts`)

`onStage` reports the stage that is starting; the UI shows it in `GenerationProgress`.

### Determinism

All randomness goes through `createSeededRandom(seed)` (`services/utils/math.ts`, FNV-1a hash plus LCG). Never call `Math.random()` in generation code. Loops and sort comparators have fixed tie-breaks, so the same seed and config give an identical world.

### Worker and cache

- Generation runs in a Web Worker: `mapGenerator.worker.ts`, spoken to through `generationClient.ts` and the message types in `workerProtocol.ts`. The worker posts stage progress and the result. `d3-delaunay` objects cannot be cloned, so the main thread rebuilds them from the returned points.
- `CacheManager` caches results and intermediate stages, so changing only the nation count does not re-run terrain and hydrology. The generator reuses the last mesh when seed and size are unchanged.
- `createGeneratorState()` gives tests their own cache.

### Terrain painting

`paintTerrain()` in `map.context.tsx` changes cell elevation and landform directly (logic in `terrain/paint.ts` and `terrainPainter.ts`). Painted overrides are injected into the next generation so hydrology and climate react to them, and are lost when the seed changes.

## State

| Store                                      | Holds                                                                                    | Persisted       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- | --------------- |
| `mapExplorerStore`                         | Generation config, display settings, hover cell                                          | yes (versioned) |
| `uiStore`                                  | Advanced-settings tab, detail panel selection, toolbar position and collapse, intro flag | partly          |
| `viewportStore`                            | Zoom and pan, frame size                                                                 | no              |
| `generationStore`                          | Current generation stage                                                                 | no              |
| `terrainEditorStore`, `logisticsGameStore` | Paint tool, route tool                                                                   | no              |

Use `useShallow` or single-field selectors. Persisted stores bump `version` and migrate when the shape changes.

## Rendering

- **2D**: two stacked canvases, `#map-base-canvas` (terrain and layers, drawn by `rendering/canvas/` from `useMapCanvas`) and an overlay for hover and the selected region (`useMapOverlay`). Layers are toggled by `displaySettings`; borders are drawn in one pass.
- **Zoom and pan**: a CSS `translate` and `scale` on the layer that holds both canvases (`MapCanvasStage`), math in `services/utils/viewport.ts`, input in `useMapViewport`. Hit testing uses `getBoundingClientRect`, so it stays correct under the transform. Zoom does not redraw the bitmap, so it is blurry at high zoom.
- **Isometric and 3D**: isometric is a projection of the same cells; 3D (`ThreeMapView`, loaded with `next/dynamic`) builds one merged vertex-coloured mesh in `rendering/threeTerrain.ts`.
- **Hover**: pointer moves are coalesced to one lookup per animation frame with `delaunay.find(x, y)`.

## UI

- `MapToolbar` is a floating, draggable, collapsible bar: seed, topography, view presets (`configs/map/viewPresets.ts`), layers, 2D/Iso/3D, edit terrain, advanced settings.
- `AdvancedSettings` expands under the toolbar with seven tabs: Generation, Display, Nations, Ethnic, Edit Terrain, Export, Palette.
- `CellDetailPanel` is a side panel (a drawer below 1024px) showing nation or ethnic statistics. Its layout uses container queries so it follows the panel width.
- Shortcuts are defined in `services/utils/hotkeys.ts` and wired by `useMapHotkeys`.
- Colours come from theme tokens in `src/styles/globals.css`; avoid raw Tailwind palette colours.

## Tests

- `vitest`: unit tests next to the code, plus `pipelineInvariants.test.ts` (properties every generated world must satisfy; `FANTASY_TEST_PROFILE=full` sweeps seeds and presets) and `pipeline/stages.test.ts`.
- `playwright` (`e2e/`): runs against a production build, desktop and mobile projects.
- CI (`.github/workflows/ci.yml`) runs only `npm run test:unit` (the pure unit tests under `src/services/utils`). Typecheck, lint, build, generation snapshots and e2e are run locally.
- Per the project rules, tests are run only after the maintainer agrees.
