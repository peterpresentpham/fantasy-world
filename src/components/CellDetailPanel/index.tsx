'use client';

import { ChevronDown, ChevronUp, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from 'src/components/ui/button';
import { ButtonGroup } from 'src/components/ui/button-group';
import { useMapContext } from 'src/contexts/map.context';
import useIsMobile from 'src/hooks/useIsMobile';
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
  // On a phone the panel opens as a peek (header only) so the map stays visible; tap to expand.
  const isMobile = useIsMobile();
  const expanded = useUiStore((s) => s.detailExpanded);
  const setExpanded = useUiStore((s) => s.setDetailExpanded);
  const showBody = !isMobile || expanded;

  const hasNation = nation !== undefined && nationData !== undefined;
  const hasEthnic = ethnicData !== undefined;

  useEffect(() => {
    setSelectedNationId(nationId);
    setExpanded(false);
  }, [nationId, setExpanded]);

  useEffect(() => {
    setSelectedEthnicId(ethnicId);
    setExpanded(false);
  }, [ethnicId, setExpanded]);

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
      className="fantasy-glass-strong animate-in slide-in-from-bottom sm:slide-in-from-right fixed inset-x-0 bottom-0 z-40 flex max-h-[60dvh] w-full flex-col rounded-t-2xl border-t shadow-2xl duration-200 sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[28rem] sm:max-w-md sm:rounded-none sm:border-t-0 sm:border-l lg:static lg:z-auto lg:shrink-0 lg:shadow-none"
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
            {isMobile && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={expanded ? 'Show less' : 'Show more'}
                aria-expanded={expanded}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronDown /> : <ChevronUp />}
              </Button>
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

        {showBody && (
          <div className="@container flex-1 space-y-4 overflow-x-hidden overflow-y-auto p-4 text-sm md:p-6">
            {view === 'nation' && nationData && nation && (
              <NationDetail nation={nation} data={nationData} mesh={mesh} />
            )}
            {view === 'ethnic' && ethnicData && <EthnicDetail data={ethnicData} mesh={mesh} />}
          </div>
        )}
      </div>
    </aside>
  );
}
