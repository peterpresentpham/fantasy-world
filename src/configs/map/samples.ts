import { TTopography } from 'src/types/global';

export type TSampleWorld = {
  id: string;
  name: string;
  description: string;
  seed: string;
  topography: TTopography;
};

/** Hand-picked seeds (default sea level, nations and detail) that show off what the generator can do. */
export const SAMPLE_WORLDS: readonly TSampleWorld[] = [
  {
    id: 'heartland',
    name: 'Green Heartland',
    description: 'One big land with many rivers and every climate',
    seed: 'sample-balanced-3',
    topography: 'balanced',
  },
  {
    id: 'crown',
    name: 'Crown Continent',
    description: 'A wide continent with long rivers',
    seed: 'sample-continental-1',
    topography: 'continental',
  },
  {
    id: 'peaks',
    name: 'Mountain Realms',
    description: 'Ranges that split the land into valleys',
    seed: 'sample-ranges-9',
    topography: 'ranges',
  },
  {
    id: 'frozen',
    name: 'Frozen Isles',
    description: 'Cold islands of tundra and ice',
    seed: 'sample-ranges-8',
    topography: 'ranges',
  },
  {
    id: 'isles',
    name: 'Scattered Isles',
    description: 'Several large islands split by the sea',
    seed: 'sample-balanced-14',
    topography: 'balanced',
  },
  {
    id: 'thousand',
    name: 'Thousand Isles',
    description: 'Many small islands and wide sea lanes',
    seed: 'sample-archipelago-4',
    topography: 'archipelago',
  },
  {
    id: 'rift',
    name: 'The Great Rift',
    description: 'Land torn by long rift valleys',
    seed: 'sample-rifted-4',
    topography: 'rifted',
  },
  {
    id: 'ashen',
    name: 'Ashen Fires',
    description: 'Volcanic land, hot and rugged',
    seed: 'sample-volcanic-10',
    topography: 'volcanic',
  },
];
