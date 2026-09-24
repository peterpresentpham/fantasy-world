/* eslint-disable quotes */
'use client';

import { NATION_COLORS } from 'src/configs/map/common';
import { BIOME_CONFIG, LANDFORM_CONFIG } from 'src/configs/map/landform-biome';
import { isLandCell } from 'src/services/rendering/canvas/borders';
import {
  getEconomyColor,
  getPopulationColor,
  getPrecipitationColor,
  getRainShadowColor,
  getTemperatureColor,
} from 'src/services/rendering/canvas/heatmap';
import { findSharedEdge, isoProjectCellPolygon } from 'src/services/rendering/canvas/isometric';
import { drawPolygon } from 'src/services/rendering/canvas/shared';
import { TCell, TCellStats, TDisplaySettings, TEthnic, TNation, TPoint } from 'src/types/global';

type TGetPtFn = (px: number, py: number, elev: number) => TPoint;
type TGetPolyFn = (poly: TPoint[], elev: number) => TPoint[];

type TIsoOverlayInputs = {
  ctx: CanvasRenderingContext2D;
  getPt: TGetPtFn;
  landCells: TCell[];
  allCells: TCell[];
  displaySettings: TDisplaySettings;
  nations: TNation[];
  ethnics: TEthnic[];
  logisticsEnabled: boolean;
  routeCellIds: number[];
  startCellId: number | null;
  goalCellId: number | null;
};

function getCellFillColor(
  cell: TCell,
  displaySettings: TDisplaySettings,
  stats: TCellStats
): string {
  if (displaySettings.landform) return LANDFORM_CONFIG[cell.landform].color;
  if (displaySettings.biome) return BIOME_CONFIG[cell.biome].color;
  if (displaySettings.population) {
    return getPopulationColor(cell.population, stats.minPopulation, stats.maxPopulation);
  }
  if (displaySettings.temperature) {
    return getTemperatureColor(cell.temperature, stats.minTemperature, stats.maxTemperature);
  }
  if (displaySettings.precipitation) return getPrecipitationColor(cell.precipitation);
  if (displaySettings.rainShadow) return getRainShadowColor(cell.rainShadow);
  if (displaySettings.economy) {
    return getEconomyColor(cell.economy, stats.minEconomy, stats.maxEconomy);
  }
  return '#3f3f46';
}

function makeGetPoint(ox: number, oy: number, es: number): TGetPtFn {
  return (px: number, py: number, elev: number) =>
    isoProjectCellPolygon([[px, py]] as TPoint[], elev, ox, oy, es)[0];
}

function makeGetPoly(ox: number, oy: number, es: number): TGetPolyFn {
  return (poly: TPoint[], elev: number) => isoProjectCellPolygon(poly, elev, ox, oy, es);
}

function drawSideWall(
  ctx: CanvasRenderingContext2D,
  getPt: TGetPtFn,
  cell: TCell,
  allCells: TCell[]
) {
  for (const nbId of cell.neighbors) {
    const nb = allCells[nbId];
    if (!nb || nb.isWater) continue;
    if (cell.elevation <= nb.elevation) continue;

    const edge = findSharedEdge(cell.polygon, nb.polygon);
    if (!edge) continue;

    const [a, b] = edge;
    const aTop = getPt(a[0], a[1], cell.elevation);
    const bTop = getPt(b[0], b[1], cell.elevation);
    const aBot = getPt(a[0], a[1], nb.elevation);
    const bBot = getPt(b[0], b[1], nb.elevation);

    ctx.beginPath();
    ctx.moveTo(aTop[0], aTop[1]);
    ctx.lineTo(bTop[0], bTop[1]);
    ctx.lineTo(bBot[0], bBot[1]);
    ctx.lineTo(aBot[0], aBot[1]);
    ctx.closePath();

    const darken = 0.2 + (cell.elevation - nb.elevation) * 0.2;
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(darken, 0.5)})`;
    ctx.fill();
  }
}

export function renderIsoBackgroundAndTerrain(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  ox: number,
  oy: number,
  es: number,
  sortedWaterCells: TCell[],
  sortedLandCells: TCell[],
  displaySettings: TDisplaySettings,
  mapCellStats: TCellStats,
  allCells: TCell[]
) {
  const getPoly = makeGetPoly(ox, oy, es);
  const getPt = makeGetPoint(ox, oy, es);

  // Background
  ctx.fillStyle = '#09131f';
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Water cells
  for (const cell of sortedWaterCells) {
    const isoPoly = getPoly(cell.polygon, cell.elevation);
    drawPolygon(ctx, isoPoly);
    ctx.fillStyle = LANDFORM_CONFIG[cell.landform].color;
    ctx.fill();
  }

  // Land cells
  for (const cell of sortedLandCells) {
    const isoPoly = getPoly(cell.polygon, cell.elevation);
    const fillColor = getCellFillColor(cell, displaySettings, mapCellStats);

    drawSideWall(ctx, getPt, cell, allCells);

    drawPolygon(ctx, isoPoly);
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
}

export function renderIsoRegionFill(
  ctx: CanvasRenderingContext2D,
  sortedLandCells: TCell[],
  getPoly: TGetPolyFn,
  isNationFill: boolean,
  isEthnicFill: boolean
) {
  for (const cell of sortedLandCells) {
    const isoPoly = getPoly(cell.polygon, cell.elevation);
    drawPolygon(ctx, isoPoly);

    if (isNationFill) {
      ctx.fillStyle = NATION_COLORS[Math.abs(cell.nationId ?? 0) % NATION_COLORS.length];
    } else if (isEthnicFill) {
      ctx.fillStyle = NATION_COLORS[Math.abs(cell.ethnicId ?? 0) % NATION_COLORS.length];
    }
    ctx.fill();
  }
}

function drawIsoNationBorders(
  ctx: CanvasRenderingContext2D,
  landCells: TCell[],
  allCells: TCell[],
  getPt: TGetPtFn
) {
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.0;

  for (const cell of landCells) {
    if (cell.nationId === null) continue;
    for (const nbId of cell.neighbors) {
      const nb = allCells[nbId];
      if (!nb || nb.nationId === cell.nationId) continue;
      const edge = findSharedEdge(cell.polygon, nb.polygon);
      if (!edge) continue;
      const [a, b] = edge;
      const p1 = getPt(a[0], a[1], cell.elevation);
      const p2 = getPt(b[0], b[1], cell.elevation);
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.stroke();
    }
  }
}

function drawIsoUrbanHierarchy(ctx: CanvasRenderingContext2D, allCells: TCell[], getPt: TGetPtFn) {
  for (const cell of allCells) {
    if (!cell.isEconomicHub && !cell.isCapital) continue;
    const [sx, sy] = getPt(cell.site[0], cell.site[1], cell.elevation);

    if (cell.isEconomicHub) {
      ctx.beginPath();
      ctx.arc(sx, sy, 3.1, 0, Math.PI * 2);
      ctx.fillStyle = '#111827';
      ctx.globalAlpha = 0.92;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (cell.isCapital) {
      const spikes = 5;
      const outerRadius = 4;
      const innerRadius = 1.6;
      let rotation = (Math.PI / 2) * 3;
      ctx.beginPath();
      ctx.moveTo(sx, sy - outerRadius);
      for (let index = 0; index < spikes; index++) {
        ctx.lineTo(sx + Math.cos(rotation) * outerRadius, sy + Math.sin(rotation) * outerRadius);
        rotation += Math.PI / spikes;
        ctx.lineTo(sx + Math.cos(rotation) * innerRadius, sy + Math.sin(rotation) * innerRadius);
        rotation += Math.PI / spikes;
      }
      ctx.closePath();
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#713f12';
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.97;
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function drawIsoEthnicBorders(
  ctx: CanvasRenderingContext2D,
  landCells: TCell[],
  allCells: TCell[],
  getPt: TGetPtFn
) {
  ctx.strokeStyle = 'rgba(255,200,100,0.5)';
  ctx.lineWidth = 1.0;

  for (const cell of landCells) {
    if (cell.ethnicId === null) continue;
    for (const nbId of cell.neighbors) {
      const nb = allCells[nbId];
      if (!nb || nb.ethnicId === cell.ethnicId) continue;
      const edge = findSharedEdge(cell.polygon, nb.polygon);
      if (!edge) continue;
      const [a, b] = edge;
      const p1 = getPt(a[0], a[1], cell.elevation);
      const p2 = getPt(b[0], b[1], cell.elevation);
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.stroke();
    }
  }
}

function drawIsoProvinceBorders(
  ctx: CanvasRenderingContext2D,
  landCells: TCell[],
  allCells: TCell[],
  getPt: TGetPtFn
) {
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 0.6;

  for (const cell of landCells) {
    if (cell.provinceId === null || cell.nationId === null) continue;
    for (const nbId of cell.neighbors) {
      const nb = allCells[nbId];
      if (!nb || nb.nationId !== cell.nationId || nb.provinceId === cell.provinceId) continue;
      const edge = findSharedEdge(cell.polygon, nb.polygon);
      if (!edge) continue;
      const [a, b] = edge;
      const p1 = getPt(a[0], a[1], cell.elevation);
      const p2 = getPt(b[0], b[1], cell.elevation);
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.stroke();
    }
  }
}

function drawIsoRivers(ctx: CanvasRenderingContext2D, allCells: TCell[], getPt: TGetPtFn) {
  ctx.strokeStyle = '#00f2ff';
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.96;
  ctx.shadowColor = '#7dd3fc';
  ctx.shadowBlur = 4;

  for (const cell of allCells) {
    if (!cell.isRiver || cell.downstreamId === null) continue;
    const dc = allCells[cell.downstreamId];
    if (!dc) continue;
    const from = getPt(cell.site[0], cell.site[1], cell.elevation);
    const to = getPt(dc.site[0], dc.site[1], dc.elevation);
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(to[0], to[1]);
    ctx.lineWidth = Math.max(0.2, Math.min(cell.riverWidth * 0.35 + 0.3, 4.5));
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function drawIsoLabels(
  ctx: CanvasRenderingContext2D,
  allCells: TCell[],
  getPt: TGetPtFn,
  labelMode: 'nation' | 'ethnic',
  nations: TNation[],
  ethnics: TEthnic[]
) {
  const regions: (TNation | TEthnic)[] = labelMode === 'nation' ? nations : ethnics;
  const idKey = labelMode === 'nation' ? 'nationId' : 'ethnicId';

  const positions = new Map<number, { x: number; y: number; count: number }>();
  for (const cell of allCells) {
    if (!isLandCell(cell)) continue;
    const regionId = cell[idKey] as number | null;
    if (regionId === null || regionId < 0) continue;
    const current = positions.get(regionId);
    if (!current) {
      positions.set(regionId, { x: cell.site[0], y: cell.site[1], count: 1 });
      continue;
    }
    current.x += cell.site[0];
    current.y += cell.site[1];
    current.count += 1;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = "600 11px 'Trebuchet MS', 'Segoe UI', sans-serif";
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = 'rgba(2, 6, 23, 0.82)';
  ctx.fillStyle = 'rgba(241, 245, 249, 0.95)';

  for (const region of regions) {
    const pos = positions.get(region.id);
    if (!pos || pos.count < 12) continue;
    const [lx, ly] = getPt(pos.x / pos.count, pos.y / pos.count, 0);
    ctx.strokeText(region.name, lx, ly);
    ctx.fillText(region.name, lx, ly);
  }
}

function drawIsoLogistics(
  ctx: CanvasRenderingContext2D,
  allCells: TCell[],
  getPt: TGetPtFn,
  routeCellIds: number[],
  startCellId: number | null,
  goalCellId: number | null
) {
  if (routeCellIds.length > 1) {
    ctx.beginPath();
    const firstCell = allCells[routeCellIds[0]];
    const [fx, fy] = getPt(firstCell.site[0], firstCell.site[1], firstCell.elevation);
    ctx.moveTo(fx, fy);

    for (let index = 1; index < routeCellIds.length; index++) {
      const prevCell = allCells[routeCellIds[index - 1]];
      const currCell = allCells[routeCellIds[index]];
      const [pmx, pmy] = getPt(prevCell.site[0], prevCell.site[1], prevCell.elevation);
      const [cmx, cmy] = getPt(currCell.site[0], currCell.site[1], currCell.elevation);
      ctx.quadraticCurveTo(pmx, pmy, (pmx + cmx) * 0.5, (pmy + cmy) * 0.5);
    }

    const lastCell = allCells[routeCellIds[routeCellIds.length - 1]];
    const [lx, ly] = getPt(lastCell.site[0], lastCell.site[1], lastCell.elevation);
    ctx.lineTo(lx, ly);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.95;
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 5;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  if (startCellId !== null && allCells[startCellId]) {
    const sc = allCells[startCellId];
    const [sx, sy] = getPt(sc.site[0], sc.site[1], sc.elevation);
    ctx.beginPath();
    ctx.arc(sx, sy, 5.2, 0, Math.PI * 2);
    ctx.fillStyle = '#22c55e';
    ctx.globalAlpha = 0.95;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (goalCellId !== null && allCells[goalCellId]) {
    const gc = allCells[goalCellId];
    const [gx, gy] = getPt(gc.site[0], gc.site[1], gc.elevation);
    ctx.beginPath();
    ctx.arc(gx, gy, 5.2, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.globalAlpha = 0.95;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export function renderIsoOverlays(inputs: TIsoOverlayInputs) {
  const {
    ctx,
    getPt,
    landCells,
    allCells,
    displaySettings,
    nations,
    ethnics,
    logisticsEnabled,
    routeCellIds,
    startCellId,
    goalCellId,
  } = inputs;

  if (displaySettings.nationBorders) {
    drawIsoNationBorders(ctx, landCells, allCells, getPt);
    drawIsoUrbanHierarchy(ctx, allCells, getPt);
  }

  if (displaySettings.ethnicBorders) {
    drawIsoEthnicBorders(ctx, landCells, allCells, getPt);
  }

  if (displaySettings.provinceBorders && displaySettings.nationBorders) {
    drawIsoProvinceBorders(ctx, landCells, allCells, getPt);
  }

  if (displaySettings.rivers) {
    drawIsoRivers(ctx, allCells, getPt);
  }

  const shouldDrawLabels =
    displaySettings.ethnicLabels ||
    (displaySettings.labels &&
      (displaySettings.ethnicFill ||
        displaySettings.ethnicBorders ||
        displaySettings.nationBorders));
  if (shouldDrawLabels) {
    const labelMode =
      displaySettings.ethnicLabels || displaySettings.ethnicFill || displaySettings.ethnicBorders
        ? 'ethnic'
        : 'nation';
    drawIsoLabels(ctx, allCells, getPt, labelMode, nations, ethnics);
  }

  if (logisticsEnabled) {
    drawIsoLogistics(ctx, allCells, getPt, routeCellIds, startCellId, goalCellId);
  }
}
