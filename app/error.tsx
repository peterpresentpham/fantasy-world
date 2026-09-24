'use client';

import { useEffect } from 'react';
import { Button } from 'src/components/ui/button';

type TProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: TProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="bg-background flex h-dvh w-dvw items-center justify-center p-4">
      <div className="fantasy-panel w-[min(28rem,100%)] space-y-4 p-6 text-center">
        <h1 className="text-lg font-medium">Something went wrong</h1>
        <p className="fantasy-text-muted text-sm">
          The map generator hit an unexpected error. You can try again, or reload the page.
        </p>
        <Button type="button" variant="default" className="w-full justify-center" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
