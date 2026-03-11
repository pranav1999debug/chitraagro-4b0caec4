// Offline-first caching layer for Supabase queries
// Caches data in localStorage, serves cached data when offline, syncs when online

const CACHE_PREFIX = 'chitra_cache_';
const CACHE_TIMESTAMP_PREFIX = 'chitra_cache_ts_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function getCachedData<T>(key: string): T[] | null {
  try {
    const data = localStorage.getItem(CACHE_PREFIX + key);
    if (!data) return null;
    return JSON.parse(data) as T[];
  } catch {
    return null;
  }
}

export function setCachedData<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
    localStorage.setItem(CACHE_TIMESTAMP_PREFIX + key, Date.now().toString());
  } catch {
    // localStorage full - silently fail
  }
}

export function isCacheStale(key: string): boolean {
  const ts = localStorage.getItem(CACHE_TIMESTAMP_PREFIX + key);
  if (!ts) return true;
  return Date.now() - parseInt(ts) > CACHE_TTL;
}

export function isOnline(): boolean {
  return navigator.onLine;
}

// Pending mutations queue for offline writes
const PENDING_KEY = 'chitra_pending_mutations';

interface PendingMutation {
  id: string;
  table: string;
  action: 'insert' | 'update' | 'delete';
  data: Record<string, any>;
  timestamp: number;
}

export function addPendingMutation(mutation: Omit<PendingMutation, 'id' | 'timestamp'>): void {
  try {
    const pending = getPendingMutations();
    pending.push({
      ...mutation,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      timestamp: Date.now(),
    });
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch { /* ignore */ }
}

export function getPendingMutations(): PendingMutation[] {
  try {
    const data = localStorage.getItem(PENDING_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function clearPendingMutations(): void {
  localStorage.removeItem(PENDING_KEY);
}

export function removePendingMutation(id: string): void {
  const pending = getPendingMutations().filter(m => m.id !== id);
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}
