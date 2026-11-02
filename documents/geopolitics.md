# Geopolitics

Code: `src/services/geopolitics/`. Constants: `src/configs/map/geopolitics.ts`. `buildGeopolitics` (in `index.ts`) runs these steps in this order; changing the order changes every world.

1. **Peoples** (`ethnic/`): drawn from geography alone, before any nation. Each cell gets a provisional `ethnicId` that nation borders use in step 2.
2. **Nations**: `buildLandNations` (`nations/`). Seeds favour plains, valleys, water and, with a weight of 1.8, settled land (population smoothed over the neighbours and square-rooted); a city (a land cell no neighbour out-populates, at least 12% of the biggest city) adds another 2.5, so nations tend to grow from a city. Right after the expansion `keepCitiesWhole` (`cities.ts`) gives every land cell within two steps of a city to the nation that holds the city, biggest cities first, so no border runs through a city; the clean-up passes then repair connectivity. A border step from one people into another costs an extra 9 (rivers cost 7.8, ridges 10.5), so borders often end where a people ends.
3. **Nation clean-up**: stability pass (terrain alignment, mountain-split limit, minimum area), contiguity, stability pass, `finalizeNationBorders`, `diversifySmallNationSizes`, `finalizeNationBorders`.
4. **Nation profiles**: a small random population multiplier (0.85–1.15) and economy multiplier (0.8–1.25) per nation, so a nation's size comes from its land,, applied to the population stage's cell values with small terrain modifiers, then a floor of 500 people per nation.
5. **Provinces** (`provinces/`) and their post-processing.
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

Peoples exist before nations and know nothing about them. `field.ts` gives each landmass about one people per 1300 land cells and at least 1.5 per expected nation on it (expected nations are shared out by land), up to 12, seeded on plains, valleys and rivers, and floods a geography field where forest, wetland, mountain and desert cost more. Islands under 150 cells get no people of their own and take the nearest one. Then `dominance.ts` adds small mountain fragments, `smoothing.ts` cleans the edges, and peoples under a minimum population are merged.

On a default map this gives about 13 peoples for 10 nations. A people typically spans about 2 nations, and 37% of nation-border edges are also people borders (without the border cost it is 11%, and 4.8% of all land edges separate two peoples).

## Capitals and hubs (`capitals.ts`)

A capital scores population (most weight), economy, access to water (coast or river), distance from land borders, safety and connectivity. Interior cells are preferred, but any cell with at least 85% of the nation's biggest population is also a candidate, so the capital is the nation's main city even close to a border; it may be on a coast or river. In 12 test maps 96% of capitals were the main city or next to it (54% before). One to three economic hubs per nation (by size) favour economy and water access and keep their distance from the capital and each other.

## Maritime zones

`assignMaritimeZones` walks outwards from every owned land cell. A lake is `internal-waters` of the nation around it however wide it is. Sea within 0.028 of the map diagonal of a coast is `territorial-waters` of the nearest coast's nation (counted in cells and scaled by cell spacing, so it does not depend on the cell count), and a strait is split between the two coasts. The rest is `international-waters`. Water cells carry the owner's `nationId`; statistics still filter on `!isWater`.

## Known limits

See [roadmap.md](./roadmap.md): the population stage still draws a few cities (4 to 18) and nations lean towards them rather than being built from a fixed city list, and the remaining random factor in step 4 is small.
