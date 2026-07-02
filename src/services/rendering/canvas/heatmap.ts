import { BIOME_CONFIG, LANDFORM_CONFIG } from 'src/configs/map/landform-biome';
import { TCell } from 'src/global';
import { TRgbColor, clamp01, hexToRgb, interpolateColor, toRgbString } from './shared';

export function getPopulationColor(
  population: number,
  minPopulation: number,
  maxPopulation: number
) {
  const light: TRgbColor = { r: 224, g: 243, b: 255 };
  const dark: TRgbColor = { r: 8, g: 48, b: 107 };

  if (maxPopulation <= minPopulation) return toRgbString(light);
  const normalized = clamp01((population - minPopulation) / (maxPopulation - minPopulation));
  return interpolateColor(light, dark, normalized);
}

export function getTemperatureColor(
  temperature: number,
  minTemperature: number,
  maxTemperature: number
) {
  const cold: TRgbColor = { r: 37, g: 99, b: 235 };
  const mild: TRgbColor = { r: 250, g: 204, b: 21 };
  const hot: TRgbColor = { r: 220, g: 38, b: 38 };

  if (maxTemperature <= minTemperature) return toRgbString(mild);
  const normalized = clamp01((temperature - minTemperature) / (maxTemperature - minTemperature));
  if (normalized <= 0.5) {
    const blend = normalized / 0.5;
    return interpolateColor(cold, mild, blend);
  }

  const blend = (normalized - 0.5) / 0.5;
  return interpolateColor(mild, hot, blend);
}

export function getPrecipitationColor(precipitation: number) {
  const dry: TRgbColor = { r: 245, g: 158, b: 11 };
  const wet: TRgbColor = { r: 14, g: 116, b: 144 };
  const normalized = clamp01(precipitation);
  return interpolateColor(dry, wet, normalized);
}

export function getRainShadowColor(rainShadow: number) {
  const low: TRgbColor = { r: 191, g: 219, b: 254 };
  const high: TRgbColor = { r: 146, g: 64, b: 14 };
  const normalized = clamp01(rainShadow);
  return interpolateColor(low, high, normalized);
}

export function getBiomeColor(cell: TCell, seaLevel: number): string {
  const base = hexToRgb(BIOME_CONFIG[cell.biome].color);
  const elevNorm = clamp01((cell.elevation - seaLevel) / Math.max(1 - seaLevel, 0.001));

  const darkFactor = elevNorm * 0.22;
  const brightFactor = (1 - elevNorm) * 0.06;
  let tinted: TRgbColor = {
    r: Math.round(clamp01((base.r * (1 - darkFactor) + 255 * brightFactor) / 255) * 255),
    g: Math.round(clamp01((base.g * (1 - darkFactor) + 255 * brightFactor) / 255) * 255),
    b: Math.round(clamp01((base.b * (1 - darkFactor) + 255 * brightFactor) / 255) * 255),
  };

  const landformBlend =
    cell.landform === 'mountain' || cell.landform === 'volcanic_field'
      ? 0.28
      : cell.landform === 'plateau'
        ? 0.14
        : cell.landform === 'coast'
          ? 0.32
          : 0;

  if (landformBlend > 0) {
    const lf = hexToRgb(LANDFORM_CONFIG[cell.landform].color);
    tinted = {
      r: Math.round(tinted.r * (1 - landformBlend) + lf.r * landformBlend),
      g: Math.round(tinted.g * (1 - landformBlend) + lf.g * landformBlend),
      b: Math.round(tinted.b * (1 - landformBlend) + lf.b * landformBlend),
    };
  }

  return toRgbString(tinted);
}

export function getEconomyColor(economy: number, minEconomy: number, maxEconomy: number) {
  const low: TRgbColor = { r: 254, g: 240, b: 138 };
  const high: TRgbColor = { r: 120, g: 53, b: 15 };
  if (maxEconomy <= minEconomy) return toRgbString(low);

  const normalized = clamp01((economy - minEconomy) / (maxEconomy - minEconomy));
  return interpolateColor(low, high, normalized);
}
