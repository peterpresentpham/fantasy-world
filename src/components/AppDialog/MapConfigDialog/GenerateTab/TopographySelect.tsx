import BlurCard from 'src/components/BlurCard';
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

export default function TopographySelect() {
  const { topography, setTopography } = useMapExplorerStore();

  return (
    <BlurCard title="Topography">
      <Select value={topography} onValueChange={(value) => setTopography(value as TTopography)}>
        <SelectTrigger>
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
    </BlurCard>
  );
}
