// Shown on the welcome screen. The actual key handling lives in services/utils/hotkeys.ts.
export const HOTKEY_HELP: readonly { keys: string; action: string }[] = [
  { keys: 'R', action: 'Random seed' },
  { keys: '1 – 6', action: 'Switch map view' },
  { keys: '+  −  0', action: 'Zoom in, out, reset' },
  { keys: 'Wheel / drag', action: 'Zoom and pan the map' },
  { keys: 'Shift', action: 'Hold over a cell for details' },
  { keys: 'Esc', action: 'Close the side panel or advanced settings' },
];
