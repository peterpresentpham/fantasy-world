'use client';

import { Minus, Plus, ScanSearch } from 'lucide-react';
import { Button } from 'src/components/ui/button';
import { ButtonGroup } from 'src/components/ui/button-group';
import { MAX_ZOOM } from 'src/configs/map/viewport';
import { useViewportStore } from 'src/store/viewportStore';
import MapViewportMinimap from './MapViewportMinimap';

export default function MapViewControls() {
  const scale = useViewportStore((s) => s.viewport.scale);
  const zoomStep = useViewportStore((s) => s.zoomStep);
  const reset = useViewportStore((s) => s.reset);

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-col items-start gap-2">
      {scale > 1 && <MapViewportMinimap />}
      <ButtonGroup
        aria-label="Zoom"
        className="fantasy-glass-strong pointer-events-auto rounded-lg p-1"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom out"
          title="Zoom out (-)"
          disabled={scale <= 1}
          onClick={() => zoomStep(-1)}
        >
          <Minus />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Reset zoom"
          title="Reset zoom (0)"
          disabled={scale <= 1}
          onClick={reset}
        >
          <ScanSearch /> {Math.round(scale * 100)}%
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom in"
          title="Zoom in (+)"
          disabled={scale >= MAX_ZOOM}
          onClick={() => zoomStep(1)}
        >
          <Plus />
        </Button>
      </ButtonGroup>
    </div>
  );
}
