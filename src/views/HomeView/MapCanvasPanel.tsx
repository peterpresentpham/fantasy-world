'use client';

import dynamic from 'next/dynamic';
import { useRef } from 'react';
import GenerationProgress from 'src/components/GenerationProgress';
import MapViewControls from 'src/components/MapViewControls';
import { useMapContext } from 'src/contexts/map.context';
import useMapViewport from 'src/hooks/useMapViewport';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';
import { useTerrainEditorStore } from 'src/store/terrainEditorStore';
import MapCanvasStage from './MapCanvasStage';

// three.js (~600KB+) is only needed when 3D mode is actually toggled on —
// loading it dynamically keeps it out of the initial page bundle.
const ThreeMapView = dynamic(() => import('./ThreeMapView'), { ssr: false });

export default function MapCanvasPanel() {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const isThree = useMapExplorerStore((s) => s.displaySettings.threeDim);
  const painting = useTerrainEditorStore((s) => s.editMode && s.selectedLandform !== null);
  const { mesh, isGenerating } = useMapContext();
  const show2D = !isThree;
  const pan = useMapViewport({ frameRef, zoomEnabled: show2D, panEnabled: show2D && !painting });

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden p-2 sm:p-0">
      <div
        ref={frameRef}
        className="relative max-h-full w-full max-w-full overflow-hidden"
        style={{
          aspectRatio: show2D ? `${mesh.width}/${mesh.height}` : undefined,
          minHeight: show2D ? undefined : '80vh',
        }}
      >
        {show2D && <MapCanvasStage pan={pan} />}
        {isThree && <ThreeMapView />}
        {show2D && <MapViewControls />}
        {isGenerating && <GenerationProgress />}
      </div>
    </div>
  );
}
