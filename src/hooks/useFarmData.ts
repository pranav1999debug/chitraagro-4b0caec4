import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Generic farm-scoped query hook
function useFarmQuery<T>(key: string, table: string, extraFilter?: (q: any) => any) {
  const { farmId } = useAuth();
  return useQuery<T[]>({
    queryKey: [key, farmId],
    queryFn: async () => {
      if (!farmId) return [];
      let q = supabase.from(table).select('*').eq('farm_id', farmId);
      if (extraFilter) q = extraFilter(q);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as T[];
    },
    enabled: !!farmId,
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
      const { error } = await supabase.from('customers').insert({ ...c, farm_id: farmId! });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...c }: { id: string } & Partial<DbCustomer>) => {
      const { error } = await supabase.from('customers').update(c).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
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
  return useFarmQuery<DbTransaction>('transactions', 'transactions',
    dateKey ? (q: any) => q.eq('date_key', dateKey) : undefined
  );
}

export function useAllTransactions() {
  return useFarmQuery<DbTransaction>('all-transactions', 'transactions');
}

export function useTransactionMutations() {
  const qc = useQueryClient();
  const { farmId } = useAuth();

  const add = useMutation({
    mutationFn: async (t: Omit<DbTransaction, 'id' | 'farm_id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('transactions').insert({ ...t, farm_id: farmId! }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['all-transactions'] });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...t }: { id: string } & Partial<DbTransaction>) => {
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
      const { error } = await supabase.from('payments').insert({ ...p, farm_id: farmId! });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  });

  return { add };
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
      const { error } = await supabase.from('staff').insert({ ...s, farm_id: farmId! });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...s }: { id: string } & Partial<DbStaff>) => {
      const { error } = await supabase.from('staff').update(s).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
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
  return useQuery<DbAttendance[]>({
    queryKey: ['attendance', farmId, staffId, yearMonth],
    queryFn: async () => {
      if (!farmId) return [];
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('farm_id', farmId)
        .eq('staff_id', staffId)
        .like('date_key', `${yearMonth}%`);
      if (error) throw error;
      return (data || []) as DbAttendance[];
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
      // Try to find existing
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
      const { error } = await supabase.from('expenses').insert({ ...e, farm_id: farmId! });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['all-expenses'] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
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

// ==================== PROCUREMENT ====================
export interface DbProcurement {
  id: string;
  farm_id: string;
  supplier_name: string;
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
      const { error } = await supabase.from('procurement').insert({ ...p, farm_id: farmId! });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['procurement'] });
      qc.invalidateQueries({ queryKey: ['all-procurement'] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
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
