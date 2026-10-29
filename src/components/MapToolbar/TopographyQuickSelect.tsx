'use client';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/ui/select';
import { TOPOGRAPHY_OPTIONS } from 'src/configs/constance';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';
import { TTopography } from 'src/types/global';

export default function TopographyQuickSelect() {
  const topography = useMapExplorerStore((s) => s.topography);
  const setTopography = useMapExplorerStore((s) => s.setTopography);

  return (
    <Select value={topography} onValueChange={(value) => setTopography(value as TTopography)}>
      <SelectTrigger aria-label="Quick topography preset" className="h-8 w-32 text-xs">
        <SelectValue placeholder="Topography" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {TOPOGRAPHY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
