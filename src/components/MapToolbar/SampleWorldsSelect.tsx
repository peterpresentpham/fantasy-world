'use client';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/ui/select';
import { SAMPLE_WORLDS } from 'src/configs/map/samples';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';

export default function SampleWorldsSelect() {
  const seed = useMapExplorerStore((s) => s.seed);
  const applyWorld = useMapExplorerStore((s) => s.applyWorld);
  const current = SAMPLE_WORLDS.find((sample) => sample.seed === seed)?.id ?? '';

  return (
    <Select
      value={current}
      onValueChange={(id) => {
        const sample = SAMPLE_WORLDS.find((item) => item.id === id);
        if (sample) applyWorld(sample);
      }}
    >
      <SelectTrigger aria-label="Sample worlds" className="h-8 w-36 text-xs">
        <SelectValue placeholder="Sample worlds" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {SAMPLE_WORLDS.map((sample) => (
            <SelectItem key={sample.id} value={sample.id} title={sample.description}>
              {sample.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
