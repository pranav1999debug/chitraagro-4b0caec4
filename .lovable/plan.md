

## Plan: Refactor to IndexedDB-first Offline Architecture

### What You Asked For
1. Reset all data (clear local caches)
2. Use IndexedDB (via `localForage`) as the primary data store for all CRUD
3. Save locally first, update UI immediately
4. Sync queue that pushes to backend when online (last-write-wins)
5. List views read from local storage, not API

### Current State
- `useFarmData.ts` (692 lines) has all hooks — each does API-first reads with localStorage cache as fallback
- `useOfflineCache.ts` uses `localStorage` with a simple pending mutation queue
- `useOfflineSync.ts` flushes pending mutations on reconnect
- No `localForage` or IndexedDB dependency exists yet

### Architecture

```text
┌─────────────┐     write      ┌──────────────┐    sync     ┌──────────┐
│   UI/Hooks   │ ──────────── │  IndexedDB    │ ─────────── │ Supabase │
│  (React Q)   │ ◄──────────  │  (localForage)│ ◄────────── │  (Cloud) │
└─────────────┘     read       └──────────────┘   pull       └──────────┘
```

### Implementation Steps

#### Step 1: Add `localforage` dependency
- Install `localforage` (IndexedDB wrapper with localStorage fallback)

#### Step 2: Create `src/lib/offlineDb.ts` — IndexedDB data layer
- Configure localForage instance (`chitraDb`)
- Generic helpers: `getCollection<T>(table, farmId)`, `setCollection<T>(table, farmId, data)`, `upsertItem<T>()`, `removeItem<T>()`
- Each table stored as a key like `customers_{farmId}` containing the full array
- Timestamp tracking per collection for sync freshness

#### Step 3: Create `src/lib/syncEngine.ts` — Sync queue + conflict resolution
- Replace `useOfflineCache.ts` pending mutation queue with IndexedDB-backed queue
- Queue structure: `{ id, table, action, data, timestamp, synced }`
- On connectivity restore: flush queue to Supabase in order
- **Last-write-wins**: use `updated_at` timestamp — when pushing, if server record has newer `updated_at`, skip the local mutation; otherwise overwrite
- After flush, pull fresh data from Supabase and merge into IndexedDB
- Background pull: periodic (every 5 min when online) to stay fresh

#### Step 4: Rewrite `src/hooks/useFarmData.ts` — local-first hooks
- `useFarmQuery<T>()`: reads from IndexedDB first (instant), then triggers background sync if online
- React Query `queryFn` reads IndexedDB → returns immediately → if online, fetches from Supabase, merges into IndexedDB, updates React Query cache
- All mutations: write to IndexedDB first → update React Query cache → enqueue sync mutation → if online, flush immediately
- Optimistic IDs: generate UUID locally (using `crypto.randomUUID()`) so IDs are stable across sync

#### Step 5: Rewrite `src/hooks/useOfflineSync.ts`
- Use the new `syncEngine` to flush on `online` event and on mount
- Invalidate React Query after successful sync
- Update last-sync timestamp

#### Step 6: Update `src/hooks/useOfflineCache.ts`
- Deprecate/remove localStorage-based cache functions
- Re-export from new `offlineDb.ts` for any remaining references

#### Step 7: Update `OfflineIndicator.tsx`
- Read pending count from IndexedDB-backed sync queue instead of localStorage

#### Step 8: Data reset
- On app init or via a settings action, clear all IndexedDB stores and localStorage caches so the app starts fresh, then pull from Supabase

### Key Design Decisions
- **localForage** over raw IndexedDB: simpler API, automatic fallback to localStorage on old browsers
- **UUID generation client-side**: `crypto.randomUUID()` ensures IDs are stable — no need to replace `local_` prefixed IDs after sync
- **Last-write-wins by `updated_at`**: simple, predictable conflict resolution suitable for single-user-per-farm pattern
- **Collection-level storage**: store full arrays per table/farm (not individual records) for simpler reads — matches current pattern

### Files Changed
| File | Action |
|------|--------|
| `package.json` | Add `localforage` |
| `src/lib/offlineDb.ts` | **Create** — IndexedDB data layer |
| `src/lib/syncEngine.ts` | **Create** — Sync queue + conflict resolution |
| `src/hooks/useFarmData.ts` | **Rewrite** — Local-first reads/writes |
| `src/hooks/useOfflineSync.ts` | **Rewrite** — Use syncEngine |
| `src/hooks/useOfflineCache.ts` | **Rewrite** — IndexedDB-backed |
| `src/components/OfflineIndicator.tsx` | **Update** — Read from syncEngine |

