'use client';

import { TCell, TCellStats, TDisplaySettings } from 'src/types/global';

const DEFAULT_CELL_STATS: TCellStats = {
  minPopulation: Number.POSITIVE_INFINITY,
  maxPopulation: Number.NEGATIVE_INFINITY,
  minTemperature: Number.POSITIVE_INFINITY,
  maxTemperature: Number.NEGATIVE_INFINITY,
  minEconomy: Number.POSITIVE_INFINITY,
  maxEconomy: Number.NEGATIVE_INFINITY,
};

export function computeCellStats(
  displaySettings: TDisplaySettings,
  landCells: TCell[]
): TCellStats {
  const shouldMeasurePopulation = displaySettings.population;
  const shouldMeasureTemperature = displaySettings.temperature;
  const shouldMeasureEconomy = displaySettings.economy;
  if (!shouldMeasurePopulation && !shouldMeasureTemperature && !shouldMeasureEconomy) {
    return DEFAULT_CELL_STATS;
  }

  const stats = { ...DEFAULT_CELL_STATS };
  for (const cell of landCells) {
    if (shouldMeasurePopulation) {
      if (cell.population < stats.minPopulation) stats.minPopulation = cell.population;
      if (cell.population > stats.maxPopulation) stats.maxPopulation = cell.population;
    }
    if (shouldMeasureTemperature) {
      if (cell.temperature < stats.minTemperature) stats.minTemperature = cell.temperature;
      if (cell.temperature > stats.maxTemperature) stats.maxTemperature = cell.temperature;
    }
    if (shouldMeasureEconomy) {
      if (cell.economy < stats.minEconomy) stats.minEconomy = cell.economy;
      if (cell.economy > stats.maxEconomy) stats.maxEconomy = cell.economy;
    }
  }
  return stats;
}
