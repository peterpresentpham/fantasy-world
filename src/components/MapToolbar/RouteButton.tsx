'use client';

import { Route } from 'lucide-react';
import { Button } from 'src/components/ui/button';
import useLogisticsRoute from 'src/hooks/useLogisticsRoute';
import { useLogisticsGameStore } from 'src/store/logisticsGameStore';

function hintFor(start: number | null, goal: number | null, distance: number) {
  if (start === null) return 'Click a start point';
  if (goal === null) return 'Now click a destination';
  return `Route: ${distance} cells`;
}

export default function RouteButton() {
  useLogisticsRoute();
  const enabled = useLogisticsGameStore((s) => s.enabled);
  const setEnabled = useLogisticsGameStore((s) => s.setEnabled);
  const startCellId = useLogisticsGameStore((s) => s.startCellId);
  const goalCellId = useLogisticsGameStore((s) => s.goalCellId);
  const routeDistance = useLogisticsGameStore((s) => s.routeDistance);

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant={enabled ? 'default' : 'secondary'}
        size="icon"
        aria-label="Find a route"
        aria-pressed={enabled}
        title="Find the cheapest route between two places"
        onClick={() => setEnabled(!enabled)}
      >
        <Route />
      </Button>
      {enabled && (
        <span role="status" className="text-muted-foreground text-xs">
          {hintFor(startCellId, goalCellId, routeDistance)}
        </span>
      )}
    </div>
  );
}
