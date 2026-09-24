'use client';

import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/ui/select';
import { TNation } from 'src/types/global';
import { getNationColor } from 'src/services/utils';

type TProps = {
  nations: TNation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export default function NationSelector({ nations, selectedId, onSelect }: TProps) {
  const sorted = useMemo(() => [...nations].sort((a, b) => a.id - b.id), [nations]);

  return (
    <div className="w-40 shrink-0">
      <Select
        value={selectedId?.toString() ?? ''}
        onValueChange={(value) => onSelect(Number(value))}
      >
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="Switch&hellip;" />
        </SelectTrigger>
        <SelectContent>
          {sorted.map((n) => (
            <SelectItem key={n.id} value={n.id.toString()}>
              <span style={{ color: getNationColor(n.id) }}>{n.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
