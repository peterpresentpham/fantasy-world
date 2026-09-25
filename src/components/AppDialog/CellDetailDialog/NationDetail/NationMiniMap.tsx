'use client';

import { useRef, useState } from 'react';
import BlurCard from 'src/components/BlurCard';
import { Button } from 'src/components/ui/button';
import { ButtonGroup } from 'src/components/ui/button-group';
import { TDelaunayMesh } from 'src/types/global';
import useNationMiniMap, { TNationMiniMapDisplay } from 'src/hooks/useNationMiniMap';

type TProps = {
  nationId: number;
  mesh: TDelaunayMesh;
};

const DISPLAY_OPTIONS: { key: TNationMiniMapDisplay; label: string }[] = [
  { key: 'terrain', label: 'Landform' },
  { key: 'biome', label: 'Biome' },
  { key: 'nation', label: 'Nation' },
  { key: 'ethnic', label: 'Ethnic' },
];

export default function NationMiniMap({ nationId, mesh }: TProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [displayMode, setDisplayMode] = useState<TNationMiniMapDisplay>('nation');

  useNationMiniMap({ canvasRef, mesh, nationId, displayMode });

  return (
    <BlurCard title="Map" containerProps={{ className: 'space-y-3' }}>
      <div className="flex justify-center">
        <ButtonGroup className="w-full max-w-full flex-wrap justify-center">
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
