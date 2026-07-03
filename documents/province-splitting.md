# Province Splitting Reimplementation Spec (Updated v2)

## Main File

`src/services/geopolitics/provinces/` (directory — `index.ts`, `seed-split.ts`, `post-process.ts`, `helpers.ts`)

## Key Exports

- `buildNationProvinces(cells, owner, seed)` — builds provinces for all nations, returns `provinceOwner: Int32Array`.
- `enforceProvinceConnect({ cells, owner, provinceOwner })` — fixes disconnected province fragments.
- `minProvinceArea({ cells, owner, provinceOwner })` — enforces minimum province area/population rules.
- `limitProvincePopulation({ cells, owner, provinceOwner })` — ensures no province falls below 3% hard floor.

## Constants That Affect Exact Output

- `IDEAL_PROVINCE_POP = 500_000`
- `MAX_PROVINCE_POP = 1_500_000`
- `MERGE_POP_CAP = 800_000`
- `MIN_POP_PERCENT = 0.03`
- `MAX_POP_PERCENT = 0.12`
- `SMALL_NATION_POPULATION_THRESHOLD = 1_000`
- `SMALL_NATION_MIN_PROVINCE_POPULATION = 200`
- `DEFAULT_MIN_PROVINCE_POPULATION = 1_000`
- `PROVINCE_TUNING` object (all subfields must stay identical — see code for exact values)

## Exact High-Level Flow

### Per-Nation Province Building (`buildNationProvinces`)

1. Gather nation cells. Compute `nationSize` (terrain-weighted), `nationPopulation`.
2. Determine small-nation split flag: `isNationSplit(nationPop, cellCount, nationSize)`.
3. Determine ignore flag: `isIgnorePopulationRules(nationPop, cellCount, nationSize)`.
4. Compute planning metrics via `getProvincePlanMetrics(...)`.
5. Select seeds via scored candidates with distance constraints.
6. Run province expansion via `assignProvincesBySeeds(...)` (calls `runMultiSourceExpansion`).
7. Evaluate split/merge pressure — add seeds for over-cap provinces (up to `maxIterations=20`).
8. Ensures at least `requiredMinProvince` provinces via `enforceMinProvince(...)`.

### Global Post-Process in `postProcessProvinces` (called from `src/services/geopolitics/index.ts`)

1. `limitMountainSplit(cells, provinceOwner, 'province', owner)`
2. Two rounds of `enforceProvinceConnect({ cells, owner, provinceOwner })` + `minProvinceArea({ cells, owner, provinceOwner })`
3. `limitProvincePopulation({ cells, owner, provinceOwner })`

## Detailed Branching Rules

### Metric Computation

`getProvincePlanMetrics(...)` depends on:

- nation population
- nation cell count
- effective nation size (terrain-weighted sum)
- flags: `isNationSplit`, `isIgnore`

Population-based baseline province count:

- `if nationPopulation > 1_000_000`: baseline by `ceil(pop / IDEAL_PROVINCE_POP)`.
- `if 500_000 < nationPopulation <= 1_000_000`: baseline is `3`.
- `if 300_000 <= nationPopulation <= 500_000`: baseline is `2`.
- else baseline is `1`.

Metric outputs:

- `minProvinceSize` — terrain-adaptive minimum province size.
- `baselineTarget` — clamped initial target.
- `minProvincePopulation` — `max(getNationMinProvincePop(nationPopulation), floor(targetPopulation * 0.7))`.
- `requiredMinProvince` — combined from pop-driven, cell-driven, configuration floors/caps, small-nation cap.
- `maxProvinceCount` — upper bound from cells, population, and small-nation rules.

### Seed Selection

- Score uses `getProvinceSeedScore(cell)` from `./cost`.
- Distance rule:
  - plains/valley: `PROVINCE_TUNING.seedDistance.plainOrValley = 42`.
  - other terrain: `PROVINCE_TUNING.seedDistance.other = 72`.
  - Minimum between seeds: `PROVINCE_TUNING.seedDistance.minBetweenSeeds = 26`.
- If scored candidates produce fewer seeds than `requiredMinProvince`, remaining seeds are added from top candidates regardless of distance.

### Expansion

`assignProvincesBySeeds(...)`:

- Uses `runMultiSourceExpansion` internally.
- Step cost: `getBoundaryStepCost(...)` \* terrainMismatchMultiplier (3x if neighbor landform ≠ seed landform).
- Min floor: `max(0.25, step * terrainMismatchMultiplier)`.
- Candidate cells must belong to same nation.
- Territory is reassigned each split iteration (resets all cells to -1 then re-expands).

### Split Trigger (within buildNationProvinces)

In each split iteration, for each province (sorted by population descending):

- Check if population exceeds `dynamicPopulationBounds.max` (hard cap).
- Check if population share > `maxProvincePopulationShare` AND population > `basePopulationBounds.target * 1.05`.
- Check if cell count > `cellCapByDensity` (density-aware cap).
- Check if effective size > `minProvinceSize * maxProvinceAreaFactor (3.4)`.
- Metropolis exception: `isMetropolis(...)` may keep tiny high-pop province unsplit.

Guard:

- If adding a new seed violates `minBetweenSeeds` distance, skip.

### Merge Trigger (within `minProvinceArea`)

A province is merge candidate when one or more hold:

- below terrain-adjusted `minProvincePopulation`.
- effective size below `minProvinceSize`.
- below mandatory minimum population (if `enforceMandatoryPopulationFloor`).
- below 3% hard floor (`underPopulatedByHardFloor`).

But NOT merge candidates when:

- dense urban province (population > `populationBounds.target * 1.2`).
- above population max cap.
- special economy province (economy per cell > `nationAverage * economySpecialFactor(1.45)`).
- large sparse province (size >= `minProvinceSize * largeSparseFactor(1.35)`) with only population deficiency.

Merge target rules:

1. Prefer same-terrain neighbors (prioritized in underpopulated cases).
2. Reject target if merged pop exceeds `MERGE_POP_CAP = 800_000`.
3. If all rejected, fallback to nearest valid province.
4. After initial merge, runs soft rebalance (2 passes) then strict floor enforcement (12 passes) with scoring: `reachesFloor * 1_000_000 + terrainMatch * 10_000 + touch * 100 - overshoot * 0.001`.

### Metropolis Exception

`isMetropolis(cells, population, maxPopulation, minSize, cellsWeight)`:

- If `cells.length > 2`: false.
- If `population <= maxPopulation`: false.
- If `effectiveSize > minSize`: false.
- Otherwise: true (preserves tiny but dense province).

### Loop Termination

- Split loop stops when:
  - `maxIterations = 20` reached, OR
  - no new seeds added in a pass.
- Rebalance loops (soft + strict) stop when:
  - iteration cap reached, OR
  - no ownership changes in pass.
