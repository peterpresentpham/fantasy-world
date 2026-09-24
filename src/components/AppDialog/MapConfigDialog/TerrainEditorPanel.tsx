'use client';

import { LANDFORM_CONFIG } from 'src/configs/map/landform-biome';
import { Button } from 'src/components/ui/button';
import { useMapContext } from 'src/contexts/map.context';
import { cn } from 'src/lib/utils';
import { TLandform } from 'src/types/global';
import { useTerrainEditorStore } from 'src/store/terrainEditorStore';

const PAINTABLE_LANDFORMS: TLandform[] = [
  'mountain',
  'plateau',
  'hills',
  'plain',
  'valley',
  'volcanic_field',
  'coast',
  'lake',
  'marine_shallow',
  'marine_deep',
];

export default function TerrainEditorPanel() {
  const { editMode, selectedLandform, setEditMode, setSelectedLandform } = useTerrainEditorStore();
  const { clearTerrainPaints, applyTerrainEdits, activePaintCount, lockedPaintCount } =
    useMapContext();

  function handleToggleEditMode() {
    const next = !editMode;
    setEditMode(next);
    if (!next) setSelectedLandform(null);
  }

  function handleSelectLandform(lf: TLandform) {
    setSelectedLandform(selectedLandform === lf ? null : lf);
  }

  const hasActivePaints = activePaintCount > 0;
  const hasLockedPaints = lockedPaintCount > 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="fantasy-text-muted mb-2 text-xs">
          Enable paint mode, then click or drag cells on the map to change their terrain. Hit
          &ldquo;Apply&rdquo; to lock edits in — they will persist when you change other settings.
        </p>
        <Button
          type="button"
          variant={editMode ? 'default' : 'secondary'}
          onClick={handleToggleEditMode}
          className="w-full justify-center gap-2 py-2.5 text-sm"
        >
          <span aria-hidden="true">✏</span>
          <span>{editMode ? 'Painting Active — Click to Disable' : 'Enable Paint Mode'}</span>
        </Button>
      </div>

      <div>
        <p className="fantasy-text-muted mb-2 text-xs font-medium tracking-wide uppercase">
          Terrain Type
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {PAINTABLE_LANDFORMS.map((lf) => {
            const cfg = LANDFORM_CONFIG[lf];
            const isSelected = selectedLandform === lf;
            return (
              <Button
                key={lf}
                type="button"
                variant={isSelected ? 'default' : 'secondary'}
                onClick={() => handleSelectLandform(lf)}
                disabled={!editMode}
                className={cn(
                  'justify-start gap-2.5 py-2 text-sm',
                  isSelected && 'fantasy-border-gold'
                )}
              >
                <span
                  className="h-3 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: cfg.color }}
                  aria-hidden="true"
                />
                <span className="text-base leading-none" aria-hidden="true">
                  {cfg.icon}
                </span>
                <span className="leading-tight">{cfg.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {editMode && selectedLandform && (
        <p className="fantasy-glass fantasy-text-gold rounded-lg px-3 py-2 text-center text-xs">
          Click or drag on the map to paint{' '}
          <strong>{LANDFORM_CONFIG[selectedLandform].label}</strong>
        </p>
      )}

      {editMode && !selectedLandform && (
        <p className="fantasy-glass fantasy-text-muted rounded-lg px-3 py-2 text-center text-xs">
          Select a terrain type above to start painting
        </p>
      )}

      {/* Status badges */}
      {(hasActivePaints || hasLockedPaints) && (
        <div className="flex gap-2 text-xs">
          {hasActivePaints && (
            <span className="fantasy-glass fantasy-text-gold rounded-md px-2 py-1">
              {activePaintCount} unapplied
            </span>
          )}
          {hasLockedPaints && (
            <span className="fantasy-glass rounded-md px-2 py-1 text-emerald-400">
              {lockedPaintCount} locked
            </span>
          )}
        </div>
      )}

      {/* Apply button — locks active paints and re-generates downstream stages */}
      <Button
        type="button"
        variant="default"
        onClick={applyTerrainEdits}
        disabled={!hasActivePaints}
        className="w-full justify-center py-2.5 text-sm font-semibold"
      >
        Apply Terrain Edits
      </Button>

      <Button
        type="button"
        variant="destructive"
        onClick={clearTerrainPaints}
        disabled={!hasActivePaints && !hasLockedPaints}
        className="w-full justify-center py-2 text-sm"
      >
        Clear All Edits
      </Button>
    </div>
  );
}
