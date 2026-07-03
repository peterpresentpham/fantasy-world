'use client';

import { LANDFORM_CONFIG } from 'src/configs/map/landform-biome';
import { useMapContext } from 'src/contexts/map.context';
import { TLandform } from 'src/global';
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
        <p className="mb-2 text-xs text-slate-400">
          Enable paint mode, then click or drag cells on the map to change their terrain. Hit
          &ldquo;Apply&rdquo; to lock edits in — they will persist when you change other settings.
        </p>
        <button
          onClick={handleToggleEditMode}
          className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
            editMode
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
          }`}
        >
          <span>✏</span>
          <span>{editMode ? 'Painting Active — Click to Disable' : 'Enable Paint Mode'}</span>
        </button>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-slate-400 uppercase">
          Terrain Type
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {PAINTABLE_LANDFORMS.map((lf) => {
            const cfg = LANDFORM_CONFIG[lf];
            const isSelected = selectedLandform === lf;
            return (
              <button
                key={lf}
                onClick={() => handleSelectLandform(lf)}
                disabled={!editMode}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all disabled:pointer-events-none disabled:opacity-40 ${
                  isSelected
                    ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400'
                    : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 hover:text-white'
                }`}
              >
                <span
                  className="h-3 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: cfg.color }}
                />
                <span className="text-base leading-none">{cfg.icon}</span>
                <span className="leading-tight">{cfg.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {editMode && selectedLandform && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-400">
          Click or drag on the map to paint{' '}
          <strong>{LANDFORM_CONFIG[selectedLandform].label}</strong>
        </p>
      )}

      {editMode && !selectedLandform && (
        <p className="rounded-lg bg-slate-800/60 px-3 py-2 text-center text-xs text-slate-400">
          Select a terrain type above to start painting
        </p>
      )}

      {/* Status badges */}
      {(hasActivePaints || hasLockedPaints) && (
        <div className="flex gap-2 text-xs">
          {hasActivePaints && (
            <span className="rounded-md bg-amber-500/15 px-2 py-1 text-amber-400">
              {activePaintCount} unapplied
            </span>
          )}
          {hasLockedPaints && (
            <span className="rounded-md bg-green-500/15 px-2 py-1 text-green-400">
              {lockedPaintCount} locked
            </span>
          )}
        </div>
      )}

      {/* Apply button — locks active paints and re-generates downstream stages */}
      <button
        onClick={applyTerrainEdits}
        disabled={!hasActivePaints}
        className="w-full rounded-lg bg-green-600/80 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Apply Terrain Edits
      </button>

      <button
        onClick={clearTerrainPaints}
        disabled={!hasActivePaints && !hasLockedPaints}
        className="w-full rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Clear All Edits
      </button>
    </div>
  );
}
