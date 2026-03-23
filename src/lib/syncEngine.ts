// Sync engine: flushes pending IndexedDB mutations to Supabase
// Uses last-write-wins strategy based on updated_at timestamps

import { supabase } from '@/integrations/supabase/client';
import {
  getSyncQueue,
  removeFromSyncQueue,
  getCollection,
  setCollection,
  type PendingMutation,
} from '@/lib/offlineDb';

type SupabaseTable = 'customers' | 'transactions' | 'payments' | 'staff' | 'attendance' | 'expenses' | 'procurement' | 'suppliers';

const TABLES_WITH_UPDATED_AT: SupabaseTable[] = ['customers', 'transactions', 'staff', 'expenses', 'suppliers'];

// Flush all pending mutations to Supabase
export async function flushSyncQueue(): Promise<{ synced: number; failed: number }> {
  const queue = await getSyncQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const m of queue) {
    try {
      const success = await processMutation(m);
      if (success) {
        await removeFromSyncQueue(m.id);
        synced++;
      } else {
        failed++;
      }
    } catch (e) {
      console.error('[SyncEngine] Error processing mutation', m, e);
      failed++;
    }
  }

  return { synced, failed };
}

async function processMutation(m: PendingMutation): Promise<boolean> {
  const table = m.table as SupabaseTable;

  if (m.action === 'insert') {
    // Remove client-only fields
    const { ...payload } = m.data;
    const { error } = await (supabase.from(table as any) as any).insert(payload);
    if (error) {
      // If duplicate key (already synced), treat as success
      if (error.code === '23505') return true;
      console.error('[SyncEngine] Insert failed', table, error);
      return false;
    }
    return true;
  }

  if (m.action === 'update') {
    const { id, ...rest } = m.data;
    if (!id) return false;

    // Last-write-wins: check server timestamp
    if (TABLES_WITH_UPDATED_AT.includes(table)) {
      const { data: serverRow } = await (supabase.from(table as any) as any)
        .select('updated_at')
        .eq('id', id)
        .single();
      
      if (serverRow && rest.updated_at) {
        const serverTs = new Date(serverRow.updated_at).getTime();
        const localTs = new Date(rest.updated_at).getTime();
        if (serverTs > localTs) {
          // Server has newer data, skip this mutation
          return true;
        }
      }
    }

    const { error } = await (supabase.from(table as any) as any).update(rest).eq('id', id);
    if (error) {
      console.error('[SyncEngine] Update failed', table, error);
      return false;
    }
    return true;
  }

  if (m.action === 'delete') {
    const { error } = await (supabase.from(table as any) as any).delete().eq('id', m.data.id);
    if (error) {
      // If not found, already deleted
      if (error.code === 'PGRST116') return true;
      console.error('[SyncEngine] Delete failed', table, error);
      return false;
    }
    return true;
  }

  if (m.action === 'upsert') {
    const { error } = await (supabase.from(table as any) as any).upsert(m.data);
    if (error) {
      console.error('[SyncEngine] Upsert failed', table, error);
      return false;
    }
    return true;
  }

  return false;
}

// Pull fresh data from Supabase and merge into IndexedDB for a specific table
export async function pullFromServer<T extends { id: string }>(
  table: SupabaseTable,
  farmId: string
): Promise<T[]> {
  const { data, error } = await (supabase.from(table as any) as any)
    .select('*')
    .eq('farm_id', farmId)
    .limit(10000);

  if (error) {
    console.error('[SyncEngine] Pull failed', table, error);
    throw error;
  }

  const serverData = (data || []) as T[];
  await setCollection(table, farmId, serverData);
  return serverData;
}

// Pull with filter (for scoped queries like attendance by staff/month)
export async function pullFromServerFiltered<T extends { id: string }>(
  table: SupabaseTable,
  farmId: string,
  filters: Record<string, any>,
  cacheKey?: string
): Promise<T[]> {
  let q = (supabase.from(table as any) as any).select('*').eq('farm_id', farmId);
  
  for (const [key, value] of Object.entries(filters)) {
    if (key.endsWith('_like')) {
      q = q.like(key.replace('_like', ''), value);
    } else {
      q = q.eq(key, value);
    }
  }

  const { data, error } = await q.limit(10000);
  if (error) throw error;
  return (data || []) as T[];
}

// Full sync: flush queue then pull all tables
export async function fullSync(farmId: string): Promise<void> {
  if (!navigator.onLine) return;

  const result = await flushSyncQueue();
  console.log('[SyncEngine] Flush result:', result);

  // Pull all core tables
  const tables: SupabaseTable[] = ['customers', 'transactions', 'payments', 'staff', 'attendance', 'expenses', 'procurement', 'suppliers'];
  
  await Promise.allSettled(
    tables.map((t) => pullFromServer(t, farmId))
  );
}
