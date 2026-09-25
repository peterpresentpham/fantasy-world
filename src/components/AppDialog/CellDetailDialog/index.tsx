'use client';

import { XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from 'src/components/ui/button';
import { ButtonGroup } from 'src/components/ui/button-group';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'src/components/ui/dialog';
import { TDelaunayMesh } from 'src/types/global';
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

  if (!hasNation && !hasEthnic) {
    return (
      <Dialog open={open} onOpenChange={onOpenAction}>
        <DialogContent className="max-w-xl sm:max-w-none">
          <DialogHeader>
            <DialogTitle>Cell Detail</DialogTitle>
            <DialogDescription>No data available for this cell.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const views: { key: TView; label: string; available: boolean }[] = [
    { key: 'nation', label: 'Nation', available: hasNation },
    { key: 'ethnic', label: 'Ethnic', available: hasEthnic },
  ];

  const availableViews = views.filter((v) => v.available);

  return (
    <Dialog open={open} onOpenChange={onOpenAction}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/30"
        className="fixed inset-0 top-0 left-0 z-50 flex h-dvh w-dvw max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-none bg-black/30 p-0 sm:max-w-none md:inset-auto md:top-1/2 md:left-1/2 md:h-[calc(100dvh-2rem)] md:w-[min(72rem,calc(100dvw-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:bg-black/40"
      >
        <DialogTitle className="sr-only">
          {view === 'nation' && nation ? `Nation #${nation.id} details` : 'Ethnic group details'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Population, economy, and territory breakdown for the selected {view}.
        </DialogDescription>

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
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon-sm">
                <XIcon />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm md:p-6">
          {view === 'nation' && nationData && nation && (
            <NationDetail nation={nation} data={nationData} mesh={mesh} />
          )}
          {view === 'ethnic' && ethnicData && <EthnicDetail data={ethnicData} mesh={mesh} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
