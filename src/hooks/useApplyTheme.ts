import { useEffect } from 'react';
import { useUiStore } from 'src/store/uiStore';

/** Mirrors the chosen theme onto <html data-theme> so the CSS tokens switch. */
export default function useApplyTheme() {
  const theme = useUiStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
}
