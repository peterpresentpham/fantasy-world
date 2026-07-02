import { TCell, TCellStats, TDisplaySettings, TEthnic, TNation, TPoint } from 'src/global';
import {
  createLayerPlan,
  renderBackground,
  renderLandCells,
  renderRivers,
  renderWaterCells,
} from './canvas';
import { drawBordersUnified, drawCountryFill, drawEthnicFill } from './canvas/borders';
import {
  renderIsoBackgroundAndTerrain,
  renderIsoOverlays,
  renderIsoRegionFill,
} from './canvas/iso-renderer';
import { isoProjectCellPolygon, TIsoCanvasDims } from './canvas/isometric';
import { drawLogisticsRoute, drawRegionNames, drawUrbanHierarchy } from './canvas/overlays';
import { drawSiteMarker } from './canvas/primitives';
import { applyShadedRelief } from './canvas/relief';

type TIsoInputs = {
  sortedWaterCells: TCell[];
  sortedLandCells: TCell[];
  displaySettings: TDisplaySettings;
  mapCellStats: TCellStats;
  cells: TCell[];
  landCells: TCell[];
  nations: TNation[];
  ethnics: TEthnic[];
  logisticsEnabled: boolean;
  routeCellIds: number[];
  startCellId: number | null;
  goalCellId: number | null;
};

type TTopDownInputs = {
  waterCells: TCell[];
  landCells: TCell[];
  displaySettings: TDisplaySettings;
  layerPlan: ReturnType<typeof createLayerPlan>;
  mapCellStats: TCellStats;
  cells: TCell[];
  nations: TNation[];
  ethnics: TEthnic[];
  logisticsEnabled: boolean;
  routeCellIds: number[];
  startCellId: number | null;
  goalCellId: number | null;
  seaLevel: number;
};

export function renderIsometric(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  dims: TIsoCanvasDims,
  elevScale: number,
  inputs: TIsoInputs
) {
  const { ox, oy } = { ox: dims.offsetX, oy: dims.offsetY };
  const es = elevScale;
  const {
    sortedWaterCells,
    sortedLandCells,
    displaySettings,
    mapCellStats,
    cells,
    landCells,
    nations,
    ethnics,
    logisticsEnabled,
    routeCellIds,
    startCellId,
    goalCellId,
  } = inputs;

  // Background + terrain
  renderIsoBackgroundAndTerrain(
    ctx,
    canvasW,
    canvasH,
    ox,
    oy,
    es,
    sortedWaterCells,
    sortedLandCells,
    displaySettings,
    mapCellStats,
    cells
  );

  const getPoly = (poly: TPoint[], elev: number) => isoProjectCellPolygon(poly, elev, ox, oy, es);
  const getPt = (px: number, py: number, elev: number) =>
    isoProjectCellPolygon([[px, py]] as TPoint[], elev, ox, oy, es)[0];

  // Nation/Ethnic fill
  if (displaySettings.nationFill || displaySettings.ethnicFill) {
    renderIsoRegionFill(
      ctx,
      sortedLandCells,
      getPoly,
      displaySettings.nationFill,
      displaySettings.ethnicFill
    );
  }

  // Overlays (borders, rivers, labels, logistics)
  renderIsoOverlays({
    ctx,
    getPt,
    landCells,
    allCells: cells,
    displaySettings,
    nations,
    ethnics,
    logisticsEnabled,
    routeCellIds,
    startCellId,
    goalCellId,
  });
}

export function renderTopDown(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  inputs: TTopDownInputs
) {
  const {
    waterCells,
    landCells,
    displaySettings,
    layerPlan,
    mapCellStats,
    cells,
    nations,
    ethnics,
    logisticsEnabled,
    routeCellIds,
    startCellId,
    goalCellId,
    seaLevel,
  } = inputs;

  renderBackground(ctx, width, height);
  renderWaterCells(ctx, waterCells, seaLevel);
  renderLandCells(
    ctx,
    landCells,
    displaySettings as TDisplaySettings,
    layerPlan,
    mapCellStats,
    seaLevel
  );

  if (layerPlan.showShadedRelief) {
    applyShadedRelief(ctx, cells);
  }

  if (displaySettings.nationFill) drawCountryFill(ctx, cells);
  if (displaySettings.ethnicFill)
    drawEthnicFill(ctx, cells, displaySettings.landform || displaySettings.biome);

  if (displaySettings.rivers) renderRivers(ctx, cells);

  if (displaySettings.nationBorders || displaySettings.ethnicBorders) {
    drawBordersUnified(ctx, cells, {
      nation: displaySettings.nationBorders,
      ethnic: displaySettings.ethnicBorders,
      province: !!displaySettings.nationBorders && !!displaySettings.provinceBorders,
    });
  }
  if (displaySettings.nationBorders) {
    drawUrbanHierarchy(ctx, cells);
  }

  if (displaySettings.ethnicLabels) {
    drawRegionNames(ctx, cells, nations, ethnics, 'ethnic');
  } else if (displaySettings.labels) {
    if (displaySettings.ethnicFill || displaySettings.ethnicBorders) {
      drawRegionNames(ctx, cells, nations, ethnics, 'ethnic');
    } else if (displaySettings.nationBorders) {
      drawRegionNames(ctx, cells, nations, ethnics, 'nation');
    }
  }

  if (layerPlan.showSiteMarkers) {
    for (const cell of cells) {
      drawSiteMarker(ctx, cell, 1.4, cell.isWater ? '#dbeafe' : '#fef3c7', 0.22);
    }
  }

  if (logisticsEnabled) drawLogisticsRoute(ctx, cells, routeCellIds, startCellId, goalCellId);
}
