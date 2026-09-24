/* eslint-disable quotes */
import { TEthnic, TCell, TNation } from 'src/types/global';
import { isLandCell } from './borders';

type TLabelMode = 'nation' | 'ethnic';

export function drawUrbanHierarchy(context: CanvasRenderingContext2D, cells: TCell[]) {
  for (const cell of cells) {
    if (!cell.isEconomicHub && !cell.isCapital) continue;

    if (cell.isEconomicHub) {
      context.beginPath();
      context.arc(cell.site[0], cell.site[1], 3.1, 0, Math.PI * 2);
      context.fillStyle = '#111827';
      context.globalAlpha = 0.92;
      context.fill();
      context.globalAlpha = 1;
    }

    if (cell.isCapital) {
      const [x, y] = cell.site;
      const spikes = 5;
      const outerRadius = 4;
      const innerRadius = 1.6;
      let rotation = (Math.PI / 2) * 3;

      context.beginPath();
      context.moveTo(x, y - outerRadius);
      for (let index = 0; index < spikes; index += 1) {
        context.lineTo(x + Math.cos(rotation) * outerRadius, y + Math.sin(rotation) * outerRadius);
        rotation += Math.PI / spikes;
        context.lineTo(x + Math.cos(rotation) * innerRadius, y + Math.sin(rotation) * innerRadius);
        rotation += Math.PI / spikes;
      }
      context.closePath();
      context.fillStyle = '#fde047';
      context.strokeStyle = '#713f12';
      context.lineWidth = 1.2;
      context.globalAlpha = 0.97;
      context.fill();
      context.stroke();
      context.globalAlpha = 1;
    }
  }
}

export function drawLogisticsRoute(
  context: CanvasRenderingContext2D,
  cells: TCell[],
  routeCellIds: number[],
  startCellId: number | null,
  goalCellId: number | null
) {
  if (routeCellIds.length > 1) {
    context.beginPath();
    const first = cells[routeCellIds[0]];
    context.moveTo(first.site[0], first.site[1]);
    for (let index = 1; index < routeCellIds.length; index += 1) {
      const prev = cells[routeCellIds[index - 1]];
      const curr = cells[routeCellIds[index]];
      const mx = (prev.site[0] + curr.site[0]) * 0.5;
      const my = (prev.site[1] + curr.site[1]) * 0.5;
      context.quadraticCurveTo(prev.site[0], prev.site[1], mx, my);
    }
    const last = cells[routeCellIds[routeCellIds.length - 1]];
    context.lineTo(last.site[0], last.site[1]);
    context.strokeStyle = '#f59e0b';
    context.lineWidth = 3;
    context.globalAlpha = 0.95;
    context.shadowColor = '#facc15';
    context.shadowBlur = 5;
    context.lineCap = 'round';
    context.stroke();
    context.shadowBlur = 0;
    context.globalAlpha = 1;
  }

  if (startCellId !== null && cells[startCellId]) {
    const startCell = cells[startCellId];
    context.beginPath();
    context.arc(startCell.site[0], startCell.site[1], 5.2, 0, Math.PI * 2);
    context.fillStyle = '#22c55e';
    context.globalAlpha = 0.95;
    context.fill();
    context.globalAlpha = 1;
  }

  if (goalCellId !== null && cells[goalCellId]) {
    const goalCell = cells[goalCellId];
    context.beginPath();
    context.arc(goalCell.site[0], goalCell.site[1], 5.2, 0, Math.PI * 2);
    context.fillStyle = '#ef4444';
    context.globalAlpha = 0.95;
    context.fill();
    context.globalAlpha = 1;
  }
}

export function drawRegionNames(
  context: CanvasRenderingContext2D,
  cells: TCell[],
  nations: TNation[],
  ethnics: TEthnic[],
  mode: TLabelMode
) {
  const regions = mode === 'nation' ? nations : ethnics;
  const idKey = mode === 'nation' ? 'nationId' : 'ethnicId';
  const positions = new Map<number, { x: number; y: number; count: number }>();

  for (const cell of cells) {
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

  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = "600 11px 'Trebuchet MS', 'Segoe UI', sans-serif";
  context.lineWidth = 3.2;
  context.strokeStyle = 'rgba(2, 6, 23, 0.82)';
  context.fillStyle = 'rgba(241, 245, 249, 0.95)';

  for (const region of regions) {
    const pos = positions.get(region.id);
    if (!pos || pos.count < 12) continue;
    const x = pos.x / pos.count;
    const y = pos.y / pos.count;
    const name = region.name;
    context.strokeText(name, x, y);
    context.fillText(name, x, y);
  }
}
