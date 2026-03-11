import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPendingMutations, removePendingMutation } from '@/hooks/useOfflineCache';
import { useQueryClient } from '@tanstack/react-query';

// Flushes pending offline mutations when connectivity returns
async function flushPendingMutations() {
  const pending = getPendingMutations();
  if (pending.length === 0) return;

  for (const m of pending) {
    try {
      if (m.action === 'insert') {
        const { error } = await (supabase.from(m.table as any) as any).insert(m.data);
        if (error) { console.error('Sync insert failed', error); continue; }
      } else if (m.action === 'update') {
        const { id, ...rest } = m.data;
        const { error } = await (supabase.from(m.table as any) as any).update(rest).eq('id', id);
        if (error) { console.error('Sync update failed', error); continue; }
      } else if (m.action === 'delete') {
        const { error } = await (supabase.from(m.table as any) as any).delete().eq('id', m.data.id);
        if (error) { console.error('Sync delete failed', error); continue; }
      }
      removePendingMutation(m.id);
    } catch (e) {
      console.error('Sync error', e);
    }
  }
}

export function useOfflineSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const handler = async () => {
      if (navigator.onLine) {
        await flushPendingMutations();
        qc.invalidateQueries();
      }
    };

    window.addEventListener('online', handler);
    // Also try on mount
    handler();

    return () => window.removeEventListener('online', handler);
  }, [qc]);
}
