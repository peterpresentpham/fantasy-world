'use client';

import { useUiStore } from 'src/store/uiStore';

/**
 * Classes that keep a map overlay clear of the phone detail sheet: raised above its header while it
 * shows only the header, hidden while it is expanded. No effect from the `sm` breakpoint up.
 */
export default function useSheetAvoidance() {
  const open = useUiStore((s) => s.detailOpen);
  const expanded = useUiStore((s) => s.detailExpanded);
  if (!open) return '';
  return expanded ? 'max-sm:hidden' : 'max-sm:mb-16';
}
