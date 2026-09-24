import { TOPOGRAPHY_CONFIG } from 'src/configs/map/topography';
import { clamp } from 'src/services/utils/math';
import { TDelaunayMesh, TTopographyCell, TTopographyParams } from 'src/types/global';
import { computeBaseElevations } from './computeElevation';
import { simulateHydraulicErosion } from './erosion';
import { applyTopography } from './preset';
import { generatePlates } from './tectonics';

function buildCellTopography(elevation: number, seaLevel: number): TTopographyCell {
  return { elevation, isWater: elevation < seaLevel };
}

function reinforceHighMountains(elevations: Float32Array, seaLevel: number) {
  const landElevations: number[] = [];
  for (let index = 0; index < elevations.length; index += 1) {
    if (elevations[index] > seaLevel) landElevations.push(elevations[index]);
  }
  if (landElevations.length < 12) return elevations;

  landElevations.sort((a, b) => a - b);
  const startIndex = Math.floor(
    (landElevations.length - 1) * TOPOGRAPHY_CONFIG.mountainRecovery.quantileStart
  );
  const threshold = landElevations[startIndex];
  if (!Number.isFinite(threshold) || threshold >= 0.995) return elevations;

  const boosted = Float32Array.from(elevations);
  for (let index = 0; index < boosted.length; index += 1) {
    const elevation = boosted[index];
    if (elevation <= threshold) continue;
    const normalized = (elevation - threshold) / Math.max(0.0001, 1 - threshold);
    const uplift = normalized * normalized * TOPOGRAPHY_CONFIG.mountainRecovery.peakBoostMax;
    boosted[index] = clamp(elevation + uplift, 0, 1);
  }
  return boosted;
}

export function buildTopography(params: TTopographyParams): TDelaunayMesh {
  const { mesh, seed, seaLevel, topography } = params;

  // 1. Generate tectonic plates
  const cellSites = mesh.cells.map((c) => c.site);
  const { plates, cellPlateId } = generatePlates(seed, mesh.width, mesh.height, cellSites);

  // 2. Compute raw elevations from noise + tectonics
  const baseElevations = computeBaseElevations(mesh, seed, seaLevel, plates, cellPlateId);

  // 3. Apply terrain preset (shape modifiers)
  const presetElevations = applyTopography({ mesh, seed, topography, elevations: baseElevations });

  // 4. Reinforce high mountain peaks
  const elevations = reinforceHighMountains(presetElevations, seaLevel);

  // 5. Hydraulic erosion simulation
  const neighborMap = mesh.cells.map((c) => c.neighbors);
  const { elevations: erodedElevations } = simulateHydraulicErosion(
    elevations,
    cellSites,
    neighborMap,
    seed,
    seaLevel
  );

  // 6. Build cell objects with updated elevation/water flag
  const cells = mesh.cells.map((cell) => ({
    ...cell,
    ...buildCellTopography(erodedElevations[cell.id], seaLevel),
  }));

  return { ...mesh, cells };
}
