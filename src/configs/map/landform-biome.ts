import { TBiome, TLandform } from 'src/types/global';

type TBaseConfig = {
  label: string;
  color: string;
  icon: string;
};

type TLandformConfig = TBaseConfig & {
  safetyScore: number;
  terrainFlatness: number;
};
type TBiomeConfig = TBaseConfig & { populationFactor: number };

export const LANDFORM_CONFIG: Record<TLandform, TLandformConfig> = {
  marine_deep: {
    label: 'Marine Deep',
    icon: '🌊',
    color: '#0a192f',
    safetyScore: -0.05,
    terrainFlatness: 0.5,
  },
  marine_shallow: {
    label: 'Marine Shallow',
    icon: '🏖️',
    color: '#1a3a6d',
    safetyScore: -0.05,
    terrainFlatness: 0.5,
  },
  coast: { label: 'Coast', icon: '🌅', color: '#e8c97a', safetyScore: 0.1, terrainFlatness: 0.75 },
  lake: { label: 'Lake', icon: '🏞️', color: '#1e81b0', safetyScore: -0.05, terrainFlatness: 0.5 },
  plain: { label: 'Plain', icon: '🌾', color: '#7ec850', safetyScore: 0.3, terrainFlatness: 0.9 },
  valley: { label: 'Valley', icon: '🏕️', color: '#2d7d46', safetyScore: 0.3, terrainFlatness: 0.9 },
  hills: { label: 'Hills', icon: '⛰️', color: '#a07850', safetyScore: 0.2, terrainFlatness: 0.65 },
  mountain: {
    label: 'Mountain',
    icon: '🏔️',
    color: '#78909c',
    safetyScore: -0.25,
    terrainFlatness: 0.25,
  },
  plateau: {
    label: 'Plateau',
    icon: '🗻',
    color: '#c9894a',
    safetyScore: 0.2,
    terrainFlatness: 0.65,
  },
  volcanic_field: {
    label: 'Volcanic Field',
    icon: '🌋',
    color: '#b71c1c',
    safetyScore: -0.25,
    terrainFlatness: 0.25,
  },
};

export const BIOME_CONFIG: Record<TBiome, TBiomeConfig> = {
  unknown: { label: 'Unknown', icon: '❓', color: '#546e7a', populationFactor: 0 },
  plain: { label: 'Settled Plain', icon: '🌾', color: '#a8c060', populationFactor: 1.3 },
  grassland: { label: 'Grassland', icon: '🌿', color: '#8bc34a', populationFactor: 0.95 },
  temperate_forest: {
    label: 'Temperate Forest',
    icon: '🌳',
    color: '#388e3c',
    populationFactor: 1.0,
  },
  savanna: { label: 'Savanna', icon: '🦁', color: '#d4a017', populationFactor: 0.75 },
  boreal_forest: { label: 'Boreal Forest', icon: '🌲', color: '#1b5e20', populationFactor: 0.55 },
  tropical_forest: {
    label: 'Tropical Forest',
    icon: '🌴',
    color: '#00701a',
    populationFactor: 0.55,
  },
  wetland: { label: 'Wetland', icon: '🦆', color: '#4caf82', populationFactor: 0.35 },
  steppe: { label: 'Steppe', icon: '🌾', color: '#b5945a', populationFactor: 0.45 },
  montane_shrub: { label: 'Montane Shrub', icon: '🌿', color: '#8d6e63', populationFactor: 0.28 },
  desert_cold: { label: 'Cold Desert', icon: '🌬️', color: '#b0bec5', populationFactor: 0.18 },
  desert_hot: { label: 'Hot Desert', icon: '☀️', color: '#f4a100', populationFactor: 0.08 },
  tundra: { label: 'Tundra', icon: '🌨️', color: '#90a4ae', populationFactor: 0.12 },
  ice: { label: 'Ice', icon: '🧊', color: '#ddeeff', populationFactor: 0.03 },
  freshwater: { label: 'Freshwater', icon: '💧', color: '#29b6f6', populationFactor: 0 },
  marine: { label: 'Marine', icon: '🐚', color: '#1565c0', populationFactor: 0 },
};
