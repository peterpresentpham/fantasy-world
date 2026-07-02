import type { TSiteMetadata, TTopographyOption } from 'src/global';
import { TOPOGRAPHY_PRESET_CONFIG } from './map/topography';
import { ImageAsset } from './ImageAssets';

export const APP_NAME = 'Fantasy World';

export const siteMetadata: TSiteMetadata = {
  title: APP_NAME,
  description:
    'Procedural fantasy world map generator with deterministic seeds, terrain simulation, hydrology, nations, and ethnic regions.',
  url: 'https://fantasy.peter-present.xyz/',
  siteName: APP_NAME,
  twitterHandle: 'PhamHon08928762',
  icon: ImageAsset.icon,
  image: ImageAsset.thumbnail,
  keywords:
    'fantasy map generator, procedural world generation, seeded map generation, world building tool, terrain and river simulation, nation borders, ethnic regions',
};

const TOPOGRAPHY_LABEL_MAP: Record<keyof typeof TOPOGRAPHY_PRESET_CONFIG, string> = {
  balanced: 'Balanced',
  archipelago: 'Archipelago',
  ranges: 'Ranges',
  rifted: 'Rifted',
  volcanic: 'Volcanic',
  continental: 'Continental',
};

export const TOPOGRAPHY_OPTIONS: TTopographyOption[] = (
  Object.keys(TOPOGRAPHY_PRESET_CONFIG) as (keyof typeof TOPOGRAPHY_PRESET_CONFIG)[]
).map((key) => ({ label: TOPOGRAPHY_LABEL_MAP[key], value: key }));
