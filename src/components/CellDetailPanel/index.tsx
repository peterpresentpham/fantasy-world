'use client';

import { XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from 'src/components/ui/button';
import { ButtonGroup } from 'src/components/ui/button-group';
import { useMapContext } from 'src/contexts/map.context';
import { useUiStore } from 'src/store/uiStore';
import useEthnicStatistic from 'src/hooks/useEthnicStatistic';
import useNationStatistic from 'src/hooks/useNationStatistic';
import { formatPopulation } from 'src/services/utils';
import EthnicDetail from './EthnicDetail';
import EthnicSelector from './EthnicSelector';
import NationDetail from './NationDetail';
import NationSelector from './NationSelector';

type TView = 'nation' | 'ethnic';

export default function CellDetailPanel() {
  const { mesh } = useMapContext();
  const open = useUiStore((s) => s.detailOpen);
  const nationId = useUiStore((s) => s.detailNationId);
  const ethnicId = useUiStore((s) => s.detailEthnicId);
  const closeDetail = useUiStore((s) => s.closeDetail);
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

  if (!open || (!hasNation && !hasEthnic)) return null;

  const views: { key: TView; label: string; available: boolean }[] = [
    { key: 'nation', label: 'Nation', available: hasNation },
    { key: 'ethnic', label: 'Ethnic', available: hasEthnic },
  ];

  const availableViews = views.filter((v) => v.available);

  return (
    <aside
      aria-label={view === 'nation' ? 'Nation details' : 'Ethnic group details'}
      className="fantasy-glass-strong animate-in slide-in-from-right fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l shadow-2xl duration-200 sm:w-[28rem] lg:static lg:z-auto lg:shrink-0 lg:shadow-none"
    >
      <div className="flex min-h-0 flex-1 flex-col">
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
                <p className="text-foreground text-sm">
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
                <p className="text-foreground text-sm">
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
              aria-label="Close details"
              onClick={closeDetail}
            >
              <XIcon />
            </Button>
          </div>
        </div>

        <div className="@container flex-1 space-y-4 overflow-x-hidden overflow-y-auto p-4 text-sm md:p-6">
          {view === 'nation' && nationData && nation && (
            <NationDetail nation={nation} data={nationData} mesh={mesh} />
          )}
          {view === 'ethnic' && ethnicData && <EthnicDetail data={ethnicData} mesh={mesh} />}
        </div>
      </div>
    </aside>
  );
}
