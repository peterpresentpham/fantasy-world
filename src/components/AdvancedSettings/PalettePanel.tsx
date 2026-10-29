'use client';

import { BIOME_CONFIG, LANDFORM_CONFIG } from 'src/configs/map/landform-biome';

function renderLegendItem(key: string, item: { label: string; icon: string; color: string }) {
  return (
    <div
      key={key}
      className="fantasy-glass flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">{item.icon}</span>
        <span className="font-medium">{item.label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="fantasy-text-muted text-[10px]">{item.color}</span>
        <span
          className="fantasy-border-gold inline-block size-3 rounded-full"
          style={{ backgroundColor: item.color }}
        />
      </div>
    </div>
  );
}

export default function PalettePanel() {
  const landformEntries = Object.entries(LANDFORM_CONFIG);
  const biomeEntries = Object.entries(BIOME_CONFIG);

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="fantasy-text-muted text-xs font-semibold tracking-wide uppercase">
          Landform
        </h3>
        <div className="space-y-2">
          {landformEntries.map(([key, item]) => renderLegendItem(`landform-${key}`, item))}
        </div>
      </section>
      <section className="space-y-2">
        <h3 className="fantasy-text-muted text-xs font-semibold tracking-wide uppercase">Biome</h3>
        <div className="space-y-2">
          {biomeEntries.map(([key, item]) => renderLegendItem(`biome-${key}`, item))}
        </div>
      </section>
    </div>
  );
}
