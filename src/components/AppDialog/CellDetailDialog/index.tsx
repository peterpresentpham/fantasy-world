'use client';

import { XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from 'src/components/ui/button';
import { ButtonGroup } from 'src/components/ui/button-group';
import { TDelaunayMesh } from 'src/global';
import useEthnicStatistic from 'src/hooks/useEthnicStatistic';
import useNationStatistic from 'src/hooks/useNationStatistic';
import { formatPopulation } from 'src/services/utils';
import EthnicDetail from './EthnicDetail';
import EthnicSelector from './EthnicSelector';
import NationDetail from './NationDetail';
import NationSelector from './NationSelector';

type TView = 'nation' | 'ethnic';

type TProps = {
  open: boolean;
  onOpenAction: (open: boolean) => void;
  nationId: number | null;
  ethnicId: number | null;
  mesh: TDelaunayMesh;
};

export default function CellDetailDialog({ open, onOpenAction, nationId, ethnicId, mesh }: TProps) {
  const [selectedNationId, setSelectedNationId] = useState(nationId);
  const [selectedEthnicId, setSelectedEthnicId] = useState(ethnicId);
  const { nation, data: nationData } = useNationStatistic(selectedNationId, mesh);
  const { data: ethnicData } = useEthnicStatistic(selectedEthnicId, mesh);
  const [view, setView] = useState<TView>('nation');

  const hasNation = nation !== undefined && nationData !== undefined;
  const hasEthnic = ethnicData !== undefined;

  useEffect(() => {
    setSelectedNationId(nationId);
  }, [nationId]);

  useEffect(() => {
    setSelectedEthnicId(ethnicId);
  }, [ethnicId]);

  useEffect(() => {
    if (!hasNation && hasEthnic) {
      setView('ethnic');
    } else if (hasNation) {
      setView('nation');
    }
  }, [hasNation, hasEthnic]);

  if (!open) return null;

  if (!hasNation && !hasEthnic) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
        <section className="fantasy-panel relative w-[min(36rem,calc(100vw-2rem))] p-6">
          <Button
            type="button"
            variant="ghost"
            className="absolute top-2 right-2"
            size="icon-sm"
            onClick={() => onOpenAction(false)}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </Button>
          <h2 className="text-lg font-medium">Cell Detail</h2>
          <p className="fantasy-text-muted mt-2 text-sm">No data available for this cell.</p>
        </section>
      </div>
    );
  }

  const views: { key: TView; label: string; available: boolean }[] = [
    { key: 'nation', label: 'Nation', available: hasNation },
    { key: 'ethnic', label: 'Ethnic', available: hasEthnic },
  ];

  const availableViews = views.filter((v) => v.available);

  return (
    <div className="fixed inset-0 z-50 bg-black/30">
      <section className="relative mx-auto flex h-dvh w-dvw flex-col bg-black/30 md:my-4 md:h-[calc(100dvh-2rem)] md:w-[min(72rem,calc(100dvw-2rem))] md:rounded-xl md:bg-black/40">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-4 py-3 md:px-6">
          <div className="min-w-0 flex-1 space-y-1">
            {view === 'nation' && nation && nationData && (
              <>
                <NationSelector
                  nations={mesh.nations}
                  selectedId={selectedNationId}
                  onSelect={setSelectedNationId}
                />
                <p className="text-sm text-white">
                  Nation #{nation.id} · {nationData.cells.length.toLocaleString()} cells ·{' '}
                  {formatPopulation(nationData.population)} people
                </p>
              </>
            )}
            {view === 'ethnic' && ethnicData && (
              <>
                <EthnicSelector
                  ethnics={mesh.ethnics}
                  selectedId={selectedEthnicId}
                  onSelect={setSelectedEthnicId}
                />
                <p className="text-sm text-white">
                  Ethnic #{ethnicData.ethnics.id} · {ethnicData.ethnicCells.length.toLocaleString()}{' '}
                  cells · {formatPopulation(ethnicData.totalPopulation)} people
                </p>
              </>
            )}
          </div>
          <div className="ml-3 flex shrink-0 items-center gap-2">
            {availableViews.length > 1 && (
              <ButtonGroup>
                {availableViews.map((v) => (
                  <Button
                    key={v.key}
                    size="xs"
                    variant={view === v.key ? 'default' : 'ghost'}
                    onClick={() => setView(v.key)}
                  >
                    {v.label}
                  </Button>
                ))}
              </ButtonGroup>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenAction(false)}
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm md:p-6">
          {view === 'nation' && nationData && nation && (
            <NationDetail nation={nation} data={nationData} mesh={mesh} />
          )}
          {view === 'ethnic' && ethnicData && <EthnicDetail data={ethnicData} mesh={mesh} />}
        </div>
      </section>
    </div>
  );
}
