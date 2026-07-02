import { LANDFORM_CONFIG } from 'src/configs/map/landform-biome';
import { getRiverStrokeWidth } from 'src/services/utils';
import { TCell, TCellStats, TDisplaySettings } from 'src/global';
import {
  getBiomeColor,
  getEconomyColor,
  getPopulationColor,
  getPrecipitationColor,
  getRainShadowColor,
  getTemperatureColor,
} from './heatmap';
import { drawCellShape, drawRiverCurve } from './primitives';
import { clamp01, interpolateColor } from './shared';

const T_SITE_MARKER_LIMIT = 4000;
const T_UNIFORM_LAND_COLOR = '#3f3f46';
const T_TRANSPARENT_STROKE = 'transparent';

type TLayerPlan = {
  showUniformLand: boolean;
  showLandformReliefBase: boolean;
  showBiomeReliefBase: boolean;
  showShadedRelief: boolean;
  showSiteMarkers: boolean;
};

export function createLayerPlan(displaySettings: TDisplaySettings, totalCells: number): TLayerPlan {
  const showUniformLand =
    !displaySettings.landform &&
    !displaySettings.landformRelief &&
    !displaySettings.biome &&
    !displaySettings.biomeRelief &&
    !displaySettings.population &&
    !displaySettings.temperature &&
    !displaySettings.precipitation &&
    !displaySettings.rainShadow &&
    !displaySettings.economy &&
    !displaySettings.nationFill &&
    !displaySettings.ethnicFill;

  const showLandformReliefBase =
    displaySettings.landformRelief &&
    !displaySettings.landform &&
    !displaySettings.biome &&
    !displaySettings.population &&
    !displaySettings.temperature &&
    !displaySettings.precipitation &&
    !displaySettings.rainShadow &&
    !displaySettings.economy &&
    !displaySettings.nationFill &&
    !displaySettings.ethnicFill;

  const showBiomeReliefBase =
    displaySettings.biomeRelief &&
    !displaySettings.biome &&
    !displaySettings.landform &&
    !displaySettings.population &&
    !displaySettings.temperature &&
    !displaySettings.precipitation &&
    !displaySettings.rainShadow &&
    !displaySettings.economy &&
    !displaySettings.nationFill &&
    !displaySettings.ethnicFill;

  const showShadedRelief =
    (displaySettings.landformRelief || displaySettings.biomeRelief) &&
    (displaySettings.landform ||
      displaySettings.biome ||
      showLandformReliefBase ||
      showBiomeReliefBase) &&
    !displaySettings.population &&
    !displaySettings.temperature &&
    !displaySettings.precipitation &&
    !displaySettings.rainShadow &&
    !displaySettings.economy;

  const showSiteMarkers =
    (displaySettings.landform || displaySettings.biome) &&
    !displaySettings.population &&
    !displaySettings.temperature &&
    !displaySettings.precipitation &&
    !displaySettings.rainShadow &&
    !displaySettings.economy &&
    totalCells <= T_SITE_MARKER_LIMIT;

  return {
    showUniformLand,
    showLandformReliefBase,
    showBiomeReliefBase,
    showShadedRelief,
    showSiteMarkers,
  };
}

export function renderBackground(context: CanvasRenderingContext2D, width: number, height: number) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#09131f';
  context.fillRect(0, 0, width, height);
}

export function renderWaterCells(
  context: CanvasRenderingContext2D,
  waterCells: TCell[],
  seaLevel: number
) {
  for (const cell of waterCells) {
    const depthNorm = clamp01((seaLevel - cell.elevation) / Math.max(seaLevel, 0.001));
    const color = interpolateColor({ r: 26, g: 58, b: 109 }, { r: 5, g: 14, b: 30 }, depthNorm);
    drawCellShape(context, cell, color, 1, T_TRANSPARENT_STROKE, 0);
  }
}

export function renderLandCells(
  context: CanvasRenderingContext2D,
  landCells: TCell[],
  displaySettings: TDisplaySettings,
  layerPlan: TLayerPlan,
  mapCellStats: TCellStats,
  seaLevel: number
) {
  if (displaySettings.landform || layerPlan.showLandformReliefBase) {
    for (const cell of landCells) {
      drawCellShape(
        context,
        cell,
        LANDFORM_CONFIG[cell.landform].color,
        1,
        T_TRANSPARENT_STROKE,
        0
      );
    }
  }

  if (displaySettings.biome || layerPlan.showBiomeReliefBase) {
    for (const cell of landCells) {
      drawCellShape(context, cell, getBiomeColor(cell, seaLevel), 1, T_TRANSPARENT_STROKE, 0);
    }
    for (const cell of landCells) {
      const elevNorm = (cell.elevation - seaLevel) / Math.max(1 - seaLevel, 0.001);
      if (elevNorm < 0.52 || cell.temperature > 0.3) continue;
      const snowAlpha = clamp01((elevNorm - 0.52) * 2.8 + (0.3 - cell.temperature) * 2.0) * 0.8;
      if (snowAlpha < 0.05) continue;
      drawCellShape(context, cell, '#e8f4fd', snowAlpha, T_TRANSPARENT_STROKE, 0);
    }
  }

  if (displaySettings.population) {
    for (const cell of landCells) {
      drawCellShape(
        context,
        cell,
        getPopulationColor(cell.population, mapCellStats.minPopulation, mapCellStats.maxPopulation),
        1,
        T_TRANSPARENT_STROKE,
        0
      );
    }
  }

  if (displaySettings.precipitation) {
    for (const cell of landCells) {
      drawCellShape(
        context,
        cell,
        getPrecipitationColor(cell.precipitation),
        1,
        T_TRANSPARENT_STROKE,
        0
      );
    }
  }

  if (displaySettings.rainShadow) {
    for (const cell of landCells) {
      drawCellShape(context, cell, getRainShadowColor(cell.rainShadow), 1, T_TRANSPARENT_STROKE, 0);
    }
  }

  if (displaySettings.temperature) {
    for (const cell of landCells) {
      drawCellShape(
        context,
        cell,
        getTemperatureColor(
          cell.temperature,
          mapCellStats.minTemperature,
          mapCellStats.maxTemperature
        ),
        1,
        T_TRANSPARENT_STROKE,
        0
      );
    }
  }

  if (displaySettings.economy) {
    for (const cell of landCells) {
      drawCellShape(
        context,
        cell,
        getEconomyColor(cell.economy, mapCellStats.minEconomy, mapCellStats.maxEconomy),
        1,
        T_TRANSPARENT_STROKE,
        0
      );
    }
  }

  if (layerPlan.showUniformLand) {
    for (const cell of landCells) {
      drawCellShape(context, cell, T_UNIFORM_LAND_COLOR, 1, T_TRANSPARENT_STROKE, 0);
    }
  }
}

export function renderRivers(context: CanvasRenderingContext2D, cells: TCell[]) {
  context.lineCap = 'round';

  for (const cell of cells) {
    if (!cell.isRiver || cell.downstreamId === null) continue;
    const downstreamCell = cells[cell.downstreamId];
    if (!downstreamCell) continue;

    const flowNorm = clamp01(cell.flow / 600);
    const color = interpolateColor({ r: 100, g: 200, b: 232 }, { r: 21, g: 101, b: 192 }, flowNorm);
    const glowColor = interpolateColor(
      { r: 147, g: 223, b: 245 },
      { r: 66, g: 165, b: 245 },
      flowNorm
    );

    context.strokeStyle = color;
    context.globalAlpha = 0.92 + flowNorm * 0.06;
    context.shadowColor = glowColor;
    context.shadowBlur = 2 + flowNorm * 4;

    drawRiverCurve(context, cell, downstreamCell);
    context.lineWidth = getRiverStrokeWidth(cell);
    context.stroke();
  }

  context.shadowBlur = 0;
  context.globalAlpha = 1;
}
