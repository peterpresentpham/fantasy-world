'use client';

import { Dices, Sparkles } from 'lucide-react';
import { Button } from 'src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'src/components/ui/dialog';
import { APP_NAME, siteMetadata } from 'src/configs/constance';
import { HOTKEY_HELP } from 'src/configs/map/hotkeys';
import useHasMounted from 'src/hooks/useHasMounted';
import { generateRandomSeed } from 'src/services/utils/seed';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';
import { useUiStore } from 'src/store/uiStore';

const HIGHLIGHTS = [
  'Same seed, same world, every time',
  'Rivers, climate, nations and ethnic groups',
  'Paint your own terrain and export it',
];

export default function IntroHero() {
  const mounted = useHasMounted();
  const introSeen = useUiStore((s) => s.introSeen);
  const reopened = useUiStore((s) => s.introReopened);
  const dismissIntro = useUiStore((s) => s.dismissIntro);
  const setSeed = useMapExplorerStore((s) => s.setSeed);

  if (!mounted) return null;
  const open = !introSeen || reopened;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismissIntro()}>
      <DialogContent
        overlayClassName="bg-black/50"
        className="fantasy-panel gap-5 p-6 text-center sm:max-w-md"
      >
        <DialogHeader className="items-center">
          <DialogTitle className="font-heading fantasy-text-gold text-3xl tracking-wide">
            {APP_NAME}
          </DialogTitle>
          <DialogDescription className="text-sm">{siteMetadata.description}</DialogDescription>
        </DialogHeader>
        <ul className="text-muted-foreground space-y-1 text-xs">
          {HIGHLIGHTS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-left text-xs">
          {HOTKEY_HELP.map((item) => (
            <div key={item.keys} className="contents">
              <dt className="text-foreground font-medium">{item.keys}</dt>
              <dd>{item.action}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button type="button" size="lg" onClick={dismissIntro}>
            <Sparkles /> Generate world
          </Button>
          <Button
            type="button"
            size="lg"
            variant="secondary"
            onClick={() => {
              setSeed(generateRandomSeed());
              dismissIntro();
            }}
          >
            <Dices /> Random seed
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
