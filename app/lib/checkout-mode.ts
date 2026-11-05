'use client';

import { useEffect, useState } from 'react';

export type CheckoutMode = 'loading' | 'demo' | 'live';

// The server is authoritative. A failed status check must never enable real orders.
export function useCheckoutMode(): CheckoutMode {
  const [mode, setMode] = useState<CheckoutMode>('loading');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/checkout', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) return false;
        const payload: unknown = await response.json();
        return !!payload && typeof payload === 'object' &&
          (payload as { mode?: unknown }).mode === 'live' &&
          (payload as { accepts_real_orders?: unknown }).accepts_real_orders === true;
      })
      .then(live => { if (!controller.signal.aborted) setMode(live ? 'live' : 'demo'); })
      .catch(() => { if (!controller.signal.aborted) setMode('demo'); });
    return () => controller.abort();
  }, []);
  return mode;
}
