import { createSeededRandom } from 'src/services/utils/math';
import { TCell, TEthnic } from 'src/types/global';
import { TEthnicConfig } from 'src/types/geopolitics';
import { isLand } from '../shared';

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
