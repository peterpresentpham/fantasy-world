'use client';

import { Button } from 'src/components/ui/button';
import { ButtonGroup } from 'src/components/ui/button-group';
import { VIEW_MODES } from 'src/configs/map/viewPresets';
import { applyViewMode, getViewMode } from 'src/services/utils/viewPreset';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';

export default function ViewModeSwitch() {
  const displaySettings = useMapExplorerStore((s) => s.displaySettings);
  const setDisplaySettings = useMapExplorerStore((s) => s.setDisplaySettings);
  const mode = getViewMode(displaySettings);

  return (
    <ButtonGroup aria-label="View mode">
      {VIEW_MODES.map((option) => (
        <Button
          key={option.id}
          type="button"
          size="sm"
          variant={mode === option.id ? 'default' : 'ghost'}
          aria-pressed={mode === option.id}
          onClick={() => setDisplaySettings(applyViewMode(displaySettings, option.id))}
        >
          {option.label}
        </Button>
      ))}
    </ButtonGroup>
  );
}
