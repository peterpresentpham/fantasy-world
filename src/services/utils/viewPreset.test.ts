import { VIEW_PRESETS } from 'src/configs/map/viewPresets';
import { DEFAULT_CONFIG } from 'src/configs/map/common';
import { describe, expect, it } from 'vitest';
import { applyViewMode, applyViewPreset, detectViewPreset, getViewMode } from './viewPreset';

const base = DEFAULT_CONFIG.displaySettings;
const preset = (id: string) => VIEW_PRESETS.find((p) => p.id === id)!;

describe('applyViewPreset / detectViewPreset', () => {
  it('round-trips every preset', () => {
    for (const p of VIEW_PRESETS) {
      expect(detectViewPreset(applyViewPreset(base, p))?.id).toBe(p.id);
    }
  });

  it('turns off the layers of the previous preset', () => {
    const political = applyViewPreset(base, preset('political'));
    const climate = applyViewPreset(political, preset('climate'));
    expect(climate.nationBorders).toBe(false);
    expect(climate.nationFill).toBe(false);
    expect(climate.biomeRelief).toBe(false);
    expect(climate.temperature).toBe(true);
  });

  it('leaves view mode, rivers, labels and cell data untouched', () => {
    const current = { ...base, isometric: true, rivers: true, labels: true, cellData: true };
    const next = applyViewPreset(current, preset('biome'));
    expect(next.isometric).toBe(true);
    expect(next.rivers).toBe(true);
    expect(next.labels).toBe(true);
    expect(next.cellData).toBe(true);
  });

  it('reports a custom mix as no preset', () => {
    const custom = { ...applyViewPreset(base, preset('political')), population: true };
    expect(detectViewPreset(custom)).toBeNull();
  });
});

describe('view mode', () => {
  it('maps the two flags to one mode and back', () => {
    expect(getViewMode(applyViewMode(base, '2d'))).toBe('2d');
    expect(getViewMode(applyViewMode(base, 'iso'))).toBe('iso');
    expect(getViewMode(applyViewMode(base, '3d'))).toBe('3d');
  });

  it('is exclusive', () => {
    const iso = applyViewMode({ ...base, threeDim: true }, 'iso');
    expect(iso.isometric).toBe(true);
    expect(iso.threeDim).toBe(false);
  });
});
