# Ethnic Splitting Reimplementation Spec (Updated)

## Main File

`src/services/geopolitics/ethnic.ts`

## Return Value

`buildEthnicRegions(cells, nationOwner, seed)` returns `{ ethnicOwner: Int32Array, ethnics: TEthnic[] }` — an object containing both the ownership array and the list of ethnic group objects.

## Constants and Configuration

- `T_MIN_ETHNIC_POPULATION = 1000`
- `GEOPOLITICAL_CONFIG.ethnic` fields:
  - `majorGroupMin`
  - `majorGroupMax`
  - `dominantShareMin`, `dominantShareMax`
  - `secondaryShareMin`, `secondaryShareMax`
  - `crossBorderBlend`
  - `fragmentationLevel`
  - `terrainInfluenceStrength` (landform-aware step cost via `Cost.ethnic`)
  - `distancePenalty`
  - `smoothingPasses`
  - `minorityClusterMin` (**note**: this is the config field name — in code it's `config.minorityClusterMin`, not `minorityClusterMinCells`)

## Exact Stage Order

In `buildEthnicRegions(...)`:

1. Build components: `collectLandComponents(...)`
2. Per component:
   - decide target ethnic count
   - pick core seeds
   - run ethnic field expansion
3. Global correction passes in order:
   - `enforceNationEthnicDominance(...)`
   - `expandCrossBorderEthnics(...)`
   - `smoothCrossBorderEthnics(...)`
   - `addEthnicFragmentation(...)`
   - `expandCrossBorderEthnics(...)` (second time)
   - `smoothCrossBorderEthnics(...)` (second time)
   - `spreadEthnicsAcrossNations(...)`
   - `smoothEthnicRegions(...)`
   - `fillUnclaimedEthnicLand(...)`
   - `enforceEthnicMinPop(...)`

Pass order is part of behavior.

## Detailed Branching Rules

### Group Count

`getEthnicGroupCount(landCellCount, nationCount, config)`:

- `byLand = floor(landCellCount / 1300)`
- return `clamp(max(nationCount, byLand), majorGroupMin, majorGroupMax)`

### Seed Picking

`pickEthnicCoreSeeds(cells, cellIds, count, seed)`:

- Uses seeded RNG from `${seed}:ethnic:cores`.
- Each candidate score uses:
  - base: `suitability * 1.3`
  - bonuses:
    - plains/valley `+1.1`
    - temperate_forest/tropical_forest `+0.35`
    - mountains `+0.2`
    - river/lake `+0.35`
  - random jitter: `random() * 0.5` (seeded RNG, **not** edge noise/hash)

Selection rule:

- sorted descending by score
- accept candidate iff distance to all accepted seeds is `>= 70`
- fallback: if none accepted and candidates exist, take top candidate

### Ethnic Field Expansion

State fields: `{ cellId, ethnicId, cost, distance }`.

Neighbor expansion rule:

- Skip when:
  - neighbor outside allowed component
  - neighbor is not land
- Step cost:
  1. `Cost.ethnic(neighbor, { strength: terrainInfluenceStrength })`
  2. `+ borderPenalty` if crossing nation boundary:
     - `1 - crossBorderBlend`
  3. `+ fragmentation term` for mountain-to-mountain transitions
  4. `+ river/lake transition penalties`
  5. `+ nextDistance * distancePenalty`
  6. `+ edgeNoise(seedHash, current, neighbor)` perturbation
- `nextCost = current.cost + max(0.2, step)`
- Update only if `nextCost < cost[neighbor]`

### Nation Dominance Enforcement

Per nation:

- Compute ethnic frequencies over nation land cells.
- `dominantId = highest count`, `secondaryId = second highest`.
- Compute target shares and required counts.

Dominant repaint:

- `if currentDominant < dominantNeed`:
  - collect outsider cells
  - rank by how many neighbors touch dominant ethnic
  - repaint until need is met

Secondary repaint:

- `if currentSecondary < secondaryNeed`:
  - collect candidates not dominant/secondary
  - rank by secondary-neighbor touches
  - repaint until need is met

Bridge exception (both dominant/secondary repaint):

- `if isCrossNationBridgeCell(cellId, oldEthnicId)`: do not repaint this cell.

### Fragmentation Pass

`addEthnicFragmentation(...)`:

- For each ethnic group:
  - if group size `< config.minorityClusterMin * 2`: skip
  - choose mountain anchor randomly
  - frontier spread over mountain/hill neighbors with probabilistic acceptance (`random() > 0.62`)
  - Up to `fragmentSteps = max(1, floor(fragmentationLevel * 6))` steps

### Cross-Border Smoothing/Expansion

Two paired rounds of:

- `expandCrossBorderEthnics(...)` — uses BFS depth search for cross-border support, plus terrain bias and random noise (seeded from `${seed}:ethnic:deep-cross-border`).
- `smoothCrossBorderEthnics(...)` — uses local + cross-border neighbor support with `crossBorderBlend` weighting.

Both use weighted support from local and cross-border neighborhoods.

Switch condition:

- `if best candidate score > current score`: switch
- else keep current ethnic id

Detailed parameters:

- `expandCrossBorderEthnics`: iterations = `max(2, floor(3 + crossBorderBlend * 4))`, max depth = `max(2, floor(3 + crossBorderBlend * 3))`.
- `smoothCrossBorderEthnics`: iterations = `max(2, floor(2 + crossBorderBlend * 3))`.

### Spread Ethnics Across Nations

`spreadEthnicsAcrossNations(...)`:

- For each ethnic group that only exists in 1 nation:
  - Find border cells of neighboring nations adjacent to the group.
  - BFS paint up to 18 cells into the group's ethnic to spread across borders.
  - Stays within same nation during BFS.

### Unclaimed and Minimum Population

`fillUnclaimedEthnicLand(...)`:

- For each land cell with invalid ethnic owner:
  - assign nearest claimed land ethnic

`enforceEthnicMinPop(...)`:

- Iterate up to `maxIterations = 12`.
- Find under-threshold ethnic groups (population < `T_MIN_ETHNIC_POPULATION` = 1000).
- Merge/reassign toward strongest border-vote targets, or nearest ethnic if no border votes.
- Fallback: if `finalEthnicIds.size === 0 && totalLandPopulation < T_MIN_ETHNIC_POPULATION`, keep the largest group and reassign all land cells to it.
- Final pass: clean up cells belonging to eliminated ethnic groups.

## Determinism Requirements

- Keep seeded RNG keys exactly.
- Keep comparator and iteration order unchanged.
- Keep exact thresholds and multipliers.
- Keep pass duplication (cross-border passes run twice) unchanged.
