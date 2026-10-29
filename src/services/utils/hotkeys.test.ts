import { describe, expect, it } from 'vitest';
import { isTypingTarget, resolveHotkey } from './hotkeys';

const press = (
  key: string,
  mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}
) => resolveHotkey({ key, ctrlKey: false, metaKey: false, altKey: false, ...mods });

describe('resolveHotkey', () => {
  it('maps the documented keys', () => {
    expect(press('r')).toEqual({ type: 'randomSeed' });
    expect(press('R')).toEqual({ type: 'randomSeed' });
    expect(press('1')).toEqual({ type: 'viewPreset', index: 0 });
    expect(press('6')).toEqual({ type: 'viewPreset', index: 5 });
    expect(press('+')).toEqual({ type: 'zoomIn' });
    expect(press('=')).toEqual({ type: 'zoomIn' });
    expect(press('-')).toEqual({ type: 'zoomOut' });
    expect(press('0')).toEqual({ type: 'zoomReset' });
    expect(press('Escape')).toEqual({ type: 'closePanel' });
  });

  it('ignores unknown keys and anything with a modifier', () => {
    expect(press('x')).toBeNull();
    expect(press('r', { ctrlKey: true })).toBeNull();
    expect(press('r', { metaKey: true })).toBeNull();
    expect(press('1', { altKey: true })).toBeNull();
  });
});

describe('isTypingTarget', () => {
  it('recognizes text-entry elements', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'textarea' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(isTypingTarget({ tagName: 'INPUT', type: 'number' })).toBe(true);
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it('does not treat checkboxes, radios and sliders as text fields', () => {
    for (const type of ['checkbox', 'radio', 'range', 'button', 'color']) {
      expect(isTypingTarget({ tagName: 'INPUT', type })).toBe(false);
    }
  });
});
