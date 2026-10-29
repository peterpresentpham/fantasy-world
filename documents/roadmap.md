# Roadmap

## Done

- **Codebase**: shared types in `src/types/`, oversized geopolitics and hydrology files split into folders, generation in a Web Worker with staged caching, merged 3D geometry, `next/dynamic` for Three.js, loading and error boundaries, accessible dialogs and tabs, Zustand selectors, hover throttling, unit and invariant tests, CI.
- **UI overhaul**: theme tokens, floating toolbar (draggable, collapsible, view presets), staged generation progress, first-visit intro, zoom and pan with minimap, side detail panel with highlighted region, compact tooltip, keyboard shortcuts, advanced settings docked under the toolbar, responsive detail panel.
- **Hydrology fixes (stage A)**: priority-flood depression filling, rivers that end at the sea, a lake or a confluence (no more invented paths to the sea), Strahler stream order, lakes only in low basins, drained lakes take the surrounding biome, rain no longer depends on river flow, biomes see an approximate river mask.

## Realism fixes still to do

Found by reading the code and comparing it with Red Blob Games' polygon map generation, Azgaar's Fantasy Map Generator and plate-tectonics terrain papers. Order of work: C, B, D.

### C. Climate and biomes

- On the default settings and preset, a 15000-cell map has no desert, steppe, tundra, boreal forest or ice; savanna and tropical forest cover about two thirds of the land. Measure temperature and precipitation first, and check the defaults in `configs/map/common.ts` (`climateControl`: temperature offset 0.2, contrast 1.5, precipitation offset 0.3, scale 1.5), which may push every cell warm and wet.
- The meridional wind sign looks inverted in the southern half (`wind.ts`): verify.
- Moisture advected along the wind does not feed base rainfall, so flat inland areas ignore distance from the sea; rain shadow is stored per cell and not carried downwind.
- Add continentality to temperature.
- Replace the hand-weighted biome argmax with a Whittaker-style lookup on temperature and precipitation; fix the ice threshold for high peaks.
- River count dropped about 10–35% after stage A (less rain); retune `minFluxToFormRiver` once rainfall is fixed.

### B. Terrain from plate tectonics

- Tectonic uplift is about 0.002 against noise weights near 1.0, so mountains do not follow plate boundaries. Compute the true distance to the boundary (BFS over the mesh), raise the tectonic weight, put ranges on convergent boundaries, rifts on divergent ones and hotspots inside plates; presets then only tune amounts.
- Choose sea level by land-fraction quantile instead of a fixed 0.5.
- Add a continental shelf and slope, and soften the forced low border.
- Optional, and it changes every world: 1–2 Lloyd relaxation passes.

### D. Settlement and politics

- Place cities by suitability at river mouths, confluences, coasts and plains before nations, grow nations from them, make the capital the nation's largest city and stop penalising coast and river sites.
- Derive nation population and economy from area and fertility instead of random multipliers.
- Prefer rivers and ridges as borders.
- Generate cultures from geography first, then lay nations over them; drop the forced 54–58% dominance; scale the number of ethnic groups with map size; add territorial waters.

## Other open items

- `runMapGeneration.test.ts` snapshots were stale on the first commit of this work and change with every generation fix; they need one deliberate re-baseline (`vitest -u`) after the realism work.
- Performance: `selectNationSeeds` rescans land cells per seed; `renderLandCells` makes several passes over the cells.
- A few `react-hooks/exhaustive-deps` suppressions remain.
- UI phases not started: parchment theme and map frame (compass, fade-in, reduced motion), and mobile bottom sheets with a mobile toolbar.
- Large hooks (`useNationMiniMap`, `useEthnicMiniMap`, `useThreeMap`) could move their pure computation into `services/`.

## Working rules

Generation changes must stay deterministic. Add invariant tests for each fix (for example: every river reaches water, lakes sit below a height cap, mountains lie near convergent boundaries, each nation has a city). Compare the same seed before and after across presets. Tests run only after the maintainer agrees.
