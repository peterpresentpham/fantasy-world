'use client';

import { Check, Download, Link2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from 'src/components/ui/button';
import { exportCanvasToPng } from 'src/services/rendering/pipeline/exportPipeline';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';

const COPIED_MS = 1800;

export default function ShareButtons() {
  const seed = useMapExplorerStore((s) => s.seed);
  const threeDim = useMapExplorerStore((s) => s.displaySettings.threeDim);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      window.prompt('Copy this link to share the world', window.location.href);
    }
  }

  function downloadImage() {
    exportCanvasToPng('map-base-canvas', `fantasy-world-${seed}.png`);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Copy link to this world"
        title="Copy a link to this exact world"
        onClick={copyLink}
      >
        {copied ? <Check /> : <Link2 />}
      </Button>
      <span role="status" className="sr-only">
        {copied ? 'Link copied' : ''}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Download map image"
        title={threeDim ? 'Switch to 2D to download an image' : 'Download the map as a PNG image'}
        disabled={threeDim}
        onClick={downloadImage}
      >
        <Download />
      </Button>
    </>
  );
}
