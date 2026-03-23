// IndexedDB data layer using localForage
import localforage from 'localforage';

// Configure the IndexedDB instance
const db = localforage.createInstance({
  name: 'chitraDb',
  storeName: 'farm_data',
  description: 'Offline-first data store for Chitra Agro',
});

const syncQueueDb = localforage.createInstance({
  name: 'chitraDb',
  storeName: 'sync_queue',
  description: 'Pending mutations queue',
});

const metaDb = localforage.createInstance({
  name: 'chitraDb',
  storeName: 'meta',
  description: 'Sync metadata (timestamps, etc)',
});

// ============ Collection CRUD ============

function collectionKey(table: string, farmId: string): string {
  return `${table}_${farmId}`;
}

export async function getCollection<T>(table: string, farmId: string): Promise<T[]> {
  try {
    const data = await db.getItem<T[]>(collectionKey(table, farmId));
    return data || [];
  } catch {
    return [];
  }
}

export async function setCollection<T>(table: string, farmId: string, data: T[]): Promise<void> {
  await db.setItem(collectionKey(table, farmId), data);
  await metaDb.setItem(`ts_${collectionKey(table, farmId)}`, Date.now());
}

export async function upsertItem<T extends { id: string }>(
  table: string,
  farmId: string,
  item: T
): Promise<T[]> {
  const items = await getCollection<T>(table, farmId);
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    items[idx] = { ...items[idx], ...item };
  } else {
    items.push(item);
  }
  await setCollection(table, farmId, items);
  return items;
}

export async function removeItem<T extends { id: string }>(
  table: string,
  farmId: string,
  id: string
): Promise<T[]> {
  const items = await getCollection<T>(table, farmId);
  const filtered = items.filter((i) => i.id !== id);
  await setCollection(table, farmId, filtered);
  return filtered;
}

export async function updateItem<T extends { id: string }>(
  table: string,
  farmId: string,
  id: string,
  patch: Partial<T>
): Promise<T[]> {
  const items = await getCollection<T>(table, farmId);
  const idx = items.findIndex((i) => i.id === id);
  if (idx >= 0) {
    items[idx] = { ...items[idx], ...patch };
    await setCollection(table, farmId, items);
  }
  return items;
}

// ============ Sync Queue ============

export interface PendingMutation {
  id: string;
  table: string;
  action: 'insert' | 'update' | 'delete' | 'upsert';
  data: Record<string, any>;
  timestamp: number;
}

const QUEUE_KEY = 'pending_mutations';

export async function getSyncQueue(): Promise<PendingMutation[]> {
  try {
    return (await syncQueueDb.getItem<PendingMutation[]>(QUEUE_KEY)) || [];
  } catch {
    return [];
  }
}

export async function addToSyncQueue(mutation: Omit<PendingMutation, 'id' | 'timestamp'>): Promise<void> {
  const queue = await getSyncQueue();
  queue.push({
    ...mutation,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  });
  await syncQueueDb.setItem(QUEUE_KEY, queue);
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  const queue = await getSyncQueue();
  await syncQueueDb.setItem(QUEUE_KEY, queue.filter((m) => m.id !== id));
}

export async function clearSyncQueue(): Promise<void> {
  await syncQueueDb.setItem(QUEUE_KEY, []);
}

// ============ Meta ============

export async function getLastSyncTs(table: string, farmId: string): Promise<number | null> {
  return metaDb.getItem<number>(`ts_${collectionKey(table, farmId)}`);
}

export async function setLastSyncTs(key: string): Promise<void> {
  await metaDb.setItem(`global_last_sync`, Date.now());
}

export async function getGlobalLastSync(): Promise<number | null> {
  return metaDb.getItem<number>('global_last_sync');
}

// ============ Reset ============

export async function clearAllData(): Promise<void> {
  await db.clear();
  await syncQueueDb.clear();
  await metaDb.clear();
  // Also clear legacy localStorage caches
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('chitra_cache_') || key.startsWith('chitra_cache_ts_') || key === 'chitra_pending_mutations' || key === 'chitra_last_sync_ts')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}

export function isOnline(): boolean {
  return navigator.onLine;
}
