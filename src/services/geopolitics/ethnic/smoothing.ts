import { TCell } from 'src/types/global';
import { TEthnicConfig } from 'src/types/geopolitics';
import { isLand } from '../shared';

export function smoothEthnicRegions(
  cells: TCell[],
  ethnicOwner: Int32Array,
  config: TEthnicConfig
) {
  for (let pass = 0; pass < config.smoothingPasses; pass += 1) {
    const next = Int32Array.from(ethnicOwner);
    for (let cellId = 0; cellId < cells.length; cellId += 1) {
      if (!isLand(cells[cellId])) continue;
      const counts = new Map<number, number>();
      for (const neighborId of cells[cellId].neighbors) {
        const ethnicId = ethnicOwner[neighborId];
        if (ethnicId < 0) continue;
        counts.set(ethnicId, (counts.get(ethnicId) || 0) + 1);
      }
      let bestId = ethnicOwner[cellId];
      let bestCount = counts.get(bestId) || 0;
      for (const [candidateId, count] of counts) {
        if (count > bestCount) {
          bestCount = count;
          bestId = candidateId;
        }
      }
      if (bestId !== ethnicOwner[cellId] && bestCount >= 3) {
        next[cellId] = bestId;
      }
    }
    ethnicOwner.set(next);
  }
}
