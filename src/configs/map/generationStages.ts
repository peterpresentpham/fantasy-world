import { TGenerationStage } from 'src/types/global';

export const GENERATION_STAGES: readonly { id: TGenerationStage; label: string }[] = [
  { id: 'mesh', label: 'Shaping the land' },
  { id: 'topography', label: 'Raising mountains and seas' },
  { id: 'hydrology', label: 'Carving rivers and climate' },
  { id: 'population', label: 'Settling the people' },
  { id: 'geopolitics', label: 'Drawing nations and borders' },
];
