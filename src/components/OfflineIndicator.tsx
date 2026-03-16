import { useState, useEffect } from 'react';
import { WifiOff, Wifi, CloudOff, Upload } from 'lucide-react';
import { getPendingMutations } from '@/hooks/useOfflineCache';

export default function OfflineIndicator() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [showSynced, setShowSynced] = useState(false);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      // Show "synced" briefly when coming back online
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

  // Poll pending mutations count
  useEffect(() => {
    const interval = setInterval(() => {
      setPendingCount(getPendingMutations().length);
    }, 2000);
    setPendingCount(getPendingMutations().length);
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
