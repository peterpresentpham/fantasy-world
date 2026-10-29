import { TDisplaySettings } from 'src/types/global';

// Layers a view preset owns. Applying a preset switches all of these off first, then turns on the
// preset's own. Everything else (view mode, rivers, labels, cell data) is left as the user set it.
export const PRESET_MANAGED_LAYERS = [
  'landform',
  'landformRelief',
  'biome',
  'biomeRelief',
  'population',
  'temperature',
  'precipitation',
  'rainShadow',
  'economy',
  'nationBorders',
  'nationFill',
  'provinceBorders',
  'ethnicBorders',
  'ethnicFill',
  'ethnicLabels',
] as const satisfies readonly (keyof TDisplaySettings)[];

export type TViewPresetId =
  | 'landform'
  | 'biome'
  | 'political'
  | 'ethnic'
  | 'climate'
  | 'population';

export type TViewPreset = {
  id: TViewPresetId;
  label: string;
  layers: readonly (typeof PRESET_MANAGED_LAYERS)[number][];
};

export const VIEW_PRESETS: readonly TViewPreset[] = [
  { id: 'landform', label: 'Landform', layers: ['landform', 'landformRelief'] },
  { id: 'biome', label: 'Biome', layers: ['biomeRelief'] },
  {
    id: 'political',
    label: 'Political',
    layers: ['biomeRelief', 'nationBorders', 'nationFill', 'provinceBorders'],
  },
  {
    id: 'ethnic',
    label: 'Ethnic',
    layers: ['biomeRelief', 'ethnicBorders', 'ethnicFill', 'ethnicLabels'],
  },
  { id: 'climate', label: 'Climate', layers: ['temperature'] },
  { id: 'population', label: 'Population', layers: ['population'] },
];

export type TViewMode = '2d' | 'iso' | '3d';

export const VIEW_MODES: readonly { id: TViewMode; label: string }[] = [
  { id: '2d', label: '2D' },
  { id: 'iso', label: 'Iso' },
  { id: '3d', label: '3D' },
];
