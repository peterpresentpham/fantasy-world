'use client';

import { ChangeEventHandler, useState } from 'react';
import BlurCard from 'src/components/BlurCard';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { useMapContext } from 'src/contexts/map.context';
import {
  buildMapSvg,
  exportCanvasToPng,
  exportTextFile,
} from 'src/services/rendering/pipeline/exportPipeline';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';
import { TExportSnapshot } from 'src/types/global';

function makeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export default function ExportTab() {
  const { mesh, importFromSnapshot } = useMapContext();
  const { seed, cellCount, seaLevel, topography, nationCount, climateControl, displaySettings } =
    useMapExplorerStore();
  const [importError, setImportError] = useState<string | null>(null);

  const handleExportPng = () => {
    exportCanvasToPng('map-base-canvas', `fantasy-map-${makeTimestamp()}.png`);
  };

  const handleExportSvg = () => {
    const svg = buildMapSvg(mesh, displaySettings);
    exportTextFile(svg, `fantasy-map-${makeTimestamp()}.svg`, 'image/svg+xml');
  };

  const handleExportJson = () => {
    const payload: TExportSnapshot = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      config: {
        width: mesh.width,
        height: mesh.height,
        seed,
        cellCount,
        seaLevel,
        topography,
        nationCount,
        climateControl,
      },
      displaySettings,
      mesh: {
        width: mesh.width,
        height: mesh.height,
        cells: mesh.cells,
        edges: mesh.edges,
        vertices: mesh.vertices,
        nations: mesh.nations,
        ethnics: mesh.ethnics,
        rivers: mesh.rivers,
      },
    };

    exportTextFile(
      JSON.stringify(payload, null, 2),
      `fantasy-map-${makeTimestamp()}.json`,
      'application/json'
    );
  };

  const handleImportJson: ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportError(null);
    const content = await file.text();
    try {
      const payload = JSON.parse(content) as TExportSnapshot;
      const result = importFromSnapshot(payload);
      if (!result.ok) {
        setImportError(result.error);
      }
    } catch {
      setImportError('Invalid JSON file.');
    }
  };

  return (
    <div className="space-y-4">
      <BlurCard title="Export Image">
        <div className="flex flex-col gap-2">
          <Button type="button" onClick={handleExportPng}>
            Export PNG
          </Button>
          <Button type="button" onClick={handleExportSvg}>
            Export SVG
          </Button>
        </div>
      </BlurCard>
      <BlurCard title="Export Data">
        <Button type="button" onClick={handleExportJson} className="w-full">
          Export JSON Schema
        </Button>
      </BlurCard>
      <BlurCard title="Import Data">
        <label className="fantasy-text-muted block text-xs">Import JSON Schema</label>
        <Input type="file" accept="application/json,.json" onChange={handleImportJson} />
        {importError && (
          <p
            role="alert"
            className="bg-destructive/10 text-destructive mt-2 rounded-md px-2 py-1.5 text-xs"
          >
            {importError}
          </p>
        )}
      </BlurCard>
    </div>
  );
}
