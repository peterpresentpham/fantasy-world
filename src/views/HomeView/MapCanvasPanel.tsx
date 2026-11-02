'use client';

import dynamic from 'next/dynamic';
import { useRef } from 'react';
import GenerationProgress from 'src/components/GenerationProgress';
import MapLegend from 'src/components/MapLegend';
import MapViewControls from 'src/components/MapViewControls';
import WorldSummary from 'src/components/WorldSummary';
import { useMapContext } from 'src/contexts/map.context';
import useIsMobile from 'src/hooks/useIsMobile';
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
  const isMobile = useIsMobile();
  // On a phone the frame fills the screen and the map covers it; elsewhere the frame is the map.
  const fillScreen = show2D && isMobile;
  const pan = useMapViewport({
    frameRef,
    aspect: mesh.width / mesh.height,
    zoomEnabled: show2D,
    panEnabled: show2D && !painting,
  });

  return (
    <div
      className={`flex h-full w-full items-center justify-center overflow-hidden ${fillScreen ? '' : 'p-2 sm:p-0'}`}
    >
      <div
        ref={frameRef}
        className={`relative overflow-hidden ${fillScreen ? 'h-full w-full' : 'max-h-full w-full max-w-full'}`}
        style={{
          containerType: show2D ? 'size' : undefined,
          aspectRatio: show2D && !fillScreen ? `${mesh.width}/${mesh.height}` : undefined,
          minHeight: show2D ? undefined : '80vh',
        }}
      >
        {show2D && <MapCanvasStage pan={pan} />}
        {isThree && <ThreeMapView />}
        {show2D && <MapViewControls />}
        {show2D && <MapLegend />}
        {show2D && <WorldSummary />}
        {isGenerating && <GenerationProgress />}
      </div>
    </div>
  );
}
