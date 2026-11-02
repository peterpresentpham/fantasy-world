# Roadmap

## Done

- **Codebase**: shared types in `src/types/`, oversized geopolitics and hydrology files split into folders, generation in a Web Worker with staged caching, merged 3D geometry, `next/dynamic` for Three.js, loading and error boundaries, accessible dialogs and tabs, Zustand selectors, hover throttling, unit and invariant tests, CI.
- **UI overhaul**: theme tokens, floating toolbar (draggable, collapsible, view presets), staged generation progress, first-visit intro, zoom and pan with minimap, side detail panel with highlighted region, compact tooltip, keyboard shortcuts, advanced settings docked under the toolbar, responsive detail panel.
- **Hydrology fixes (stage A)**: priority-flood depression filling, rivers that end at the sea, a lake or a confluence (no more invented paths to the sea), Strahler stream order, lakes only in low basins, drained lakes take the surrounding biome, rain no longer depends on river flow, biomes see an approximate river mask.

- **Tectonics (stage B, core)**: true distance to plate boundaries (`boundaryField.ts`), mountain belts on convergent boundaries, trenches, rifts and ridges, per-preset tectonic scale, the Archipelago preset now makes separate islands. The share of high ground that sits on a convergent boundary rose from 22% to 62%.
- **Climate and biomes (stage C)**: wind sign fixed in the southern half, advected moisture feeds base rainfall, rain shadow travels downwind, temperature spreads further from the mean far inland, biomes come from a Whittaker-style lookup (temperature zone, then aridity) with a wetland rule, and the default climate sliders are neutral (offset 0, contrast 1, rain scale 1.3, offset 0.12). A default 15000-cell map now has tropical and temperate forest, savanna, steppe, desert, boreal forest, tundra and ice. Still open: river count dropped after stage A, so `minFluxToFormRiver` can be retuned; deserts are still few.

## Realism fixes still to do

Found by reading the code and comparing it with Red Blob Games' polygon map generation, Azgaar's Fantasy Map Generator and plate-tectonics terrain papers. Order of work: finish B and D.

### B. Terrain from plate tectonics (partly done)

- Done: sea level now follows a target land share per preset (see world-generation.md), and volcanic hotspots sit inside plates.
- Tried and dropped: starting the presets' range bands on convergent plate boundaries and running them along the local boundary direction. Measured over 6 seeds per preset it did not make mountain clusters any more elongated (average axis ratio 2.1–2.5 both ways) and it added 20–40% more mountain cells on top of the tectonic belts, so the plain random bands stay. Mountains were already about 80% on or near convergent boundaries.
- Done: a continental shelf, slope and basin by distance from land, and one Lloyd relaxation pass. The forced low map border was measured (only about 0.5% of cells are land in the outer 3% band) and left as it is.

### D. Settlement and politics (partly done)

- Done: nation population and economy multipliers are now narrow (0.85–1.15 and 0.8–1.25), and the capital is always the best interior cell by population, economy and water access (it may sit on a coast or river). 72% of capitals are now in the top tenth of their nation's cells by population, up from 42%.
- Rivers already shape borders: river cells are 2% of land but 13% of border edges.
- Done: peoples now scale with land (about one per 1300 cells, at least 1.5 per nation, tiny islands take the nearest people) and the forced 54–58% majority is gone. On a default map that is about 13 peoples for 10 nations (it was about 40).
- Done: peoples are now generated before nations (geography only), and nation borders pay an extra cost to leave a people, so 37% of nation-border edges are also people borders (11% without it). The cross-border patching steps and the 45% floor are gone.
- Done: nation seeds lean towards settled land. The share of nations containing one of the biggest cities went from 53% to 70% (12 maps).
- Done: territorial waters (a nation's sea within 0.028 of the diagonal of its coast), internal waters for lakes, and international waters beyond.
- Done: city sites get a bonus for a harbour, a river, a river mouth and a confluence (`citySiteBonus` in the population stage), nation seeds get a bonus on cities, and the capital is the nation's main city (96% of capitals in the main city or next to it, up from 54%). Among the 5 biggest cities of each map, 30% are on the coast (21% of land cells are) and 47% by a river (7% of land cells are). Confluences never showed up: rivers are too short to have two tributaries meeting at a cell.
- Done: no border through a city. `keepCitiesWhole` gives the land within two steps of each city to the city's nation; big cities within two cells of a border went from 21% to 15% (12 maps), and cities of at least 12% of the biggest one from 16% to 10%.
- Still to do: nations lean towards cities but are not built from a fixed list of them.

## Other open items

- `runMapGeneration.test.ts` snapshots were re-baselined after stages B, C and D; re-baseline again (`vitest -u`) after any generation change.
- Performance: `selectNationSeeds` rescans land cells per seed; `renderLandCells` makes several passes over the cells.
- A few `react-hooks/exhaustive-deps` suppressions remain.
- UI phases not started: parchment theme and map frame (compass, fade-in, reduced motion), and mobile bottom sheets with a mobile toolbar.
- Large hooks (`useNationMiniMap`, `useEthnicMiniMap`, `useThreeMap`) could move their pure computation into `services/`.

## Working rules

Generation changes must stay deterministic. Add invariant tests for each fix (for example: every river reaches water, lakes sit below a height cap, mountains lie near convergent boundaries, each nation has a city). Compare the same seed before and after across presets. Tests run only after the maintainer agrees.

- Done: parchment theme. A light warm-paper set of the same colour tokens (`:root[data-theme='parchment']` in `globals.css`), a toggle in the toolbar and the phone tools sheet (`ThemeToggle`), stored in `uiStore.theme`. The map colours do not change. A small inline script in `app/layout.tsx` sets the saved theme before the first paint.

- Done (small items): rivers thinner than 0.6 are hidden until zoom 1.5 (`MINOR_RIVER_ZOOM`, redrawn only when the zoom crosses it); small islands need less flow to start a river (`RIVER_CONFIG.island`), so archipelago river cover went from 0.5% to about 1.9% of land (balanced is 1.8–2.1%); picking a nation in the summary zooms to it (`useFocusNation`, `getNationFocus`); `T` toggles route mode; on a phone the map controls and legend rise above the detail sheet while it shows only its header and hide while it is expanded; CI now also runs `typecheck` and `eslint`; Playwright's default timeout is 60 s and `E2E_SKIP_BUILD=1` reuses the existing build.
- Checked, no change: total population is 5–8 million on a default 8000-cell map (about 2000 people per land cell). It looks plausible and no earlier number is recorded to compare against, so the suspected 6× jump could not be confirmed.
- Not done: the legend is not part of the phone tools sheet (it stays a small folded card on the map); stream order stays 1 almost everywhere because rivers are short, so it is not used for drawing.
- Fixed: the same seed could give two different worlds on reload (about 1 time in 3 in Chrome). `diversifySmallNationSizes` shuffled with `sort(() => random() - 0.5)`, an invalid comparator whose result differed between the interpreter and Chrome's Maglev JIT (Node never showed it). It now uses `shuffleSeeded` (Fisher-Yates). Found with the flaky `seed survives a reload` e2e test, then narrowed by running the bundled generator in Chromium with and without `--no-maglev` and comparing each step; 24 parallel runs now agree. Link-shared worlds change once more.
