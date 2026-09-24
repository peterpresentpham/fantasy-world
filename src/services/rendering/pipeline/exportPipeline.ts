import { BIOME_CONFIG, LANDFORM_CONFIG } from 'src/configs/map/landform-biome';
import { getRiverSegmentEndPoint } from 'src/services/rendering/canvas/primitives';
import { getNationColor, getRiverStrokeWidth } from 'src/services/utils';
import { TDelaunayMesh, TDisplaySettings, TPoint } from 'src/types/global';

function toPolygonPath(points: TPoint[]) {
  if (points.length === 0) return '';
  const [firstX, firstY] = points[0];
  const segments = points
    .slice(1)
    .map(([x, y]) => `L ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ');
  return `M ${firstX.toFixed(2)} ${firstY.toFixed(2)} ${segments} Z`;
}

export function buildMapSvg(mesh: TDelaunayMesh, displaySettings: TDisplaySettings) {
  const background = `<rect width="${mesh.width}" height="${mesh.height}" fill="#09131f" />`;
  const landLayer = mesh.cells
    .map((cell) => {
      const defaultColor = cell.isWater
        ? BIOME_CONFIG[cell.biome].color
        : LANDFORM_CONFIG[cell.landform].color;
      const color = cell.isWater
        ? defaultColor
        : displaySettings.nationFill
          ? getNationColor(cell.nationId)
          : displaySettings.ethnicFill
            ? getNationColor(cell.ethnicId)
            : displaySettings.landform
              ? LANDFORM_CONFIG[cell.landform].color
              : displaySettings.biome
                ? BIOME_CONFIG[cell.biome].color
                : defaultColor;
      const opacity = cell.isWater ? 0.95 : 0.96;
      return `<path d="${toPolygonPath(cell.polygon)}" fill="${color}" fill-opacity="${opacity}" />`;
    })
    .join('');

  const riverLayer = displaySettings.rivers
    ? mesh.cells
        .filter(
          (cell) => cell.isRiver && cell.downstreamId !== null && mesh.cells[cell.downstreamId]
        )
        .map((cell) => {
          const to = mesh.cells[cell.downstreamId as number];
          const end = getRiverSegmentEndPoint(cell, to);
          const width = getRiverStrokeWidth(cell);
          return `<line x1="${cell.site[0].toFixed(2)}" y1="${cell.site[1].toFixed(2)}" x2="${end[0].toFixed(2)}" y2="${end[1].toFixed(2)}" stroke="#00f2ff" stroke-width="${width.toFixed(2)}" stroke-linecap="round" />`;
        })
        .join('')
    : '';

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${mesh.width}" height="${mesh.height}" viewBox="0 0 ${mesh.width} ${mesh.height}">`,
    background,
    landLayer,
    riverLayer,
    '</svg>',
  ].join('');
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportCanvasToPng(canvasId: string, fileName: string) {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) return false;
  canvas.toBlob((blob) => {
    if (!blob) return;
    triggerDownload(blob, fileName);
  }, 'image/png');
  return true;
}

export function exportTextFile(content: string, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  triggerDownload(blob, fileName);
}
