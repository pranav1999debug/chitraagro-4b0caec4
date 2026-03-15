import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';
import { getCachedData, setCachedData, isOnline, addPendingMutation } from '@/hooks/useOfflineCache';

type TableName = keyof Database['public']['Tables'];

// Generic farm-scoped query hook with offline caching
function useFarmQuery<T>(key: string, table: TableName, extraFilter?: (q: any) => any) {
  const { farmId } = useAuth();
  const cacheKey = `${key}_${farmId}`;

  return useQuery<T[]>({
    queryKey: [key, farmId],
    queryFn: async () => {
      if (!farmId) return [];
      if (!isOnline()) {
        const cached = getCachedData<T>(cacheKey);
        return cached || [];
      }
      let q = (supabase.from(table) as any).select('*').eq('farm_id', farmId).limit(10000);
      if (extraFilter) q = extraFilter(q);
      const { data, error } = await q;
      if (error) throw error;
      const result = (data || []) as T[];
      setCachedData(cacheKey, result);
      return result;
    },
    enabled: !!farmId,
    placeholderData: () => {
      if (!farmId) return undefined;
      const cached = getCachedData<T>(cacheKey);
      return cached || undefined;
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
  const qc = useQueryClient();
  const { farmId } = useAuth();

  const add = useMutation({
    mutationFn: async (c: Omit<DbCustomer, 'id' | 'farm_id' | 'created_at' | 'updated_at'>) => {
      const payload = { ...c, farm_id: farmId! };
      if (!isOnline()) { addPendingMutation({ table: 'customers', action: 'insert', data: payload }); return; }
      const { error } = await supabase.from('customers').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...c }: { id: string } & Partial<DbCustomer>) => {
      if (!isOnline()) { addPendingMutation({ table: 'customers', action: 'update', data: { id, ...c } }); return; }
      const { error } = await supabase.from('customers').update(c).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline()) { addPendingMutation({ table: 'customers', action: 'delete', data: { id } }); return; }
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });

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

export function useTransactions(dateKey?: string) {
  const { farmId } = useAuth();
  const cacheKey = `transactions_${farmId}_${dateKey}`;

  return useQuery<DbTransaction[]>({
    queryKey: ['transactions', farmId, dateKey],
    queryFn: async () => {
      if (!farmId) return [];
      if (!isOnline()) {
        return getCachedData<DbTransaction>(cacheKey) || [];
      }
      let q = supabase.from('transactions').select('*').eq('farm_id', farmId);
      if (dateKey) q = q.eq('date_key', dateKey);
      const { data, error } = await q;
      if (error) throw error;
      const result = (data || []) as DbTransaction[];
      setCachedData(cacheKey, result);
      return result;
    },
    enabled: !!farmId,
    placeholderData: () => {
      if (!farmId) return undefined;
      return getCachedData<DbTransaction>(cacheKey) || undefined;
    },
  });
}

export function useAllTransactions() {
  return useFarmQuery<DbTransaction>('all-transactions', 'transactions');
}

export function useTransactionMutations() {
  const qc = useQueryClient();
  const { farmId } = useAuth();

  const add = useMutation({
    mutationFn: async (t: Omit<DbTransaction, 'id' | 'farm_id' | 'created_at' | 'updated_at'>) => {
      const payload = { ...t, farm_id: farmId! };
      if (!isOnline()) {
        // Generate a temporary ID for optimistic update
        const tempId = 'offline_' + Date.now().toString(36);
        const optimistic: DbTransaction = {
          id: tempId, farm_id: farmId!, created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(), ...t,
        };
        addPendingMutation({ table: 'transactions', action: 'insert', data: payload });
        // Optimistically update the cache
        const cacheKey = `transactions_${farmId}_${t.date_key}`;
        const cached = getCachedData<DbTransaction>(cacheKey) || [];
        setCachedData(cacheKey, [...cached, optimistic]);
        return optimistic;
      }
      const { data, error } = await supabase.from('transactions').insert(payload).select().single();
      if (error) throw error;
      // Update the localStorage cache too
      const cacheKey = `transactions_${farmId}_${t.date_key}`;
      const cached = getCachedData<DbTransaction>(cacheKey) || [];
      setCachedData(cacheKey, [...cached, data as DbTransaction]);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['all-transactions'] });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...t }: { id: string } & Partial<DbTransaction>) => {
      if (!isOnline()) {
        addPendingMutation({ table: 'transactions', action: 'update', data: { id, ...t } });
        // Optimistically update cache for all matching date keys
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('chitra_cache_transactions_')) {
            const cached = getCachedData<DbTransaction>(key.replace('chitra_cache_', '')) || [];
            const updated = cached.map(tx => tx.id === id ? { ...tx, ...t, updated_at: new Date().toISOString() } : tx);
            setCachedData(key.replace('chitra_cache_', ''), updated);
          }
        }
        return;
      }
      const { error } = await supabase.from('transactions').update(t).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['all-transactions'] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline()) { addPendingMutation({ table: 'transactions', action: 'delete', data: { id } }); return; }
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['all-transactions'] });
    },
  });

  return { add, update, remove };
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
  const qc = useQueryClient();
  const { farmId } = useAuth();

  const add = useMutation({
    mutationFn: async (p: Omit<DbPayment, 'id' | 'farm_id' | 'created_at'>) => {
      const payload = { ...p, farm_id: farmId! };
      if (!isOnline()) { addPendingMutation({ table: 'payments', action: 'insert', data: payload }); return; }
      const { error } = await supabase.from('payments').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline()) { addPendingMutation({ table: 'payments', action: 'delete', data: { id } }); return; }
      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  });

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
  const qc = useQueryClient();
  const { farmId } = useAuth();

  const add = useMutation({
    mutationFn: async (s: Omit<DbStaff, 'id' | 'farm_id' | 'created_at' | 'updated_at'>) => {
      const payload = { ...s, farm_id: farmId! };
      if (!isOnline()) { addPendingMutation({ table: 'staff', action: 'insert', data: payload }); return; }
      const { error } = await supabase.from('staff').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...s }: { id: string } & Partial<DbStaff>) => {
      if (!isOnline()) { addPendingMutation({ table: 'staff', action: 'update', data: { id, ...s } }); return; }
      const { error } = await supabase.from('staff').update(s).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline()) { addPendingMutation({ table: 'staff', action: 'delete', data: { id } }); return; }
      const { error } = await supabase.from('staff').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });

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
  const cacheKey = `attendance_${farmId}_${staffId}_${yearMonth}`;

  return useQuery<DbAttendance[]>({
    queryKey: ['attendance', farmId, staffId, yearMonth],
    queryFn: async () => {
      if (!farmId) return [];
      if (!isOnline()) {
        return getCachedData<DbAttendance>(cacheKey) || [];
      }
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('farm_id', farmId)
        .eq('staff_id', staffId)
        .like('date_key', `${yearMonth}%`);
      if (error) throw error;
      const result = (data || []) as DbAttendance[];
      setCachedData(cacheKey, result);
      return result;
    },
    enabled: !!farmId && !!staffId,
    placeholderData: () => {
      if (!farmId) return undefined;
      return getCachedData<DbAttendance>(cacheKey) || undefined;
    },
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
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('staff_id', a.staff_id)
        .eq('date_key', a.date_key)
        .single();

      if (existing) {
        const { error } = await supabase.from('attendance')
          .update({ present: a.present, advance_amount: a.advance_amount })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('attendance')
          .insert({ ...a, farm_id: farmId! });
        if (error) throw error;
      }
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

export function useExpenses(yearMonth?: string) {
  return useFarmQuery<DbExpense>('expenses', 'expenses',
    yearMonth ? (q: any) => q.like('date_key', `${yearMonth}%`) : undefined
  );
}

export function useAllExpenses() {
  return useFarmQuery<DbExpense>('all-expenses', 'expenses');
}

export function useExpenseMutations() {
  const qc = useQueryClient();
  const { farmId } = useAuth();

  const add = useMutation({
    mutationFn: async (e: Omit<DbExpense, 'id' | 'farm_id' | 'created_at' | 'updated_at'>) => {
      const payload = { ...e, farm_id: farmId! };
      if (!isOnline()) { addPendingMutation({ table: 'expenses', action: 'insert', data: payload }); return; }
      const { error } = await supabase.from('expenses').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['all-expenses'] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline()) { addPendingMutation({ table: 'expenses', action: 'delete', data: { id } }); return; }
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['all-expenses'] });
    },
  });

  return { add, remove };
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
  return useFarmQuery<DbSupplier>('suppliers', 'suppliers' as any);
}

export function useSupplierMutations() {
  const qc = useQueryClient();
  const { farmId } = useAuth();

  const add = useMutation({
    mutationFn: async (s: Omit<DbSupplier, 'id' | 'farm_id' | 'created_at' | 'updated_at'>) => {
      const payload = { ...s, farm_id: farmId! };
      if (!isOnline()) { addPendingMutation({ table: 'suppliers' as any, action: 'insert', data: payload }); return; }
      const { error } = await (supabase.from('suppliers' as any) as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...s }: { id: string } & Partial<DbSupplier>) => {
      if (!isOnline()) { addPendingMutation({ table: 'suppliers' as any, action: 'update', data: { id, ...s } }); return; }
      const { error } = await (supabase.from('suppliers' as any) as any).update(s).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline()) { addPendingMutation({ table: 'suppliers' as any, action: 'delete', data: { id } }); return; }
      const { error } = await (supabase.from('suppliers' as any) as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });

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

export function useProcurement(yearMonth?: string) {
  return useFarmQuery<DbProcurement>('procurement', 'procurement',
    yearMonth ? (q: any) => q.like('date_key', `${yearMonth}%`) : undefined
  );
}

export function useAllProcurement() {
  return useFarmQuery<DbProcurement>('all-procurement', 'procurement');
}

export function useProcurementMutations() {
  const qc = useQueryClient();
  const { farmId } = useAuth();

  const add = useMutation({
    mutationFn: async (p: Omit<DbProcurement, 'id' | 'farm_id' | 'created_at'>) => {
      const payload = { ...p, farm_id: farmId! };
      if (!isOnline()) { addPendingMutation({ table: 'procurement', action: 'insert', data: payload }); return; }
      const { error } = await supabase.from('procurement').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['procurement'] });
      qc.invalidateQueries({ queryKey: ['all-procurement'] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline()) { addPendingMutation({ table: 'procurement', action: 'delete', data: { id } }); return; }
      const { error } = await supabase.from('procurement').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['procurement'] });
      qc.invalidateQueries({ queryKey: ['all-procurement'] });
    },
  });

  return { add, remove };
}
