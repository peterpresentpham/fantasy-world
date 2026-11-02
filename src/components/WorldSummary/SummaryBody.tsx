'use client';

import { getNationColor } from 'src/services/utils';
import { formatCount, TWorldSummary } from 'src/services/utils/worldSummary';

type TProps = {
  summary: TWorldSummary;
  onPickNation: (nationId: number) => void;
};

/** The facts and the nation list of a world summary, shared by the desktop card and the phone sheet. */
export default function SummaryBody({ summary, onPickNation }: TProps) {
  return (
    <div className="min-h-0 space-y-2 text-xs">
      <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5">
        <dt className="text-muted-foreground">Nations</dt>
        <dd>{summary.nationCount}</dd>
        <dt className="text-muted-foreground">Peoples</dt>
        <dd>{summary.ethnicCount}</dd>
        <dt className="text-muted-foreground">Population</dt>
        <dd>{formatCount(summary.population)}</dd>
        <dt className="text-muted-foreground">Land</dt>
        <dd>{summary.landPercent}%</dd>
        <dt className="text-muted-foreground">Rivers</dt>
        <dd>{summary.riverCount}</dd>
      </dl>
      {summary.longestRiver && (
        <p className="text-muted-foreground">
          Longest river: <span className="text-foreground">{summary.longestRiver.name}</span>
        </p>
      )}
      <ul aria-label="Nations by population" className="space-y-0.5">
        {summary.nations.map((nation) => (
          <li key={nation.id}>
            <button
              type="button"
              className="hover:bg-accent flex w-full items-center gap-2 rounded px-1 py-0.5 text-left"
              onClick={() => onPickNation(nation.id)}
            >
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: getNationColor(nation.id) }}
              />
              <span className="truncate">{nation.name}</span>
              <span className="text-muted-foreground ml-auto">
                {formatCount(nation.population)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
