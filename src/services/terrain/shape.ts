import { TMesh } from 'src/types/global';
import { distanceToSegment } from 'src/services/utils/geometry';
import { clamp, smoothStep } from 'src/services/utils/math';

type TRangeBandOptions = {
  count: number;
  amplitude: number;
  width: number;
};

type TValleyBandOptions = {
  count: number;
  depth: number;
  width: number;
};

type TArchipelagoOptions = {
  majorIslandCount: number;
  mediumIslandCount: number;
  smallIslandCount: number;
};

type TIslandSeed = {
  x: number;
  y: number;
  radius: number;
  amplitude: number;
};

function sampleDeterministicDetail(x: number, y: number, seed: number) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 0.01031) * 43758.5453;
  return Math.abs(value - Math.floor(value));
}

export function smoothElevations(mesh: TMesh, elevations: Float32Array, factor: number) {
  const smoothed = new Float32Array(elevations.length);

  for (let cellIndex = 0; cellIndex < mesh.cells.length; cellIndex += 1) {
    let total = elevations[cellIndex];

    for (const neighborId of mesh.cells[cellIndex].neighbors) {
      total += elevations[neighborId];
    }
    const average = total / (mesh.cells[cellIndex].neighbors.length + 1);
    smoothed[cellIndex] = clamp(elevations[cellIndex] * (1 - factor) + average * factor, 0, 1);
  }
  elevations.set(smoothed);
}

export function applyEdgeShelf(
  mesh: TMesh,
  elevations: Float32Array,
  strength: number,
  seed: number
) {
  for (let cellIndex = 0; cellIndex < mesh.cells.length; cellIndex += 1) {
    const [x, y] = mesh.cells[cellIndex].site;
    const nx = x / mesh.width;
    const ny = y / mesh.height;
    const edgeDistance = Math.min(nx, 1 - nx, ny, 1 - ny);
    const shelf = smoothStep((edgeDistance - 0.02) / 0.24);
    const coastalDetail =
      (sampleDeterministicDetail(nx * 3.1, ny * 3.1, seed + cellIndex) - 0.5) * 0.18;

    elevations[cellIndex] = clamp(
      elevations[cellIndex] * (1 - strength) +
        (elevations[cellIndex] + coastalDetail) * shelf * strength,
      0,
      1
    );
  }
}

export function applyRangeBands(
  mesh: TMesh,
  random: () => number,
  elevations: Float32Array,
  { count, amplitude, width }: TRangeBandOptions
) {
  const diagonal = Math.sqrt(mesh.width ** 2 + mesh.height ** 2);

  for (let bandIndex = 0; bandIndex < count; bandIndex += 1) {
    const centerX = random() * mesh.width;
    const centerY = random() * mesh.height;
    const theta = random() * Math.PI * 2;
    const halfLength = diagonal * (0.14 + random() * 0.22);
    const x1 = clamp(centerX - Math.cos(theta) * halfLength, 0, mesh.width);
    const y1 = clamp(centerY - Math.sin(theta) * halfLength, 0, mesh.height);
    const x2 = clamp(centerX + Math.cos(theta) * halfLength, 0, mesh.width);
    const y2 = clamp(centerY + Math.sin(theta) * halfLength, 0, mesh.height);

    for (let cellIndex = 0; cellIndex < mesh.cells.length; cellIndex += 1) {
      const [x, y] = mesh.cells[cellIndex].site;
      const distance = distanceToSegment(x, y, { x1, y1, x2, y2 }) / diagonal;
      const influence = clamp(1 - distance / width, 0, 1);
      if (influence === 0) continue;

      const ridgeVariation = 0.65 + sampleDeterministicDetail(x * 0.02, y * 0.02, bandIndex) * 0.7;
      elevations[cellIndex] = clamp(
        elevations[cellIndex] + amplitude * influence * influence * ridgeVariation,
        0,
        1
      );
    }
  }
}

export function applyRangeChains(
  mesh: TMesh,
  random: () => number,
  elevations: Float32Array,
  { count, amplitude, width }: TRangeBandOptions
) {
  const diagonal = Math.sqrt(mesh.width ** 2 + mesh.height ** 2);
  const chainCount = Math.max(4, Math.floor(count * 0.75));

  for (let chainIndex = 0; chainIndex < chainCount; chainIndex += 1) {
    const centerX = random() * mesh.width;
    const centerY = random() * mesh.height;
    const theta = random() * Math.PI * 2;
    const segments = 2 + Math.floor(random() * 3);
    const stepLength = diagonal * (0.085 + random() * 0.05);
    const ridgeWidth = width * (0.8 + random() * 0.35);

    let px = centerX;
    let py = centerY;

    for (let segmentIndex = 0; segmentIndex < segments; segmentIndex += 1) {
      const localTheta = theta + (random() - 0.5) * 0.65;
      const nx = clamp(px + Math.cos(localTheta) * stepLength, 0, mesh.width);
      const ny = clamp(py + Math.sin(localTheta) * stepLength, 0, mesh.height);
      const segmentAmplitude = amplitude * (0.78 + random() * 0.45);

      for (let cellIndex = 0; cellIndex < mesh.cells.length; cellIndex += 1) {
        const [x, y] = mesh.cells[cellIndex].site;
        const distance = distanceToSegment(x, y, { x1: px, y1: py, x2: nx, y2: ny }) / diagonal;
        const influence = clamp(1 - distance / ridgeWidth, 0, 1);
        if (influence === 0) continue;

        const ridgeVariation =
          0.72 +
          sampleDeterministicDetail(x * 0.017, y * 0.017, chainIndex * 97 + segmentIndex) * 0.55;
        elevations[cellIndex] = clamp(
          elevations[cellIndex] + segmentAmplitude * influence * influence * ridgeVariation,
          0,
          1
        );
      }
      px = nx;
      py = ny;
    }
  }
}

export function applyValleyBands(
  mesh: TMesh,
  random: () => number,
  elevations: Float32Array,
  { count, depth, width }: TValleyBandOptions
) {
  const diagonal = Math.sqrt(mesh.width ** 2 + mesh.height ** 2);

  for (let valleyIndex = 0; valleyIndex < count; valleyIndex += 1) {
    const centerX = random() * mesh.width;
    const centerY = random() * mesh.height;
    const theta = random() * Math.PI * 2;
    const halfLength = diagonal * (0.12 + random() * 0.18);
    const bend = (random() - 0.5) * diagonal * 0.08;
    const x1 = clamp(centerX - Math.cos(theta) * halfLength, 0, mesh.width);
    const y1 = clamp(centerY - Math.sin(theta) * halfLength + bend, 0, mesh.height);
    const x2 = clamp(centerX + Math.cos(theta) * halfLength, 0, mesh.width);
    const y2 = clamp(centerY + Math.sin(theta) * halfLength - bend, 0, mesh.height);

    for (let cellIndex = 0; cellIndex < mesh.cells.length; cellIndex += 1) {
      const [x, y] = mesh.cells[cellIndex].site;
      const distance = distanceToSegment(x, y, { x1, y1, x2, y2 }) / diagonal;
      const influence = clamp(1 - distance / width, 0, 1);
      if (influence === 0) continue;

      const valleyVariation =
        0.8 + sampleDeterministicDetail(x * 0.03, y * 0.03, valleyIndex) * 0.4;
      elevations[cellIndex] = clamp(
        elevations[cellIndex] - depth * influence * influence * valleyVariation,
        0,
        1
      );
    }
  }
}

function buildIslandSeeds(random: () => number, options: TArchipelagoOptions): TIslandSeed[] {
  const seeds: TIslandSeed[] = [];

  for (let index = 0; index < options.majorIslandCount; index += 1) {
    seeds.push({
      x: 0.14 + random() * 0.72,
      y: 0.14 + random() * 0.72,
      radius: 0.16 + random() * 0.11,
      amplitude: 0.55 + random() * 0.12,
    });
  }

  for (let index = 0; index < options.mediumIslandCount; index += 1) {
    seeds.push({
      x: 0.06 + random() * 0.88,
      y: 0.06 + random() * 0.88,
      radius: 0.09 + random() * 0.08,
      amplitude: 0.32 + random() * 0.13,
    });
  }

  for (let index = 0; index < options.smallIslandCount; index += 1) {
    seeds.push({
      x: 0.03 + random() * 0.94,
      y: 0.03 + random() * 0.94,
      radius: 0.04 + random() * 0.045,
      amplitude: 0.18 + random() * 0.11,
    });
  }

  return seeds;
}

export function applyArchipelago(
  mesh: TMesh,
  random: () => number,
  elevations: Float32Array,
  options: TArchipelagoOptions
) {
  const seeds = buildIslandSeeds(random, options);

  for (let cellIndex = 0; cellIndex < mesh.cells.length; cellIndex += 1) {
    const [x, y] = mesh.cells[cellIndex].site;
    const nx = x / mesh.width;
    const ny = y / mesh.height;
    let islandElevation = 0;

    for (const seed of seeds) {
      const dx = nx - seed.x;
      const dy = ny - seed.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const influence = Math.exp(-((distance * distance) / (2 * seed.radius * seed.radius)));
      islandElevation += seed.amplitude * influence;
    }

    // Keep channels between island groups to avoid one merged super-island.
    const channelNoise = sampleDeterministicDetail(nx * 5.5, ny * 5.5, cellIndex) * 0.22;
    const baseOcean = 0.08 + (sampleDeterministicDetail(nx * 1.8, ny * 1.8, 717) - 0.5) * 0.06;

    elevations[cellIndex] = clamp(baseOcean + islandElevation - channelNoise, 0, 1);
  }
}

// Like range bands but stochastic — scattered hill clusters.
export function applyHillBands(
  mesh: TMesh,
  random: () => number,
  elevations: Float32Array,
  count: number,
  amplitude: number,
  width: number
) {
  const diagonal = Math.hypot(mesh.width, mesh.height);

  for (let bandIndex = 0; bandIndex < count; bandIndex += 1) {
    const cx = random() * mesh.width;
    const cy = random() * mesh.height;
    const theta = random() * Math.PI * 2;
    const halfLength = diagonal * (0.06 + random() * 0.12);
    const x1 = clamp(cx - Math.cos(theta) * halfLength, 0, mesh.width);
    const y1 = clamp(cy - Math.sin(theta) * halfLength, 0, mesh.height);
    const x2 = clamp(cx + Math.cos(theta) * halfLength, 0, mesh.width);
    const y2 = clamp(cy + Math.sin(theta) * halfLength, 0, mesh.height);
    const hillWidth = width * (0.7 + random() * 0.6);

    for (let cellIndex = 0; cellIndex < mesh.cells.length; cellIndex += 1) {
      const [x, y] = mesh.cells[cellIndex].site;
      const dist = distanceToSegment(x, y, { x1, y1, x2, y2 }) / diagonal;
      const influence = clamp(1 - dist / hillWidth, 0, 1);
      if (influence === 0) continue;

      // Stochastic scatter — only some cells get hills (noise > threshold)
      const noiseVal = sampleDeterministicDetail(x * 0.035, y * 0.035, bandIndex * 31);
      if (noiseVal < 0.35) continue;

      elevations[cellIndex] = clamp(
        elevations[cellIndex] + amplitude * influence * influence * noiseVal,
        0,
        1
      );
    }
  }
}

// Broad flat elevated regions with steep edges.
export function applyPlateaus(
  mesh: TMesh,
  random: () => number,
  elevations: Float32Array,
  count: number,
  elevation: number,
  radiusFraction: number
) {
  const diagNorm = Math.hypot(mesh.width, mesh.height);

  for (let pIdx = 0; pIdx < count; pIdx += 1) {
    const cx = (0.12 + random() * 0.76) * mesh.width;
    const cy = (0.12 + random() * 0.76) * mesh.height;
    const plateauRadius = diagNorm * radiusFraction * (0.7 + random() * 0.6);
    const targetElev = elevation * (0.8 + random() * 0.4);
    const steepness = 3 + random() * 4; // 3-7: higher = steeper edge

    for (let cellIndex = 0; cellIndex < mesh.cells.length; cellIndex += 1) {
      const [x, y] = mesh.cells[cellIndex].site;
      const dist = Math.hypot(x - cx, y - cy) / plateauRadius;
      if (dist > 1.5) continue;

      const edgeWidth = 1 / steepness;
      let liftFactor: number;

      if (dist < 1 - edgeWidth) {
        liftFactor = 1; // Flat top
      } else if (dist < 1) {
        // Smooth transition
        const t = (dist - (1 - edgeWidth)) / edgeWidth;
        liftFactor = 1 - smoothStep(t);
      } else {
        // Slight basin at foot
        const t = (dist - 1) / 0.5;
        liftFactor = -0.3 * Math.exp(-t * t);
      }

      const current = elevations[cellIndex];
      const target = current + targetElev * liftFactor;
      elevations[cellIndex] = clamp(Math.max(current, target), 0, 1);
    }
  }
}

// Localised shield-volcano domes with optional caldera.
export function applyHotspots(mesh: TMesh, random: () => number, elevations: Float32Array) {
  const hotspotCount = 1 + Math.floor(random() * 3);
  const diagNorm = Math.hypot(mesh.width, mesh.height);

  for (let h = 0; h < hotspotCount; h += 1) {
    const cx = random() * mesh.width;
    const cy = random() * mesh.height;
    const baseRadius = diagNorm * (0.03 + random() * 0.06);
    const peakElev = 0.2 + random() * 0.25;
    const hasCaldera = random() > 0.5;
    const calderaR = baseRadius * (0.12 + random() * 0.12);

    for (let cellIndex = 0; cellIndex < mesh.cells.length; cellIndex += 1) {
      const [x, y] = mesh.cells[cellIndex].site;
      const dist = Math.hypot(x - cx, y - cy) / baseRadius;
      if (dist > 2.5) continue;

      let lift: number;
      if (hasCaldera && dist < calderaR / baseRadius) {
        const t = dist / (calderaR / baseRadius);
        lift = peakElev * (0.3 + t * 0.7);
      } else {
        lift = peakElev / (1 + dist * dist * 1.5);
      }

      elevations[cellIndex] = clamp(elevations[cellIndex] + lift, 0, 1);
    }
  }
}

// Sharp elevation drop along a line (rifted margins, fault scarps).
export function applyEscarpments(mesh: TMesh, random: () => number, elevations: Float32Array) {
  const escarpCount = 1 + Math.floor(random() * 3);
  const diagNorm = Math.hypot(mesh.width, mesh.height);

  for (let e = 0; e < escarpCount; e += 1) {
    const cx = random() * mesh.width;
    const cy = random() * mesh.height;
    const theta = random() * Math.PI * 2;
    const halfLength = diagNorm * (0.15 + random() * 0.18);
    const drop = 0.05 + random() * 0.08;
    const cliffWidth = diagNorm * (0.015 + random() * 0.015);
    const highSide = random() > 0.5 ? 1 : -1;

    const x1 = clamp(cx - Math.cos(theta) * halfLength, 0, mesh.width);
    const y1 = clamp(cy - Math.sin(theta) * halfLength, 0, mesh.height);
    const x2 = clamp(cx + Math.cos(theta) * halfLength, 0, mesh.width);
    const y2 = clamp(cy + Math.sin(theta) * halfLength, 0, mesh.height);

    for (let cellIndex = 0; cellIndex < mesh.cells.length; cellIndex += 1) {
      const [x, y] = mesh.cells[cellIndex].site;
      const dist = distanceToSegment(x, y, { x1, y1, x2, y2 });
      if (dist > cliffWidth * 2) continue;

      // Signed distance to determine which side of the line
      const crossProd = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1);
      const side = crossProd > 0 ? 1 : -1;

      if (side !== highSide) continue;

      const influence = clamp(1 - dist / cliffWidth, 0, 1);
      elevations[cellIndex] = clamp(elevations[cellIndex] - drop * influence * influence, 0, 1);
    }
  }
}
