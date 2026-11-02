import { GEOPOLITICAL_CONFIG } from 'src/configs/map/geopolitics';
import { TCell, TEthnic } from 'src/types/global';
import { createRegionalName } from '../shared';
import {
  buildEthnicField,
  collectLandComponents,
  getEthnicGroupCount,
  pickEthnicCoreSeeds,
} from './field';
import { addEthnicFragmentation } from './dominance';
import { smoothEthnicRegions } from './smoothing';
import { enforceEthnicMinPop, fillUnclaimedEthnicLand } from './distribution';

/**
 * Peoples come from geography alone, before any nation exists: each landmass gets a number of
 * peoples that grows with its land and with the share of the nations expected to live on it, and
 * every people floods outwards from a core, slowed by forests, wetlands, mountains and deserts.
 * Nations are drawn afterwards and prefer to end where a people ends.
 */
export function buildEthnicRegions(cells: TCell[], seed: string, nationCount: number) {
  const config = GEOPOLITICAL_CONFIG.ethnic;
  const ethnicOwner = new Int32Array(cells.length);
  ethnicOwner.fill(-1);
  const ethnics: TEthnic[] = [];

  const components = collectLandComponents(cells);
  const totalLand = components.reduce((sum, component) => sum + component.length, 0);
  const largestLandmass = Math.max(0, ...components.map((component) => component.length));
  let ethnicOffset = 0;

  for (let componentIndex = 0; componentIndex < components.length; componentIndex += 1) {
    const componentCellIds = components[componentIndex] as number[];
    if (
      componentCellIds.length < config.minLandmassCells &&
      componentCellIds.length < largestLandmass
    )
      continue;
    const componentSet = new Set(componentCellIds);
    const expectedNations = Math.max(
      1,
      Math.round((nationCount * componentCellIds.length) / Math.max(1, totalLand))
    );
    const targetEthnicCount = getEthnicGroupCount(componentCellIds.length, expectedNations, config);
    const componentEthnicCount = Math.max(1, Math.min(targetEthnicCount, componentCellIds.length));
    const seedCells = pickEthnicCoreSeeds(
      cells,
      componentCellIds,
      componentEthnicCount,
      `${seed}:component:${componentIndex}`
    );

    buildEthnicField(
      cells,
      seedCells,
      `${seed}:component:${componentIndex}`,
      config,
      ethnicOffset,
      componentSet,
      ethnicOwner
    );

    for (let localId = 0; localId < seedCells.length; localId += 1) {
      const globalId = ethnicOffset + localId;
      ethnics.push({
        id: globalId,
        name: createRegionalName(seed, 'ethnic', globalId),
        coreCellId: seedCells[localId] as number,
      });
    }

    ethnicOffset += seedCells.length;
  }

  addEthnicFragmentation(cells, ethnicOwner, ethnics, seed, config);
  smoothEthnicRegions(cells, ethnicOwner, config);
  fillUnclaimedEthnicLand(cells, ethnicOwner);
  enforceEthnicMinPop(cells, ethnicOwner, ethnics);

  return { ethnicOwner, ethnics };
}
