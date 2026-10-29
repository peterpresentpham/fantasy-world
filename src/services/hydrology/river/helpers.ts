import { TCell, TRiverEndType, TRiverKind } from 'src/types/global';

export function riverKind(peakFlow: number): TRiverKind {
  if (peakFlow >= 150) return 'river';
  if (peakFlow >= 80) return 'fork';
  if (peakFlow >= 45) return 'branch';
  return 'creek';
}

export function createRiverName(random: () => number, id: number, kind: TRiverKind) {
  const prefixes = ['Ael', 'Bren', 'Caer', 'Dun', 'Ery', 'Fenn', 'Glen', 'Mor', 'Nyr', 'Thal'];
  const suffixByKind: Record<TRiverKind, string[]> = {
    river: ['river', 'run', 'water'],
    creek: ['creek', 'brook', 'rill'],
    branch: ['branch', 'reach', 'channel'],
    fork: ['fork', 'strand', 'stream'],
  };
  const prefix = prefixes[Math.floor(random() * prefixes.length)] ?? 'Ael';
  const suffixes = suffixByKind[kind];
  const suffix = suffixes[Math.floor(random() * suffixes.length)] ?? 'river';
  return `${prefix}-${id + 1} ${suffix}`;
}

/** A coast outlet is the sea or a lake when water touches the cell, else the river leaves the map. */
export function outletEndType(cells: TCell[], cellId: number): TRiverEndType {
  const water = cells[cellId].neighbors
    .map((neighborId) => cells[neighborId])
    .filter((c) => c.isWater);
  if (water.length === 0) return 'offscreen';
  return water.some((neighbor) => !neighbor.isLake) ? 'sea' : 'lake';
}
