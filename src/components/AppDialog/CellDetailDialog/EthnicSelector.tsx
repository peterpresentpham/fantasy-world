'use client';

import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/ui/select';
import { getNationColor } from 'src/services/utils';
import { TEthnic } from 'src/types/global';

type TProps = {
  ethnics: TEthnic[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export default function EthnicSelector({ ethnics, selectedId, onSelect }: TProps) {
  const sorted = useMemo(() => [...ethnics].sort((a, b) => a.id - b.id), [ethnics]);

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
          {sorted.map((e) => (
            <SelectItem key={e.id} value={e.id.toString()}>
              <span style={{ color: getNationColor(e.id) }}>{e.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
