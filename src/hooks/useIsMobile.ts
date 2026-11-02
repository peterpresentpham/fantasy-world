'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 639px)';

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/** True on phone-sized screens (below Tailwind's `sm`). Always false on the server. */
export default function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  );
}
