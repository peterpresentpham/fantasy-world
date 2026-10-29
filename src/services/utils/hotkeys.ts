export type THotkeyAction =
  | { type: 'randomSeed' }
  | { type: 'viewPreset'; index: number }
  | { type: 'zoomIn' }
  | { type: 'zoomOut' }
  | { type: 'zoomReset' }
  | { type: 'closePanel' };

type TKeyInput = { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean };

/** Map a key press to a map action. Browser/OS shortcuts (with Ctrl/Cmd/Alt) are never taken. */
export function resolveHotkey({ key, ctrlKey, metaKey, altKey }: TKeyInput): THotkeyAction | null {
  if (ctrlKey || metaKey || altKey) return null;
  if (key === 'r' || key === 'R') return { type: 'randomSeed' };
  if (key >= '1' && key <= '9') return { type: 'viewPreset', index: Number(key) - 1 };
  if (key === '+' || key === '=') return { type: 'zoomIn' };
  if (key === '-' || key === '_') return { type: 'zoomOut' };
  if (key === '0') return { type: 'zoomReset' };
  if (key === 'Escape') return { type: 'closePanel' };
  return null;
}

type TTarget = { tagName?: string; isContentEditable?: boolean; type?: string } | null;

// <input> types that do not take typed text, so shortcuts (and Escape) must keep working on them.
const NON_TEXT_INPUT_TYPES = new Set([
  'checkbox',
  'radio',
  'range',
  'button',
  'submit',
  'reset',
  'color',
  'file',
  'image',
]);

/** True when the key press belongs to a text field and must not trigger a shortcut. */
export function isTypingTarget(target: TTarget): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName?.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  return !NON_TEXT_INPUT_TYPES.has((target.type ?? 'text').toLowerCase());
}
