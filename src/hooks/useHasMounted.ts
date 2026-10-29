'use client';

import { useEffect, useState } from 'react';

// Persisted stores hydrate from localStorage on the client only, so UI that shows persisted values
// must wait for the first effect to avoid a server/client markup mismatch.
export default function useHasMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
