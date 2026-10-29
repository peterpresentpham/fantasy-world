# Geopolitics

Code: `src/services/geopolitics/`. Constants: `src/configs/map/geopolitics.ts`. `buildGeopolitics` (in `index.ts`) runs these steps in this order; changing the order changes every world.

1. **Nations**: `buildLandNations` (`nations/`).
2. **Nation clean-up**: stability pass (terrain alignment, mountain-split limit, minimum area), contiguity, stability pass, `finalizeNationBorders`, `diversifySmallNationSizes`, `finalizeNationBorders`.
3. **Nation profiles**: a random population multiplier (0.1–5.0) and economy multiplier (0.1–20) per nation, applied to the population stage's cell values with small terrain modifiers, then a floor of 500 people per nation.
4. **Provinces** (`provinces/`) and their post-processing.
5. **Ethnic regions** (`ethnic/`).
6. **Final projection**: maritime zones, capitals and hubs (`capitals.ts`), and the per-cell `nationId`, `provinceId`, `ethnicId`, `zoneType`.

The population stage runs before this (see [world-generation.md](./world-generation.md)); nations do not feed back into it.

## Shared building blocks

- **Ownership** is an `Int32Array` per cell (`-1` = unowned), for nations, provinces and ethnic groups.
- **Cost-based expansion**: `runMultiSourceExpansion` (`utils/graph.ts`) is a Dijkstra-style flood from all seeds at once. A step's cost comes from the landform and biome of the cell entered plus penalties for crossing barriers (river, lake, ridge), noise and a jaggedness term (`cost.ts`, `shared/boundary.ts`). Rivers and ridges are costs, not hard borders.
- **Repair passes** (`shared/`): reassign disconnected fragments to the best neighbour, keep every owner above a minimum area, and limit how many owners may split a mountain cluster.

## Nations (`nations/`)

- **Count**: the requested count, capped by land size (`getNationCount`).
- **Seeds** (`seeds.ts`): cells are scored by landform, rivers, coast and suitability; the first seed is the best cell, the rest are greedy with a distance term and noise, and large landmasses get a bonus for their first seed.
- **Expansion** (`expansion.ts`, `index.ts`): first every nation grows to a floor size, then the global flood runs. Each nation has a random expansion bias, so some grow faster than others.
- **Balancing** (`balance.ts`, `transfer.ts`): small nations borrow border cells from neighbours or are dissolved, then sizes are diversified within a cap relative to the average.

## Provinces (`provinces/`)

Seeds are placed per nation (preferring plains, valleys and coast, keeping their distance), counts follow population and terrain-weighted area, and expansion uses the same cost model with a lower barrier penalty. Post-processing limits mountain splits, repairs connectivity, enforces a minimum area (two rounds) and caps population per province. Province borders are simply where the owner changes.

## Ethnic regions (`ethnic/`)

- `field.ts` picks seeds per landmass (plains, valleys, rivers preferred) and floods a geography field where forest, wetland, mountain and desert cost more; crossing a nation border costs little.
- `dominance.ts` then repaints each nation so one group is the clear majority (about 54–58%) with a smaller secondary group, `distribution.ts` spreads groups that sit in only one nation across a border, and `smoothing.ts` cleans the edges. Groups under a minimum population are merged.

## Capitals and hubs (`capitals.ts`)

A capital scores population, economy, centrality (far from borders and, today, from the coast), safety and connectivity; it is drawn from the top few percent, or is the best cell in small nations. One to three economic hubs per nation (by size) favour economy and water access and keep their distance from the capital and each other.

## Maritime zones

`assignMaritimeZones` marks water cells as `land`, `territorial` or `international-waters` in `zoneType`; today every water cell is international.

## Known limits

See [roadmap.md](./roadmap.md): nation and ethnic layers are built on terrain only, cities are not tied to nations, and the multipliers in step 3 are independent of geography.
