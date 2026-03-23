import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCollection,
  setCollection,
  upsertItem,
  removeItem,
  updateItem,
  addToSyncQueue,
  isOnline,
} from '@/lib/offlineDb';
import { pullFromServer, pullFromServerFiltered, flushSyncQueue } from '@/lib/syncEngine';

// ============ Generic local-first query hook ============

function useFarmQuery<T extends { id: string }>(
  key: string,
  table: string,
  opts?: {
    filters?: Record<string, any>;
    enabled?: boolean;
  }
) {
  const { farmId } = useAuth();

  return useQuery<T[]>({
    queryKey: [key, farmId, opts?.filters],
    queryFn: async () => {
      if (!farmId) return [];

      // 1. Read from IndexedDB first (instant)
      const local = await getCollection<T>(table, farmId);

      // 2. If offline, return local data
      if (!isOnline()) return local;

      // 3. If online, pull from server in background and update IndexedDB
      try {
        let serverData: T[];
        if (opts?.filters && Object.keys(opts.filters).length > 0) {
          serverData = await pullFromServerFiltered<T>(
            table as any,
            farmId,
            opts.filters
          );
          // For filtered queries, merge into the full collection
          const fullLocal = await getCollection<T>(table, farmId);
          const serverIds = new Set(serverData.map((s) => s.id));
          // Keep non-matching local items, replace matching with server data
          const merged = fullLocal.filter((l) => !serverIds.has(l.id));
          merged.push(...serverData);
          await setCollection(table, farmId, merged);
        } else {
          serverData = await pullFromServer<T>(table as any, farmId);
        }
        return serverData;
      } catch {
        // Network error — return local data
        return local;
      }
    },
    enabled: opts?.enabled !== undefined ? opts.enabled && !!farmId : !!farmId,
    // Serve stale local data instantly while revalidating
    staleTime: 0,
  });
}

// ============ Generic mutation helpers ============

function useLocalFirstAdd<T extends { id: string }>(table: string, invalidateKeys: string[]) {
  const qc = useQueryClient();
  const { farmId } = useAuth();

  return useMutation({
    mutationFn: async (data: Omit<T, 'id' | 'farm_id' | 'created_at' | 'updated_at'> & Record<string, any>) => {
      if (!farmId) throw new Error('No farm selected');
      const now = new Date().toISOString();
      const item = {
        ...data,
        id: crypto.randomUUID(),
        farm_id: farmId,
        created_at: now,
        updated_at: now,
      } as unknown as T;

      // 1. Write to IndexedDB immediately
      await upsertItem<T>(table, farmId, item);

      // 2. Enqueue sync mutation
      const { id: _id, ...payload } = item as any;
      await addToSyncQueue({ table, action: 'insert', data: { ...item } as any });

      // 3. If online, flush immediately
      if (isOnline()) {
        flushSyncQueue().catch(console.error);
      }

      return item;
    },
    onSuccess: () => {
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
  });
}

function useLocalFirstUpdate<T extends { id: string }>(table: string, invalidateKeys: string[]) {
  const qc = useQueryClient();
  const { farmId } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<T>) => {
      if (!farmId) throw new Error('No farm selected');
      const patchWithTs = { ...patch, updated_at: new Date().toISOString() };

      // 1. Update IndexedDB
      await updateItem<T>(table, farmId, id, patchWithTs as Partial<T>);

      // 2. Enqueue
      await addToSyncQueue({ table, action: 'update', data: { id, ...patchWithTs } });

      // 3. Flush if online
      if (isOnline()) {
        flushSyncQueue().catch(console.error);
      }
    },
    onSuccess: () => {
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
  });
}

function useLocalFirstDelete<T extends { id: string }>(table: string, invalidateKeys: string[]) {
  const qc = useQueryClient();
  const { farmId } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!farmId) throw new Error('No farm selected');

      // 1. Remove from IndexedDB
      await removeItem<T>(table, farmId, id);

      // 2. Enqueue
      await addToSyncQueue({ table, action: 'delete', data: { id } });

      // 3. Flush if online
      if (isOnline()) {
        flushSyncQueue().catch(console.error);
      }
    },
    onSuccess: () => {
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
  });
}

// ==================== CUSTOMERS ====================
export interface DbCustomer {
  id: string;
  farm_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  purchase_rate: number;
  opening_balance: number;
  time_group: string;
  milk_type: string;
  is_active: boolean;
  default_qty_morning: number;
  default_qty_evening: number;
  created_at: string;
  updated_at: string;
}

export function useCustomers() {
  return useFarmQuery<DbCustomer>('customers', 'customers');
}

export function useCustomerMutations() {
  const add = useLocalFirstAdd<DbCustomer>('customers', ['customers']);
  const update = useLocalFirstUpdate<DbCustomer>('customers', ['customers']);
  const remove = useLocalFirstDelete<DbCustomer>('customers', ['customers']);
  return { add, update, remove };
}

// ==================== TRANSACTIONS ====================
export interface DbTransaction {
  id: string;
  farm_id: string;
  customer_id: string;
  date_key: string;
  time_group: string;
  quantity: number;
  price: number;
  mila: number;
  total: number;
  created_at: string;
  updated_at: string;
}

const TX_KEYS = ['transactions', 'all-transactions', 'customer-transactions'];

export function useTransactions(dateKey?: string) {
  return useFarmQuery<DbTransaction>('transactions', 'transactions', {
    filters: dateKey ? { date_key: dateKey } : undefined,
  });
}

export function useAllTransactions() {
  return useFarmQuery<DbTransaction>('all-transactions', 'transactions');
}

export function useCustomerMonthTransactions(customerId: string | undefined, yearMonth: string) {
  const { farmId } = useAuth();

  return useQuery<DbTransaction[]>({
    queryKey: ['customer-transactions', farmId, customerId, yearMonth],
    queryFn: async () => {
      if (!farmId || !customerId) return [];

      // Read all transactions from IndexedDB and filter locally
      const allTx = await getCollection<DbTransaction>('transactions', farmId);
      const localFiltered = allTx.filter(
        (tx) => tx.customer_id === customerId && tx.date_key.startsWith(yearMonth)
      );

      if (!isOnline()) return localFiltered;

      // Pull filtered from server
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('farm_id', farmId)
          .eq('customer_id', customerId)
          .like('date_key', `${yearMonth}%`);
        if (error) throw error;
        const serverData = (data || []) as DbTransaction[];

        // Merge into full local collection
        const fullLocal = await getCollection<DbTransaction>('transactions', farmId);
        const serverIds = new Set(serverData.map((s) => s.id));
        // Remove old matching entries, add server ones
        const nonMatching = fullLocal.filter(
          (l) => !(l.customer_id === customerId && l.date_key.startsWith(yearMonth))
        );
        nonMatching.push(...serverData);
        await setCollection('transactions', farmId, nonMatching);

        return serverData;
      } catch {
        return localFiltered;
      }
    },
    enabled: !!farmId && !!customerId,
  });
}

export function useTransactionMutations() {
  const qc = useQueryClient();
  const { farmId } = useAuth();

  const add = useMutation({
    mutationFn: async (t: Omit<DbTransaction, 'id' | 'farm_id' | 'created_at' | 'updated_at'>) => {
      if (!farmId) throw new Error('No farm selected');
      const now = new Date().toISOString();
      const item: DbTransaction = {
        ...t,
        id: crypto.randomUUID(),
        farm_id: farmId,
        created_at: now,
        updated_at: now,
      };

      await upsertItem<DbTransaction>('transactions', farmId, item);
      await addToSyncQueue({ table: 'transactions', action: 'insert', data: { ...item } });

      if (isOnline()) flushSyncQueue().catch(console.error);
      return item;
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...t }: { id: string } & Partial<DbTransaction>) => {
      if (!farmId) throw new Error('No farm selected');
      const patch = { ...t, updated_at: new Date().toISOString() };
      await updateItem<DbTransaction>('transactions', farmId, id, patch);
      await addToSyncQueue({ table: 'transactions', action: 'update', data: { id, ...patch } });
      if (isOnline()) flushSyncQueue().catch(console.error);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!farmId) throw new Error('No farm selected');
      await removeItem<DbTransaction>('transactions', farmId, id);
      await addToSyncQueue({ table: 'transactions', action: 'delete', data: { id } });
      if (isOnline()) flushSyncQueue().catch(console.error);
    },
    onSuccess: () => {
      TX_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
  });

  const invalidateAll = () => {
    TX_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  return { add, update, remove, invalidateAll };
}

// ==================== PAYMENTS ====================
export interface DbPayment {
  id: string;
  farm_id: string;
  customer_id: string;
  date_key: string;
  amount: number;
  notes: string | null;
  created_at: string;
}

export function usePayments() {
  return useFarmQuery<DbPayment>('payments', 'payments');
}

export function usePaymentMutations() {
  const add = useLocalFirstAdd<DbPayment>('payments', ['payments']);
  const remove = useLocalFirstDelete<DbPayment>('payments', ['payments']);
  return { add, remove };
}

// ==================== STAFF ====================
export interface DbStaff {
  id: string;
  farm_id: string;
  name: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  salary: number;
  advance: number;
  join_date: string | null;
  created_at: string;
  updated_at: string;
}

export function useStaff() {
  return useFarmQuery<DbStaff>('staff', 'staff');
}

export function useStaffMutations() {
  const add = useLocalFirstAdd<DbStaff>('staff', ['staff']);
  const update = useLocalFirstUpdate<DbStaff>('staff', ['staff']);
  const remove = useLocalFirstDelete<DbStaff>('staff', ['staff']);
  return { add, update, remove };
}

// ==================== ATTENDANCE ====================
export interface DbAttendance {
  id: string;
  farm_id: string;
  staff_id: string;
  date_key: string;
  present: boolean;
  advance_amount: number;
  created_at: string;
}

export function useAttendance(staffId: string, yearMonth: string) {
  const { farmId } = useAuth();

  return useQuery<DbAttendance[]>({
    queryKey: ['attendance', farmId, staffId, yearMonth],
    queryFn: async () => {
      if (!farmId) return [];

      // Read from IndexedDB and filter
      const all = await getCollection<DbAttendance>('attendance', farmId);
      const localFiltered = all.filter(
        (a) => a.staff_id === staffId && a.date_key.startsWith(yearMonth)
      );

      if (!isOnline()) return localFiltered;

      try {
        const { data, error } = await supabase
          .from('attendance')
          .select('*')
          .eq('farm_id', farmId)
          .eq('staff_id', staffId)
          .like('date_key', `${yearMonth}%`);
        if (error) throw error;
        const serverData = (data || []) as DbAttendance[];

        // Merge into full local
        const fullLocal = await getCollection<DbAttendance>('attendance', farmId);
        const nonMatching = fullLocal.filter(
          (l) => !(l.staff_id === staffId && l.date_key.startsWith(yearMonth))
        );
        nonMatching.push(...serverData);
        await setCollection('attendance', farmId, nonMatching);

        return serverData;
      } catch {
        return localFiltered;
      }
    },
    enabled: !!farmId && !!staffId,
  });
}

export function useAllAttendance() {
  return useFarmQuery<DbAttendance>('all-attendance', 'attendance');
}

export function useAttendanceMutations() {
  const qc = useQueryClient();
  const { farmId } = useAuth();

  const upsert = useMutation({
    mutationFn: async (a: { staff_id: string; date_key: string; present: boolean; advance_amount: number }) => {
      if (!farmId) throw new Error('No farm selected');

      // Check if exists locally
      const all = await getCollection<DbAttendance>('attendance', farmId);
      const existing = all.find((x) => x.staff_id === a.staff_id && x.date_key === a.date_key);

      if (existing) {
        // Update locally
        await updateItem<DbAttendance>('attendance', farmId, existing.id, {
          present: a.present,
          advance_amount: a.advance_amount,
        });
        await addToSyncQueue({
          table: 'attendance',
          action: 'update',
          data: { id: existing.id, present: a.present, advance_amount: a.advance_amount },
        });
      } else {
        const item: DbAttendance = {
          ...a,
          id: crypto.randomUUID(),
          farm_id: farmId,
          created_at: new Date().toISOString(),
        };
        await upsertItem<DbAttendance>('attendance', farmId, item);
        await addToSyncQueue({ table: 'attendance', action: 'insert', data: { ...item } });
      }

      if (isOnline()) flushSyncQueue().catch(console.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['all-attendance'] });
    },
  });

  return { upsert };
}

// ==================== EXPENSES ====================
export interface DbExpense {
  id: string;
  farm_id: string;
  category: string;
  sub_category: string | null;
  amount: number;
  notes: string | null;
  date_key: string;
  created_at: string;
  updated_at: string;
}

const EXPENSE_KEYS = ['expenses', 'all-expenses'];

export function useExpenses(yearMonth?: string) {
  return useFarmQuery<DbExpense>('expenses', 'expenses', {
    filters: yearMonth ? { date_key_like: `${yearMonth}%` } : undefined,
  });
}

export function useAllExpenses() {
  return useFarmQuery<DbExpense>('all-expenses', 'expenses');
}

export function useExpenseMutations() {
  const add = useLocalFirstAdd<DbExpense>('expenses', EXPENSE_KEYS);
  const update = useLocalFirstUpdate<DbExpense>('expenses', EXPENSE_KEYS);
  const remove = useLocalFirstDelete<DbExpense>('expenses', EXPENSE_KEYS);
  return { add, update, remove };
}

// ==================== SUPPLIERS ====================
export interface DbSupplier {
  id: string;
  farm_id: string;
  name: string;
  phone: string | null;
  default_qty: number;
  default_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useSuppliers() {
  return useFarmQuery<DbSupplier>('suppliers', 'suppliers');
}

export function useSupplierMutations() {
  const add = useLocalFirstAdd<DbSupplier>('suppliers', ['suppliers']);
  const update = useLocalFirstUpdate<DbSupplier>('suppliers', ['suppliers']);
  const remove = useLocalFirstDelete<DbSupplier>('suppliers', ['suppliers']);
  return { add, update, remove };
}

// ==================== PROCUREMENT ====================
export interface DbProcurement {
  id: string;
  farm_id: string;
  supplier_name: string;
  supplier_id: string | null;
  quantity: number;
  rate: number;
  total: number;
  date_key: string;
  created_at: string;
}

const PROC_KEYS = ['procurement', 'all-procurement'];

export function useProcurement(yearMonth?: string) {
  return useFarmQuery<DbProcurement>('procurement', 'procurement', {
    filters: yearMonth ? { date_key_like: `${yearMonth}%` } : undefined,
  });
}

export function useAllProcurement() {
  return useFarmQuery<DbProcurement>('all-procurement', 'procurement');
}

export function useProcurementMutations() {
  const add = useLocalFirstAdd<DbProcurement>('procurement', PROC_KEYS);
  const remove = useLocalFirstDelete<DbProcurement>('procurement', PROC_KEYS);
  return { add, remove };
}
