// Legacy compatibility layer — now backed by offlineDb (IndexedDB)
// Re-exports for any remaining references in the codebase

import { getSyncQueue, addToSyncQueue, removeFromSyncQueue, clearSyncQueue, isOnline, type PendingMutation } from '@/lib/offlineDb';

// Deprecated — kept for backward compatibility
export function getCachedData<T>(_key: string): T[] | null {
  return null; // IndexedDB is async; callers should use offlineDb directly
}

export function setCachedData<T>(_key: string, _data: T[]): void {
  // No-op — data is now in IndexedDB
}

export function isCacheStale(_key: string): boolean {
  return true;
}

export { isOnline };

// Sync versions for the pending mutation queue (used by OfflineIndicator polling)
export function getPendingMutations(): PendingMutation[] {
  // This is sync but queue is async now — we keep a sync mirror in localStorage for indicator
  try {
    const data = localStorage.getItem('chitra_sync_queue_count');
    return data ? new Array(parseInt(data)).fill(null) : [];
  } catch {
    return [];
  }
}

export function addPendingMutation(mutation: Omit<PendingMutation, 'id' | 'timestamp'>): void {
  addToSyncQueue(mutation).then(() => updateSyncCountMirror());
}

export function removePendingMutation(id: string): void {
  removeFromSyncQueue(id).then(() => updateSyncCountMirror());
}

export function clearPendingMutations(): void {
  clearSyncQueue().then(() => {
    localStorage.setItem('chitra_sync_queue_count', '0');
  });
}

// Keep a sync mirror of queue length in localStorage for the indicator to poll
async function updateSyncCountMirror() {
  try {
    const queue = await getSyncQueue();
    localStorage.setItem('chitra_sync_queue_count', queue.length.toString());
  } catch {
    // ignore
  }
}

// Export updater for use after sync operations
export { updateSyncCountMirror };
