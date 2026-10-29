import { TFifoQueue } from 'src/services/utils/collections';
import { findNearestCell } from 'src/services/utils/geometry';
import { TCell, TEthnic } from 'src/types/global';
import { isLand } from '../shared';

const T_MIN_ETHNIC_POPULATION = 1000;

export function spreadEthnicsAcrossNations(
  cells: TCell[],
  nationOwner: Int32Array,
  ethnicOwner: Int32Array,
  ethnics: TEthnic[]
) {
  for (const group of ethnics) {
    const nationIds = new Set<number>();
    for (const cell of cells) {
      if (!isLand(cell)) continue;
      if (ethnicOwner[cell.id] !== group.id) continue;
      const nationId = nationOwner[cell.id];
      if (nationId >= 0) nationIds.add(nationId);
    }
    if (nationIds.size >= 2) continue;

    const candidateBorders: number[] = [];
    for (const cell of cells) {
      if (!isLand(cell)) continue;
      if (ethnicOwner[cell.id] !== group.id) continue;
      const cellNationId = nationOwner[cell.id];
      if (cellNationId < 0) continue;
      for (const neighborId of cell.neighbors) {
        if (!isLand(cells[neighborId])) continue;
        if (nationOwner[neighborId] === cellNationId) continue;
        candidateBorders.push(neighborId);
      }
    }
    if (candidateBorders.length === 0) continue;

    let painted = 0;
    const uniqueBorderCells = [...new Set(candidateBorders)];
    const queue = new TFifoQueue<number>();
    for (const cellId of uniqueBorderCells) {
      queue.enqueue(cellId);
    }
    const visited = new Set<number>(uniqueBorderCells);
    while (queue.size > 0 && painted < 18) {
      const currentId = queue.dequeue() as number;
      if (!isLand(cells[currentId])) continue;
      if (ethnicOwner[currentId] !== group.id) {
        ethnicOwner[currentId] = group.id;
        painted += 1;
      }
      for (const neighborId of cells[currentId].neighbors) {
        if (visited.has(neighborId)) continue;
        if (!isLand(cells[neighborId])) continue;
        if (nationOwner[neighborId] !== nationOwner[currentId]) continue;
        visited.add(neighborId);
        queue.enqueue(neighborId);
      }
    }
  }
}

export function fillUnclaimedEthnicLand(cells: TCell[], ethnicOwner: Int32Array) {
  const claimedLandIds = cells
    .filter((cell) => isLand(cell) && ethnicOwner[cell.id] >= 0)
    .map((cell) => cell.id);
  if (claimedLandIds.length === 0) return;

  for (const cell of cells) {
    if (!isLand(cell) || ethnicOwner[cell.id] >= 0) continue;
    const nearestCellId = findNearestCell(cells, cell.site, claimedLandIds);
    if (nearestCellId >= 0) ethnicOwner[cell.id] = ethnicOwner[nearestCellId];
  }
}

export function enforceEthnicMinPop(cells: TCell[], ethnicOwner: Int32Array, ethnics: TEthnic[]) {
  function getPopulationByEthnic() {
    const population = new Map<number, number>();
    for (const cell of cells) {
      if (!isLand(cell)) continue;
      const ethnicId = ethnicOwner[cell.id];
      if (ethnicId < 0) continue;
      population.set(ethnicId, (population.get(ethnicId) || 0) + cell.population);
    }
    return population;
  }

  const totalLandPopulation = cells.reduce((sum, cell) => {
    if (!isLand(cell)) return sum;
    return sum + cell.population;
  }, 0);
  const maxIterations = 12;
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const populationByEthnic = getPopulationByEthnic();
    const activeEthnicIds = Array.from(populationByEthnic.keys());
    if (activeEthnicIds.length <= 1) break;

    const underpopulated = activeEthnicIds.filter((id) => {
      return (populationByEthnic.get(id) || 0) < T_MIN_ETHNIC_POPULATION;
    });
    if (underpopulated.length === 0) break;

    let changed = false;
    for (const ethnicId of underpopulated) {
      const ethnicCells = cells
        .filter((cell) => isLand(cell) && ethnicOwner[cell.id] === ethnicId)
        .map((cell) => cell.id);
      if (ethnicCells.length === 0) continue;

      const borderVotes = new Map<number, number>();
      for (const cellId of ethnicCells) {
        for (const neighborId of cells[cellId].neighbors) {
          if (!isLand(cells[neighborId])) continue;
          const neighborEthnicId = ethnicOwner[neighborId];
          if (neighborEthnicId < 0 || neighborEthnicId === ethnicId) continue;
          borderVotes.set(neighborEthnicId, (borderVotes.get(neighborEthnicId) || 0) + 1);
        }
      }

      let targetEthnicId = -1;
      let bestVotes = -1;
      for (const [candidateId, votes] of borderVotes) {
        if (votes > bestVotes) {
          bestVotes = votes;
          targetEthnicId = candidateId;
        }
      }

      if (targetEthnicId < 0) {
        const candidateCellIds = cells
          .filter(
            (cell) => isLand(cell) && ethnicOwner[cell.id] >= 0 && ethnicOwner[cell.id] !== ethnicId
          )
          .map((cell) => cell.id);
        if (candidateCellIds.length > 0) {
          const nearestCellId = findNearestCell(
            cells,
            cells[ethnicCells[0] as number].site,
            candidateCellIds
          );
          if (nearestCellId >= 0) targetEthnicId = ethnicOwner[nearestCellId];
        }
      }

      if (targetEthnicId < 0) continue;

      for (const cellId of ethnicCells) ethnicOwner[cellId] = targetEthnicId;
      changed = true;
    }

    if (!changed) break;
  }

  const finalPopulationByEthnic = getPopulationByEthnic();
  const sortedFinalPopulations = Array.from(finalPopulationByEthnic.entries()).sort(
    (a, b) => b[1] - a[1]
  );
  const finalEthnicIds = new Set(
    sortedFinalPopulations
      .filter(([, population]) => population >= T_MIN_ETHNIC_POPULATION)
      .map(([id]) => id)
  );

  if (finalEthnicIds.size === 0 && sortedFinalPopulations.length > 0) {
    const fallbackEthnicId = sortedFinalPopulations[0]?.[0] ?? -1;
    if (fallbackEthnicId >= 0 && totalLandPopulation < T_MIN_ETHNIC_POPULATION) {
      for (let cellId = 0; cellId < cells.length; cellId += 1) {
        if (!isLand(cells[cellId])) continue;
        ethnicOwner[cellId] = fallbackEthnicId;
      }
      finalEthnicIds.add(fallbackEthnicId);
    }
  }

  for (let cellId = 0; cellId < cells.length; cellId += 1) {
    if (!isLand(cells[cellId])) continue;
    const ethnicId = ethnicOwner[cellId];
    if (ethnicId < 0 || finalEthnicIds.has(ethnicId)) continue;

    let bestEthnicId = -1;
    let bestCount = 0;
    for (const neighborId of cells[cellId].neighbors) {
      if (!isLand(cells[neighborId])) continue;
      const neighborEthnicId = ethnicOwner[neighborId];
      if (neighborEthnicId < 0 || !finalEthnicIds.has(neighborEthnicId)) continue;
      const count = (bestEthnicId === neighborEthnicId ? bestCount : 0) + 1;
      if (count > bestCount) {
        bestCount = count;
        bestEthnicId = neighborEthnicId;
      }
    }

    if (bestEthnicId >= 0) ethnicOwner[cellId] = bestEthnicId;
  }

  if (finalEthnicIds.size > 0) {
    const fallbackEthnicId = Array.from(finalEthnicIds)[0] as number;
    for (let cellId = 0; cellId < cells.length; cellId += 1) {
      if (!isLand(cells[cellId])) continue;
      const ethnicId = ethnicOwner[cellId];
      if (ethnicId >= 0 && finalEthnicIds.has(ethnicId)) continue;
      ethnicOwner[cellId] = fallbackEthnicId;
    }
  }

  const nextGroups = ethnics.filter((group) => finalEthnicIds.has(group.id));
  ethnics.splice(0, ethnics.length, ...nextGroups);
}
