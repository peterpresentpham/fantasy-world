'use client';

import { useRef, useState } from 'react';
import BlurCard from 'src/components/BlurCard';
import { Button } from 'src/components/ui/button';
import { ButtonGroup } from 'src/components/ui/button-group';
import useEthnicMiniMap from 'src/hooks/useEthnicMiniMap';
import { TDelaunayMesh, TEthnicMiniMapDisplay } from 'src/types/global';

type TProps = {
  ethnicId: number;
  mesh: TDelaunayMesh;
};

const DISPLAY_OPTIONS: { key: TEthnicMiniMapDisplay; label: string }[] = [
  { key: 'terrain', label: 'Landform' },
  { key: 'biome', label: 'Biome' },
  { key: 'nation', label: 'Nation' },
];

export default function EthnicMiniMap({ ethnicId, mesh }: TProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [displayMode, setDisplayMode] = useState<TEthnicMiniMapDisplay>('nation');

  useEthnicMiniMap({ canvasRef, mesh, ethnicId, displayMode });

  return (
    <BlurCard title="Map" containerProps={{ className: 'space-y-3' }}>
      <div className="flex justify-center">
        <ButtonGroup>
          {DISPLAY_OPTIONS.map((opt) => (
            <Button
              key={opt.key}
              size="xs"
              variant={displayMode === opt.key ? 'default' : 'ghost'}
              onClick={() => setDisplayMode(opt.key)}
            >
              {opt.label}
            </Button>
          ))}
        </ButtonGroup>
      </div>
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          className="max-w-full rounded border border-white/10"
          style={{ maxHeight: '420px' }}
        />
      </div>
    </BlurCard>
  );
}
