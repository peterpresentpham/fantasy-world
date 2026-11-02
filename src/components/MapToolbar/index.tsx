'use client';

import {
  CircleHelp,
  GripVertical,
  PanelTopClose,
  PanelTopOpen,
  Pencil,
  SlidersHorizontal,
} from 'lucide-react';
import { useRef } from 'react';
import AdvancedSettings from 'src/components/AdvancedSettings';
import { Button } from 'src/components/ui/button';
import useDragPosition from 'src/hooks/useDragPosition';
import useApplyTheme from 'src/hooks/useApplyTheme';
import useHasMounted from 'src/hooks/useHasMounted';
import useIsMobile from 'src/hooks/useIsMobile';
import useMapHotkeys from 'src/hooks/useMapHotkeys';
import useWorldUrlSync from 'src/hooks/useWorldUrlSync';
import { cn } from 'src/lib/utils';
import { useUiStore } from 'src/store/uiStore';
import LayerQuickToggles from './LayerQuickToggles';
import MobileToolbar from './MobileToolbar';
import RouteButton from './RouteButton';
import SampleWorldsSelect from './SampleWorldsSelect';
import SeedQuickControl from './SeedQuickControl';
import TopographyQuickSelect from './TopographyQuickSelect';
import ShareButtons from './ShareButtons';
import ThemeToggle from './ThemeToggle';
import ViewModeSwitch from './ViewModeSwitch';

export default function MapToolbar() {
  const mounted = useHasMounted();
  const isMobile = useIsMobile();
  useMapHotkeys();
  useApplyTheme();
  useWorldUrlSync();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const openConfig = useUiStore((s) => s.openConfig);
  const configOpen = useUiStore((s) => s.configOpen);
  const setConfigOpen = useUiStore((s) => s.setConfigOpen);
  const showIntro = useUiStore((s) => s.showIntro);
  const collapsed = useUiStore((s) => s.toolbarCollapsed);
  const setCollapsed = useUiStore((s) => s.setToolbarCollapsed);
  const position = useUiStore((s) => s.toolbarPosition);
  const setPosition = useUiStore((s) => s.setToolbarPosition);
  const dragHandlers = useDragPosition({ elementRef: rootRef, position, onChange: setPosition });
  if (!mounted) return null;
  if (isMobile) return <MobileToolbar />;

  const advancedOpen = configOpen && !collapsed;

  return (
    <div
      ref={rootRef}
      className={cn(
        'fantasy-glass-strong absolute z-30 flex max-w-[calc(100%-1.5rem)] flex-col gap-2 rounded-xl px-2 py-2 shadow-lg',
        !position && 'top-3 left-1/2 -translate-x-1/2'
      )}
      style={position ? { left: position.x, top: position.y } : undefined}
    >
      <div role="toolbar" aria-label="Map tools" className="flex min-w-0 items-start gap-2">
        <button
          type="button"
          aria-label="Move toolbar"
          title="Drag to move the toolbar"
          className="text-muted-foreground hover:text-foreground flex h-8 w-5 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
          {...dragHandlers}
        >
          <GripVertical className="size-4" />
        </button>

        {!collapsed && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <SeedQuickControl />
            <TopographyQuickSelect />
            <SampleWorldsSelect />
            <LayerQuickToggles />
            <ViewModeSwitch />
            <RouteButton />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="Edit terrain"
              title="Edit terrain"
              onClick={() => openConfig('terrain')}
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              variant={advancedOpen ? 'default' : 'secondary'}
              size="sm"
              aria-label="Advanced settings"
              aria-expanded={advancedOpen}
              aria-controls="advanced-settings"
              title="Advanced settings"
              onClick={() => setConfigOpen(!configOpen)}
            >
              <SlidersHorizontal /> Advanced
            </Button>
          </div>
        )}

        {!collapsed && <ShareButtons />}
        {!collapsed && <ThemeToggle />}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="About this map"
          title="About this map"
          onClick={showIntro}
        >
          <CircleHelp />
        </Button>

        <Button
          type="button"
          variant={collapsed ? 'secondary' : 'ghost'}
          size="icon"
          aria-label={collapsed ? 'Expand toolbar' : 'Collapse toolbar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Show toolbar' : 'Hide toolbar'}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <PanelTopOpen /> : <PanelTopClose />}
        </Button>
      </div>

      {advancedOpen && <AdvancedSettings />}
    </div>
  );
}
