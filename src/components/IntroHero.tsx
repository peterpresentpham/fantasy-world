'use client';

import {
  Compass,
  Dices,
  Link2,
  MousePointerClick,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { Button } from 'src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'src/components/ui/dialog';
import { APP_NAME } from 'src/configs/constance';
import { HOTKEY_HELP } from 'src/configs/map/hotkeys';
import { SAMPLE_WORLDS } from 'src/configs/map/samples';
import useHasMounted from 'src/hooks/useHasMounted';
import { generateRandomSeed } from 'src/services/utils/seed';
import { useMapExplorerStore } from 'src/store/mapExplorerStore';
import { useUiStore } from 'src/store/uiStore';

const STEPS = [
  {
    icon: MousePointerClick,
    title: 'Explore',
    text: 'Hover the map to inspect a place, click a kingdom to see its people and economy.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Shape it',
    text: 'Switch views, pick a terrain style, or paint your own land.',
  },
  {
    icon: Link2,
    title: 'Share it',
    text: 'Copy a link to this exact world or download it as an image.',
  },
];

export default function IntroHero() {
  const mounted = useHasMounted();
  const introSeen = useUiStore((s) => s.introSeen);
  const reopened = useUiStore((s) => s.introReopened);
  const dismissIntro = useUiStore((s) => s.dismissIntro);
  const setSeed = useMapExplorerStore((s) => s.setSeed);
  const applyWorld = useMapExplorerStore((s) => s.applyWorld);

  if (!mounted) return null;
  const open = !introSeen || reopened;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismissIntro()}>
      <DialogContent
        overlayClassName="bg-black/50"
        className="fantasy-panel max-h-[90dvh] gap-5 overflow-y-auto p-6 sm:max-w-md"
      >
        <DialogHeader className="items-center text-center">
          <DialogTitle className="font-heading fantasy-text-gold text-3xl tracking-wide">
            {APP_NAME}
          </DialogTitle>
          <DialogDescription className="text-sm">
            Invent a whole fantasy world in one click: continents, rivers, climates, kingdoms and
            the peoples who live in them. Every world has a seed, so you can always find it again.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {STEPS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3 text-left">
              <Icon aria-hidden="true" className="fantasy-text-gold mt-0.5 size-5 shrink-0" />
              <p className="text-sm">
                <span className="font-semibold">{title}.</span>{' '}
                <span className="text-muted-foreground">{text}</span>
              </p>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
          <Button type="button" size="lg" onClick={dismissIntro}>
            <Sparkles /> Explore this world
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
            <Dices /> New random world
          </Button>
          <Button
            type="button"
            size="lg"
            variant="ghost"
            onClick={() => {
              applyWorld(SAMPLE_WORLDS[Math.floor(Math.random() * SAMPLE_WORLDS.length)]);
              dismissIntro();
            }}
          >
            <Compass /> Sample world
          </Button>
        </div>
        <details className="text-muted-foreground text-xs">
          <summary className="cursor-pointer select-none">Keyboard shortcuts</summary>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {HOTKEY_HELP.map((item) => (
              <div key={item.keys} className="contents">
                <dt className="text-foreground font-medium">{item.keys}</dt>
                <dd>{item.action}</dd>
              </div>
            ))}
          </dl>
        </details>
      </DialogContent>
    </Dialog>
  );
}
