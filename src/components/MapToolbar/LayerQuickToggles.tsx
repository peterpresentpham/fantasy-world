'use client';

import { Button } from 'src/components/ui/button';
import { ButtonGroup } from 'src/components/ui/button-group';
import { VIEW_PRESETS } from 'src/configs/map/viewPresets';
import { applyViewPreset, detectViewPreset } from 'src/services/utils/viewPreset';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';

export default function LayerQuickToggles() {
  const displaySettings = useMapExplorerStore((s) => s.displaySettings);
  const setDisplaySettings = useMapExplorerStore((s) => s.setDisplaySettings);
  const setDisplayLayer = useMapExplorerStore((s) => s.setDisplayLayer);
  const active = detectViewPreset(displaySettings);

  return (
    <div className="flex items-center gap-2">
      <ButtonGroup aria-label="Map view">
        {VIEW_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant={active?.id === preset.id ? 'default' : 'ghost'}
            aria-pressed={active?.id === preset.id}
            onClick={() => setDisplaySettings(applyViewPreset(displaySettings, preset))}
          >
            {preset.label}
          </Button>
        ))}
      </ButtonGroup>
      <ButtonGroup aria-label="Overlays">
        <Button
          type="button"
          size="sm"
          variant={displaySettings.rivers ? 'default' : 'ghost'}
          aria-pressed={displaySettings.rivers}
          onClick={() => setDisplayLayer('rivers', !displaySettings.rivers)}
        >
          Rivers
        </Button>
        <Button
          type="button"
          size="sm"
          variant={displaySettings.labels ? 'default' : 'ghost'}
          aria-pressed={displaySettings.labels}
          onClick={() => setDisplayLayer('labels', !displaySettings.labels)}
        >
          Labels
        </Button>
      </ButtonGroup>
    </div>
  );
}
