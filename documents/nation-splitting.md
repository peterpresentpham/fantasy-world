# Nation Splitting Reimplementation Spec (Updated)

## Main File

`src/services/geopolitics/nations.ts`

## Main Export

`buildLandNations(cells, seed, nationCount)` — returns `owner: Int32Array` directly.

## Inputs / Outputs

- Input: `cells: TCell[]`, `seed`, requested `nationCount`.
- Output: `owner: Int32Array` where each land cell owns a nation id (`>= 0`) or remains `-1` before repair.

## Core Components

The nation pipeline uses:

- Seed suitability: `getNationSeedSuitability(...)`
- Frontier expansion: `runMultiSourceExpansion(...)` with `getNationStepCost(...)`
- Boundary cost: `getBoundaryStepCost(...)`
- Neighbor statistics: `getNationNeighborCounts(...)`
- Hash/noise: `makeFrontierHash(...)`

## Deterministic Rules That Must Match

1. Keep `Int32Array` for ownership.
2. Keep all loop orders (`for cellId = 0..N-1`).
3. Keep sorting comparators exactly (including tie-breakers).
4. Keep sentinel behavior (`-1` for unowned).
5. Keep every pass order unchanged.

## Implementation-Level Flow

### Step 0: Nation Count Determination

`buildLandNations(...)`:

- Compute `numOfNation = getNationCount(nationCount, landCellCount)` — adjusts requested count based on land cells.
- Uses `connectivity = buildConnectivityContext(cells)` for component awareness.

### Step 1: Connectivity Context

`buildConnectivityContext(cells)`:

- DFS/BFS land components only (`isLand(cell)`).
- Per component compute:
  - `componentSizes`
  - `boundaryCells` (cells touching water)
- Large component condition:
  - `componentSize >= LARGE_LAND_COMPONENT_MIN_CELLS = 200` => mark as large.

### Step 2: Initial Seeding

`selectNationSeeds(cells, nationCount, seed, connectivity, minComponentSize)`:

- Collect land candidates sorted by `getNationSeedSuitability(...)` score.
- Apply seed spacing and component coverage logic including:
  - Soft geography bias: large + far disconnected components get separate seeds.
  - Small/similar close islands pushed toward sharing nations.
  - Noise via `sin((cellId * 2654435761 + seedHash) * 0.000001) * 0.35`.
- `estimateWaterCells(...)` calculates water gaps between components.
- `minComponentSize` parameter filters candidates (default = `1`; the caller `buildLandNations` always passes `GEOPOLITICAL_CONFIG.minLandCells + 6`).

### Step 3: Multi-source Expansion

`buildLandNations(...)` integrates two expansion stages:

**Stage A — Floor Expansion** (`runFloorExpansion`):

- Grows nations toward `GEOPOLITICAL_CONFIG.minLandCells` before global expansion.
- Uses per-nation `nationExpansionBias` from seeded RNG (`${seed}:${nationId}:nation-expansion-bias`).

**Stage B — Regular Multi-source Expansion** (via `runMultiSourceExpansion`):

- Uses `getNationStepCost(...)` which wraps `getBoundaryStepCost(...)` with:
  - `nationExpansionBias[nationId]` multiplier.
  - `GEOPOLITICAL_CONFIG.frontierNoise * 0.15` additive noise.
  - Min floor: `max(0.2, stepCost)`.

Expansion state:

- `cellId`
- `nationId`
- `cost`

For each frontier pop:

- `if state is stale (cost > current best cost)`: skip.
- For each neighbor:
  - `if neighbor is not land`: skip.
  - Compute `nextCost = current.cost + stepCost(...)`.
  - `if nextCost < cost[neighbor]`:
    - update best cost
    - assign `owner[neighbor] = current.nationId`
    - push next state

Step cost includes terrain, barriers, nation expansion bias, and seeded noise terms.

### Step 4: Repair Small Nations

Core helpers:

- `buildLandNationSizeMap(...)`
- `getSmallNationIds(...)` — sorts by size ascending
- `tryGrowNation(...)` — iterates border cells, uses score = `sharedBorder * 10 - elevation * 0.1`
- `borrowCellForNation(...)` — recursive donor-to-donor chain
- `transferBorderCell(...)` — picks best cell by target neighbor count

Decision pattern:

- `if nation size >= minimum`: skip.
- else try to borrow/grow from neighboring nations.
- Donor constraints:
  - `if donor would drop below minimum floor`: donor rejected.
  - `if candidate border cell does not touch target nation`: rejected.
- Falling back: if still under minimum and count > `preserveNationCount`, dissolve nation by reassigning all cells to best neighboring nation.

### Step 5: Cross-Component / Foreign Nation Bridge

`findNearestForeignNation(...)`:

- Finds nearest land cell whose owner is different from source nation.
- Uses `findNearestCell(...)` with explicit predicate.
- `if no candidate`: return `-1` and skip transfer.

### Step 6: Contiguity and Border Stabilization

`enforceMainlandContiguity(...)`:

- For each nation, find disconnected land components.
- Keep largest component, reassign smaller components to best neighboring nation via `pickBestNationForCell(...)`.

`alignNaturalTerrainClusters(...)`:

- For mountain/hills/plateau/valley cells, reassign if same-terrain neighbors strongly support another nation.
- 2 passes, threshold = `bestCount >= 3`.

`finalizeNationBorders(...)`:

- `fillUnclaimedLand(...)` — assigns any unclaimed land cells to best neighboring nation.
- `ensureAllLandClaimed(...)` — if still unclaimed, assign to nearest claimed nation cell.
- `enforceMinNationArea(...)` — ensures minimum nation sizes.
- `ensureAllLandClaimed(...)` — second call after enforceMinNationArea to claim any cells displaced during area enforcement.
- Runs up to 3 passes, stops early when stabilized.

`diversifySmallNationSizes(...)`:

- Uses seeded RNG from `${seed}:nation-size-diversify:v3`.
- Phase 0: lift nations stuck at exactly `minNationCells`.
- Phase 1: lift many tiny nations out of 10-13 bucket.
- Phase 2: randomly pick some nations to become medium-sized (20+).
- Respects `hardCapTargetSize = max(minNationCells+12, floor(averageSize*1.85))`.

## Edge / Exception Cases

- Tiny map: effective nation count may be lower than requested due to feasibility constraints.
- Land components disconnected by water are handled separately first; cross-component balancing happens later.
- If no legal move exists in a repair pass, pass exits early.

## Reproduction Checklist

- Same constants from `GEOPOLITICAL_CONFIG` and `BORDER_CONFIG`.
- Same noise hash and seed strings.
- Same pass count for each stabilization routine.
- Same comparator tie-break order in all sorts.
