import { TCell, TRiver } from 'src/types/global';
import { accumulateFlow, fillDepressions, prepareTerrain } from './flow';
import { buildRiverGraph } from './graph';

type TRiverGenerationResult = {
  downstream: Int32Array;
  flow: Float32Array;
  effectiveFlow: Float32Array;
  riverByCell: Int32Array;
  riverWidthByCell: Float32Array;
  rivers: TRiver[];
  raisedCells: number;
};

export function generateRivers(
  cells: TCell[],
  seaLevel: number,
  precipitation: Float32Array,
  seed: string
): TRiverGenerationResult {
  const elevation = new Float32Array(cells.length);
  const isLand = new Uint8Array(cells.length);
  prepareTerrain(cells, elevation, isLand);

  const fillResult = fillDepressions(cells, elevation, isLand);
  const { downstream, flow, effectiveFlow } = accumulateFlow(
    cells,
    fillResult.filledElevation,
    isLand,
    precipitation,
    seaLevel
  );

  const { riverByCell, riverWidthByCell, rivers } = buildRiverGraph(
    cells,
    downstream,
    flow,
    effectiveFlow,
    seed
  );

  return {
    downstream,
    flow,
    effectiveFlow,
    riverByCell,
    riverWidthByCell,
    rivers,
    raisedCells: fillResult.raisedCells,
  };
}

export { sortIndicesByElevation } from './flow';
