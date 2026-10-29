import {
  PRESET_MANAGED_LAYERS,
  TViewMode,
  TViewPreset,
  VIEW_PRESETS,
} from 'src/configs/map/viewPresets';
import { TDisplaySettings } from 'src/types/global';

export function applyViewPreset(current: TDisplaySettings, preset: TViewPreset): TDisplaySettings {
  const next = { ...current };
  for (const layer of PRESET_MANAGED_LAYERS) next[layer] = false;
  for (const layer of preset.layers) next[layer] = true;
  return next;
}

/** The preset whose layers are exactly the enabled managed layers, or null for a custom mix. */
export function detectViewPreset(settings: TDisplaySettings): TViewPreset | null {
  const enabled = PRESET_MANAGED_LAYERS.filter((layer) => settings[layer]);
  return (
    VIEW_PRESETS.find(
      (preset) =>
        preset.layers.length === enabled.length && preset.layers.every((layer) => settings[layer])
    ) ?? null
  );
}

export function getViewMode(settings: TDisplaySettings): TViewMode {
  if (settings.threeDim) return '3d';
  if (settings.isometric) return 'iso';
  return '2d';
}

export function applyViewMode(current: TDisplaySettings, mode: TViewMode): TDisplaySettings {
  return { ...current, isometric: mode === 'iso', threeDim: mode === '3d' };
}
