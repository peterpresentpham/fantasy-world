import { BIOME_CONFIG, LANDFORM_CONFIG } from 'src/configs/map/landform-biome';
import { TViewPresetId } from 'src/configs/map/viewPresets';
import { TDelaunayMesh } from 'src/types/global';
import { getNationColor } from './index';

export type TLegendSwatch = { id: string; label: string; color: string };

export type TLegend =
  | { kind: 'swatches'; items: TLegendSwatch[] }
  | { kind: 'gradient'; stops: string[]; from: string; to: string };

const MAX_REGION_ITEMS = 14;

// Same endpoints as the heatmap colours in rendering/canvas/heatmap.ts
const TEMPERATURE_STOPS = ['rgb(37,99,235)', 'rgb(250,204,21)', 'rgb(220,38,38)'];
const POPULATION_STOPS = ['rgb(224,243,255)', 'rgb(8,48,107)'];

/** What the colours of the current view mean, built only from what is on this map. */
export function buildLegend(view: TViewPresetId, mesh: TDelaunayMesh): TLegend {
  const land = mesh.cells.filter((cell) => !cell.isWater);

  if (view === 'landform') {
    const present = new Set(land.map((cell) => cell.landform));
    return {
      kind: 'swatches',
      items: Object.entries(LANDFORM_CONFIG)
        .filter(([key]) => present.has(key as keyof typeof LANDFORM_CONFIG))
        .map(([key, config]) => ({ id: key, label: config.label, color: config.color })),
    };
  }

  if (view === 'biome') {
    const present = new Set(land.map((cell) => cell.biome));
    return {
      kind: 'swatches',
      items: Object.entries(BIOME_CONFIG)
        .filter(([key]) => present.has(key as keyof typeof BIOME_CONFIG))
        .map(([key, config]) => ({ id: key, label: config.label, color: config.color })),
    };
  }

  if (view === 'political') {
    return {
      kind: 'swatches',
      items: mesh.nations.slice(0, MAX_REGION_ITEMS).map((nation) => ({
        id: `nation-${nation.id}`,
        label: nation.name,
        color: getNationColor(nation.id),
      })),
    };
  }

  if (view === 'ethnic') {
    return {
      kind: 'swatches',
      items: mesh.ethnics.slice(0, MAX_REGION_ITEMS).map((ethnic) => ({
        id: `ethnic-${ethnic.id}`,
        label: ethnic.name,
        color: getNationColor(ethnic.id),
      })),
    };
  }

  if (view === 'climate') {
    return { kind: 'gradient', stops: TEMPERATURE_STOPS, from: 'Cold', to: 'Hot' };
  }
  return { kind: 'gradient', stops: POPULATION_STOPS, from: 'Few people', to: 'Many' };
}
