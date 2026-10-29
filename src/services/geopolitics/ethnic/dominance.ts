import { createSeededRandom } from 'src/services/utils/math';
import { TCell, TEthnic } from 'src/types/global';
import { TEthnicConfig } from 'src/types/geopolitics';
import { getOwnerLandCellIds, isLand } from '../shared';

export function enforceNationEthnicDominance(
  cells: TCell[],
  nationOwner: Int32Array,
  ethnicOwner: Int32Array,
  config: TEthnicConfig
) {
  function isCrossNationBridgeCell(cellId: number, ethnicId: number) {
    const nationId = nationOwner[cellId];
    if (nationId < 0) return false;
    for (const neighborId of cells[cellId].neighbors) {
      if (!isLand(cells[neighborId])) continue;
      if (nationOwner[neighborId] === nationId) continue;
      if (ethnicOwner[neighborId] === ethnicId) return true;
    }
    return false;
  }

  const nationIds = Array.from(new Set(nationOwner)).filter((nationId) => nationId >= 0);
  for (const nationId of nationIds) {
    const nationCells = getOwnerLandCellIds(cells, nationOwner, nationId);
    if (nationCells.length === 0) continue;

    const ethnicCounts = new Map<number, number>();
    for (const cellId of nationCells) {
      const ethnicId = ethnicOwner[cellId];
      if (ethnicId < 0) continue;
      ethnicCounts.set(ethnicId, (ethnicCounts.get(ethnicId) || 0) + 1);
    }
    const ranked = Array.from(ethnicCounts.entries()).sort((a, b) => b[1] - a[1]);
    const dominantId = ranked[0]?.[0] ?? -1;
    const secondaryId = ranked[1]?.[0] ?? dominantId;
    if (dominantId < 0) continue;

    const dominantTarget = Math.max(
      config.dominantShareMin,
      Math.min(config.dominantShareMax, 0.54 + (nationCells.length > 700 ? 0.04 : 0))
    );
    const secondaryTarget = Math.max(
      config.secondaryShareMin,
      Math.min(config.secondaryShareMax, 0.2)
    );
    const dominantNeed = Math.floor(nationCells.length * dominantTarget);
    const secondaryNeed = Math.floor(nationCells.length * secondaryTarget);

    const currentDominant = ranked[0]?.[1] ?? 0;
    if (currentDominant < dominantNeed) {
      const outsiders = nationCells.filter((cellId) => ethnicOwner[cellId] !== dominantId);
      outsiders.sort((leftId, rightId) => {
        const leftTouches = cells[leftId].neighbors.filter(
          (n) => ethnicOwner[n] === dominantId
        ).length;
        const rightTouches = cells[rightId].neighbors.filter(
          (n) => ethnicOwner[n] === dominantId
        ).length;
        return rightTouches - leftTouches;
      });
      let need = dominantNeed - currentDominant;
      for (const cellId of outsiders) {
        if (need <= 0) break;
        if (isCrossNationBridgeCell(cellId, ethnicOwner[cellId])) continue;
        ethnicOwner[cellId] = dominantId;
        need -= 1;
      }
    }

    if (secondaryId >= 0 && secondaryId !== dominantId) {
      const currentSecondary = ethnicCounts.get(secondaryId) || 0;
      if (currentSecondary < secondaryNeed) {
        const secondaryCandidates = nationCells.filter(
          (cellId) => ethnicOwner[cellId] !== dominantId && ethnicOwner[cellId] !== secondaryId
        );
        secondaryCandidates.sort((leftId, rightId) => {
          const leftTouches = cells[leftId].neighbors.filter(
            (n) => ethnicOwner[n] === secondaryId
          ).length;
          const rightTouches = cells[rightId].neighbors.filter(
            (n) => ethnicOwner[n] === secondaryId
          ).length;
          return rightTouches - leftTouches;
        });
        let need = secondaryNeed - currentSecondary;
        for (const cellId of secondaryCandidates) {
          if (need <= 0) break;
          if (isCrossNationBridgeCell(cellId, ethnicOwner[cellId])) continue;
          ethnicOwner[cellId] = secondaryId;
          need -= 1;
        }
      }
    }
  }
}

export function addEthnicFragmentation(
  cells: TCell[],
  ethnicOwner: Int32Array,
  ethnics: TEthnic[],
  seed: string,
  config: TEthnicConfig
) {
  const random = createSeededRandom(`${seed}:ethnic:fragments`);
  const fragmentSteps = Math.max(1, Math.floor(config.fragmentationLevel * 6));
  for (const group of ethnics) {
    const groupCells = cells
      .filter((cell) => ethnicOwner[cell.id] === group.id && isLand(cell))
      .map((cell) => cell.id);
    if (groupCells.length < config.minorityClusterMin * 2) continue;
    const mountainCandidates = groupCells.filter((cellId) => cells[cellId].landform === 'mountain');
    if (mountainCandidates.length === 0) continue;
    const anchorId = mountainCandidates[Math.floor(random() * mountainCandidates.length)] as number;
    let frontier = [anchorId];
    const painted = new Set<number>([anchorId]);
    for (let step = 0; step < fragmentSteps; step += 1) {
      const nextFrontier: number[] = [];
      for (const currentId of frontier) {
        for (const neighborId of cells[currentId].neighbors) {
          if (painted.has(neighborId) || !isLand(cells[neighborId])) continue;
          if (cells[neighborId].landform !== 'mountain' && cells[neighborId].landform !== 'hills')
            continue;
          if (random() > 0.62) continue;
          painted.add(neighborId);
          ethnicOwner[neighborId] = group.id;
          nextFrontier.push(neighborId);
        }
      }
      if (nextFrontier.length === 0) break;
      frontier = nextFrontier;
    }
  }
}
