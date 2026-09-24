import { PRECIPITATION_CONFIG } from 'src/configs/map/hydrology';
import { hashSeed } from 'src/services/utils/math';
import { TCell } from 'src/types/global';

const WIND_MODEL = PRECIPITATION_CONFIG.wind;

export type TWindVector = {
  x: number;
  y: number;
  speed: number;
};

function normalize(x: number, y: number) {
  const length = Math.hypot(x, y);
  if (length <= 0.000001) return { x: 1, y: 0 };
  return { x: x / length, y: y / length };
}

function signedLatitude(y: number, height: number) {
  return (y / Math.max(1, height)) * 2 - 1;
}

function baseWind(latitude: number) {
  const absLat = Math.abs(latitude);
  const toEquator = latitude > 0 ? 1 : -1;
  const toPole = latitude > 0 ? -1 : 1;

  if (absLat <= WIND_MODEL.tradeLatMax) {
    const equatorBlend = 1 - absLat / Math.max(0.0001, WIND_MODEL.tradeLatMax);
    return {
      x: -1,
      y: toEquator * WIND_MODEL.equatorBlend * equatorBlend,
      speed: WIND_MODEL.tradeSpeed,
    };
  }

  if (absLat <= WIND_MODEL.westerlyLatMax) {
    return {
      x: 1,
      y: toPole * 0.2,
      speed: WIND_MODEL.westerlySpeed,
    };
  }

  return {
    x: -1,
    y: toEquator * 0.15,
    speed: WIND_MODEL.polarSpeed,
  };
}

export function buildWindField(cells: TCell[], height: number, seed: string): TWindVector[] {
  const noiseStrength = WIND_MODEL.noise;

  return cells.map((cell) => {
    const latitude = signedLatitude(cell.site[1], height);
    const base = baseWind(latitude);
    const noiseHash = hashSeed(`${seed}:wind:${cell.id}`);
    const noise = ((noiseHash % 10000) / 9999) * 2 - 1;
    const nx = base.x + noise * noiseStrength;
    const ny = base.y + noise * noiseStrength * 0.7;
    const direction = normalize(nx, ny);
    return {
      x: direction.x,
      y: direction.y,
      speed: base.speed,
    };
  });
}
