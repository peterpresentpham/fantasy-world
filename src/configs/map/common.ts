import { TClimateControl, TDisplaySettings, TTopography } from 'src/global';

export const NATION_COLORS = [
  '#e6194b',
  '#3cb44b',
  '#ffe119',
  '#4363d8',
  '#f58231',
  '#911eb4',
  '#46f0f0',
  '#f032e6',
  '#bcf60c',
  '#ff8c00',
  '#adff2f',
  '#ff00ff',
  '#1e90ff',
  '#fa8072',
  '#ffd700',
  '#00ff7f',
  '#ff1493',
  '#ff4500',
  '#daa520',
  '#00ced1',
  '#ffdead',
  '#4b0082',
  '#b22222',
  '#4d4dc1',
  '#9a6324',
  '#008080',
  '#e6beff',
  '#fffac8',
  '#aaffc3',
  '#ffd8b1',
  '#fabebe',
  '#7fffd4',
  '#2e8b57',
  '#8b008b',
  '#bc8f8f',
  '#ff69b4',
  '#32cd32',
  '#ff6347',
  '#ba55d3',
  '#20b2aa',
];

type TConfig = {
  width: number;
  height: number;
  seed: string;
  cellCount: number;
  minCells: number;
  maxCells: number;
  seaLevel: number;
  topography: TTopography;
  nationCount: number;
  climateControl: TClimateControl;
  displaySettings: TDisplaySettings;
};

export const DEFAULT_CONFIG: TConfig = {
  width: 1200,
  height: 760,
  seed: 'world-001',
  cellCount: 15000,
  minCells: 4000,
  maxCells: 15000,
  seaLevel: 0.5,
  topography: 'balanced',
  nationCount: 10,
  climateControl: {
    temperatureOffset: 0.2,
    temperatureContrast: 1.5,
    precipitationScale: 1.5,
    precipitationOffset: 0.3,
    humanImpact: 0.5,
  },
  displaySettings: {
    landform: false,
    landformRelief: false,
    biome: false,
    biomeRelief: true,
    isometric: false,
    threeDim: false,
    population: false,
    temperature: false,
    precipitation: false,
    rainShadow: false,
    economy: false,
    rivers: false,
    nationBorders: false,
    nationFill: false,
    provinceBorders: false,
    ethnicBorders: false,
    ethnicFill: false,
    ethnicLabels: false,
    labels: false,
    cellData: false,
  },
};
