import { useEffect } from 'react';
import BlurCard from 'src/components/BlurCard';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { useMapContext } from 'src/contexts/map.context';
import { useLogisticsGameStore } from 'src/store/logisticsGameStore';

export default function LogisticsGamePanel() {
  const { mesh } = useMapContext();
  const {
    enabled,
    startCellId,
    goalCellId,
    budget,
    roadEdges,
    routeDistance,
    routeRisk,
    routeScore,
    routeTotalCost,
    setEnabled,
    recalculateRoute,
    buildRoadOnCurrentRoute,
    resetRouteSelection,
    resetGame,
  } = useLogisticsGameStore();

  useEffect(() => {
    if (!enabled) return;
    recalculateRoute(mesh);
  }, [enabled, mesh, recalculateRoute, startCellId, goalCellId, roadEdges]);

  return (
    <BlurCard title="Logistics">
      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <Input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="size-4 accent-amber-500"
          />
          <span>Enable logistics game</span>
        </label>
        <p className="fantasy-text-muted text-xs">
          Click map cells: first click sets <b>Start</b>, second click sets <b>Goal</b>.
        </p>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <span className="fantasy-text-muted">Start</span>
          <span>{startCellId ?? '-'}</span>
          <span className="fantasy-text-muted">Goal</span>
          <span>{goalCellId ?? '-'}</span>
          <span className="fantasy-text-muted">Budget</span>
          <span>{budget}</span>
          <span className="fantasy-text-muted">Road Edges</span>
          <span>{roadEdges.length}</span>
          <span className="fantasy-text-muted">Cost</span>
          <span>{routeTotalCost.toFixed(2)}</span>
          <span className="fantasy-text-muted">Distance</span>
          <span>{routeDistance}</span>
          <span className="fantasy-text-muted">Risk</span>
          <span>{routeRisk.toFixed(2)}</span>
          <span className="fantasy-text-muted">Score</span>
          <span>{routeScore.toFixed(1)}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={buildRoadOnCurrentRoute}
            disabled={!enabled || routeDistance < 2 || budget < 2}
          >
            Build Road On Route
          </Button>
          <Button type="button" onClick={resetRouteSelection}>
            Clear A/B
          </Button>
          <Button type="button" onClick={resetGame}>
            Reset
          </Button>
        </div>
      </div>
    </BlurCard>
  );
}
