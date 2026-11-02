import { TDelaunayMesh } from 'src/types/global';
import { describe, expect, it } from 'vitest';
import { buildLegend } from './legend';

function makeMesh(nationCount: number): TDelaunayMesh {
  return {
    cells: [
      { isWater: false, landform: 'plain', biome: 'grassland' },
      { isWater: false, landform: 'mountain', biome: 'tundra' },
      { isWater: true, landform: 'marine_deep', biome: 'marine' },
    ],
    nations: Array.from({ length: nationCount }, (_, id) => ({ id, name: `Nation ${id}` })),
    ethnics: [{ id: 0, name: 'Folk' }],
  } as unknown as TDelaunayMesh;
}

describe('buildLegend', () => {
  it('lists only the landforms and biomes that exist on land', () => {
    const landform = buildLegend('landform', makeMesh(2));
    expect(landform.kind === 'swatches' && landform.items.map((item) => item.id)).toEqual([
      'plain',
      'mountain',
    ]);
    const biome = buildLegend('biome', makeMesh(2));
    expect(biome.kind === 'swatches' && biome.items.map((item) => item.id).sort()).toEqual([
      'grassland',
      'tundra',
    ]);
  });

  it('names the nations and caps a long list', () => {
    const legend = buildLegend('political', makeMesh(30));
    expect(legend.kind).toBe('swatches');
    if (legend.kind === 'swatches') {
      expect(legend.items).toHaveLength(14);
      expect(legend.items[0].label).toBe('Nation 0');
    }
  });

  it('uses a gradient for climate and population', () => {
    expect(buildLegend('climate', makeMesh(1))).toMatchObject({ kind: 'gradient', from: 'Cold' });
    expect(buildLegend('population', makeMesh(1))).toMatchObject({ kind: 'gradient', to: 'Many' });
  });
});
