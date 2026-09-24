import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="bg-background flex h-dvh w-dvw items-center justify-center">
      <div className="fantasy-panel flex items-center gap-3 px-5 py-3">
        <Loader2 className="fantasy-text-gold size-5 animate-spin" aria-hidden="true" />
        <span className="text-sm">Loading Fantasy World&hellip;</span>
      </div>
    </div>
  );
}
