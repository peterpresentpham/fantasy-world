'use client';

import { Moon, ScrollText } from 'lucide-react';
import { Button } from 'src/components/ui/button';
import { useUiStore } from 'src/store/uiStore';

export default function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const parchment = theme === 'parchment';

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={parchment ? 'Switch to dark theme' : 'Switch to parchment theme'}
      title={parchment ? 'Dark theme' : 'Parchment theme'}
      aria-pressed={parchment}
      onClick={() => setTheme(parchment ? 'dark' : 'parchment')}
    >
      {parchment ? <Moon /> : <ScrollText />}
    </Button>
  );
}
