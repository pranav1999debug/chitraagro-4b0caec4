import { useState, useEffect } from 'react';
import { WifiOff, Wifi, Upload, Clock } from 'lucide-react';
import { getPendingMutations } from '@/hooks/useOfflineCache';

const LAST_SYNC_KEY = 'chitra_last_sync_ts';

export function setLastSyncTimestamp() {
  localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
}

function getLastSyncTimestamp(): number | null {
  const ts = localStorage.getItem(LAST_SYNC_KEY);
  return ts ? parseInt(ts) : null;
}

function formatTimeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function OfflineIndicator() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [showSynced, setShowSynced] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(getLastSyncTimestamp());

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      setShowSynced(true);
      setTimeout(() => setShowSynced(false), 3000);
    };
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPendingCount(getPendingMutations().length);
      setLastSync(getLastSyncTimestamp());
    }, 2000);
    setPendingCount(getPendingMutations().length);
    setLastSync(getLastSyncTimestamp());
    return () => clearInterval(interval);
  }, []);

  if (online && pendingCount === 0 && !showSynced) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <div className={`mx-auto max-w-lg w-full px-3 py-1.5 flex items-center justify-center gap-2 text-xs font-heading font-semibold pointer-events-auto transition-all ${
        !online
          ? 'bg-destructive text-destructive-foreground'
          : pendingCount > 0
            ? 'bg-amber-500 text-white'
            : 'bg-primary text-primary-foreground'
      }`}>
        {!online ? (
          <>
            <WifiOff size={14} />
            <span>Offline Mode</span>
            {pendingCount > 0 && (
              <span className="bg-white/20 rounded-full px-2 py-0.5 text-[10px]">
                {pendingCount} pending
              </span>
            )}
            {lastSync && (
              <span className="bg-white/10 rounded-full px-2 py-0.5 text-[10px] flex items-center gap-0.5">
                <Clock size={8} /> {formatTimeAgo(lastSync)}
              </span>
            )}
          </>
        ) : pendingCount > 0 ? (
          <>
            <Upload size={14} className="animate-pulse" />
            <span>Syncing {pendingCount} changes...</span>
          </>
        ) : showSynced ? (
          <>
            <Wifi size={14} />
            <span>Back online — all synced ✓</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
