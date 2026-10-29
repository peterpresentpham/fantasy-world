# Hydrology: rivers and lakes

Code: `src/services/hydrology/` (`index.ts` orchestrates, `lakes.ts`, `river/`). Constants: `HYDROLOGY_CONFIG`, `RIVER_CONFIG`, `LAKE_CONFIG` in `src/configs/map/hydrology.ts`.

## Order inside `buildHydrology`

1. **Drainage**: every land cell points to its steepest lower land neighbour; cells with none that touch water drain to the coast outlet (`T_COAST_OUTLET = -2`). Flow is accumulated from high to low, counting upstream cells.
2. **Erosion and lake seeds**: erosion is `min(maxAmount, slope·slopeWeight + log2(flow+1)·flowWeight)` with deposition downstream. A pit with no outlet becomes a lake seed when its flow exceeds `sinkFlowMin` and it lies at most `maxSeedElevationAboveSea` above sea level, so mountain basins drain as streams.
3. **Climate**: water influence, wind, precipitation, temperature, landforms and biomes (see [world-generation.md](./world-generation.md)). Biome classification receives an approximate river mask from the drainage network (cells with at least `earlyMaskCatchment` upstream cells), because real rivers are traced later.
4. **Lakes**: `expandLakes` grows each seed to a few cells, `filterAndLimitLakes` keeps the largest `maxCount` regions, `classifyInlandWater` turns enclosed low areas into lakes (or inland sea when large). Lakes that touch the sea become coast, and dropped lakes become dry land; both take the biome of the surrounding land.
5. **Rivers**: `generateRivers` (below), then results are written back to the cells (`riverId`, `isRiver`, `riverWidth`, `riverOrder`, source and mouth flags).
6. **Suitability** is derived from landform and biome.

## Rivers (`river/`)

### `flow.ts`

- `prepareTerrain`: a land cell is not water and has elevation ≥ `landWaterThreshold`; coastal cells are lifted by `coastLift`.
- `fillDepressions`: priority-flood. Starting from land cells next to non-land, cells are visited lowest first and every neighbour is raised to at least `current + epsilon`. Afterwards every land cell has a strictly lower neighbour on its way out, so no depression is left.
- `accumulateFlow`: each cell contributes `(1.5 + precipitation·16·biomeRetention·aridityDamping)·(N/10000)^0.25`; flow follows the lowest filled neighbour (or the coast outlet) and is summed from high to low. `effectiveFlow` adds a slope term.

### `graph.ts`

- **Sources**: land cells whose flow reaches `minFluxToFormRiver` (scaled by map size and raised in dry areas) and that start a channel or are large enough; sorted by elevation, highest first.
- **Tracing**: each source is followed downstream until it reaches water, leaves through the coast outlet, or meets a river traced earlier. The first river owns the shared channel; a later one **joins** it and ends with `endType: 'confluence'`, recording the confluence cell.
- **Filtering**: chains shorter than `minRiverCells` (doubled in arid sources) are dropped.
- **End types** (`TRiverEndType`): `sea`, `lake`, `confluence`, `offscreen` (leaves through the map edge), `inland-sink`.
- **Order**: Strahler stream order per river (`TRiver.order`); two tributaries of equal top order raise the order of the river they feed.
- **Geometry**: polyline with meander points, width from flow and distance along the river (smoothed so it never narrows downstream), and a bank polygon.
- Names come from `createSeededRandom(`${seed}:river-naming`)`.

## Invariants (checked in `river/river.test.ts`)

- Every river ends at the sea, a lake, another river or the map edge.
- A river that joins another ends on a river cell and has a parent river.
- River cells have `riverOrder ≥ 1`, all other cells 0.
