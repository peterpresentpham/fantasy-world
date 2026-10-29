import { GEOPOLITICAL_CONFIG } from 'src/configs/map/geopolitics';
import { TCell, TEthnic } from 'src/types/global';
import { createRegionalName } from '../shared';
import {
  buildEthnicField,
  collectLandComponents,
  getEthnicGroupCount,
  pickEthnicCoreSeeds,
} from './field';
import { addEthnicFragmentation, enforceNationEthnicDominance } from './dominance';
import {
  expandCrossBorderEthnics,
  smoothCrossBorderEthnics,
  smoothEthnicRegions,
} from './smoothing';
import {
  enforceEthnicMinPop,
  fillUnclaimedEthnicLand,
  spreadEthnicsAcrossNations,
} from './distribution';

export function buildEthnicRegions(cells: TCell[], nationOwner: Int32Array, seed: string) {
  const config = GEOPOLITICAL_CONFIG.ethnic;
  const ethnicOwner = new Int32Array(cells.length);
  ethnicOwner.fill(-1);
  const ethnics: TEthnic[] = [];

  const components = collectLandComponents(cells);
  let ethnicOffset = 0;

  for (let componentIndex = 0; componentIndex < components.length; componentIndex += 1) {
    const componentCellIds = components[componentIndex] as number[];
    const componentSet = new Set(componentCellIds);
    const componentNationCount = new Set(
      componentCellIds.map((cellId) => nationOwner[cellId]).filter((nationId) => nationId >= 0)
    ).size;
    const targetEthnicCount = getEthnicGroupCount(
      componentCellIds.length,
      componentNationCount,
      config
    );
    const componentEthnicCount = Math.max(1, Math.min(targetEthnicCount, componentCellIds.length));
    const seedCells = pickEthnicCoreSeeds(
      cells,
      componentCellIds,
      componentEthnicCount,
      `${seed}:component:${componentIndex}`
    );

    buildEthnicField(
      cells,
      nationOwner,
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

  enforceNationEthnicDominance(cells, nationOwner, ethnicOwner, config);
  expandCrossBorderEthnics(cells, nationOwner, ethnicOwner, seed, config);
  smoothCrossBorderEthnics(cells, nationOwner, ethnicOwner, config);
  addEthnicFragmentation(cells, ethnicOwner, ethnics, seed, config);
  expandCrossBorderEthnics(cells, nationOwner, ethnicOwner, seed, config);
  smoothCrossBorderEthnics(cells, nationOwner, ethnicOwner, config);
  spreadEthnicsAcrossNations(cells, nationOwner, ethnicOwner, ethnics);
  smoothEthnicRegions(cells, ethnicOwner, config);
  fillUnclaimedEthnicLand(cells, ethnicOwner);
  enforceEthnicMinPop(cells, ethnicOwner, ethnics);

  return { ethnicOwner, ethnics };
}
