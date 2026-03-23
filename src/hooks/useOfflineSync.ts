import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { flushSyncQueue } from '@/lib/syncEngine';
import { fullSync } from '@/lib/syncEngine';
import { setLastSyncTs } from '@/lib/offlineDb';

export function useOfflineSync() {
  const qc = useQueryClient();
  const { farmId } = useAuth();

  useEffect(() => {
    if (!farmId) return;

    const handler = async () => {
      if (!navigator.onLine) return;

      try {
        await flushSyncQueue();
        await setLastSyncTs('global');
        qc.invalidateQueries();
      } catch (e) {
        console.error('[OfflineSync] Flush error', e);
      }
    };

    window.addEventListener('online', handler);
    // Flush on mount
    handler();

    // Periodic background sync every 5 minutes
    const interval = setInterval(handler, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('online', handler);
      clearInterval(interval);
    };
  }, [qc, farmId]);
}
