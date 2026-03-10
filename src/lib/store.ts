// Offline-first localStorage store

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  purchaseRate: number;
  openingBalance: number;
  timeGroup: 'morning' | 'evening' | 'both';
  milkType: 'cow' | 'buffalo' | 'mixed';
  createdAt: string;
}

export interface Transaction {
  id: string;
  customerId: string;
  dateKey: string; // YYYY-MM-DD nepali
  timeGroup: 'morning' | 'evening';
  quantity: number;
  price: number;
  mila: number;
  total: number;
}

export interface Payment {
  id: string;
  customerId: string;
  dateKey: string;
  amount: number;
  notes: string;
}

export interface Staff {
  id: string;
  name: string;
  position: string;
  phone: string;
  email: string;
  salary: number;
  advance: number;
  joinDate: string;
}

export interface Attendance {
  id: string;
  staffId: string;
  dateKey: string;
  present: boolean;
  advanceAmount: number;
}

export interface Expense {
  id: string;
  category: string;
  subCategory: string;
  amount: number;
  notes: string;
  dateKey: string;
}

export interface Procurement {
  id: string;
  supplierName: string;
  quantity: number;
  rate: number;
  total: number;
  dateKey: string;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getStore<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function setStore<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// Customers
export const customerStore = {
  getAll: (): Customer[] => getStore('chitra_customers'),
  add: (c: Omit<Customer, 'id' | 'createdAt'>): Customer => {
    const items = getStore<Customer>('chitra_customers');
    const newItem: Customer = { ...c, id: generateId(), createdAt: new Date().toISOString() };
    items.push(newItem);
    setStore('chitra_customers', items);
    return newItem;
  },
  update: (id: string, c: Partial<Customer>): void => {
    const items = getStore<Customer>('chitra_customers');
    const idx = items.findIndex(i => i.id === id);
    if (idx >= 0) { items[idx] = { ...items[idx], ...c }; setStore('chitra_customers', items); }
  },
  delete: (id: string): void => {
    setStore('chitra_customers', getStore<Customer>('chitra_customers').filter(i => i.id !== id));
  },
};

// Transactions
export const transactionStore = {
  getAll: (): Transaction[] => getStore('chitra_transactions'),
  getByDate: (dateKey: string): Transaction[] => getStore<Transaction>('chitra_transactions').filter(t => t.dateKey === dateKey),
  add: (t: Omit<Transaction, 'id'>): Transaction => {
    const items = getStore<Transaction>('chitra_transactions');
    const newItem: Transaction = { ...t, id: generateId() };
    items.push(newItem);
    setStore('chitra_transactions', items);
    return newItem;
  },
  update: (id: string, t: Partial<Transaction>): void => {
    const items = getStore<Transaction>('chitra_transactions');
    const idx = items.findIndex(i => i.id === id);
    if (idx >= 0) { items[idx] = { ...items[idx], ...t }; setStore('chitra_transactions', items); }
  },
  delete: (id: string): void => {
    setStore('chitra_transactions', getStore<Transaction>('chitra_transactions').filter(i => i.id !== id));
  },
};

// Payments
export const paymentStore = {
  getAll: (): Payment[] => getStore('chitra_payments'),
  getByCustomer: (customerId: string): Payment[] => getStore<Payment>('chitra_payments').filter(p => p.customerId === customerId),
  add: (p: Omit<Payment, 'id'>): Payment => {
    const items = getStore<Payment>('chitra_payments');
    const newItem: Payment = { ...p, id: generateId() };
    items.push(newItem);
    setStore('chitra_payments', items);
    return newItem;
  },
};

// Staff
export const staffStore = {
  getAll: (): Staff[] => getStore('chitra_staff'),
  add: (s: Omit<Staff, 'id'>): Staff => {
    const items = getStore<Staff>('chitra_staff');
    const newItem: Staff = { ...s, id: generateId() };
    items.push(newItem);
    setStore('chitra_staff', items);
    return newItem;
  },
  update: (id: string, s: Partial<Staff>): void => {
    const items = getStore<Staff>('chitra_staff');
    const idx = items.findIndex(i => i.id === id);
    if (idx >= 0) { items[idx] = { ...items[idx], ...s }; setStore('chitra_staff', items); }
  },
  delete: (id: string): void => {
    setStore('chitra_staff', getStore<Staff>('chitra_staff').filter(i => i.id !== id));
  },
};

// Attendance
export const attendanceStore = {
  getAll: (): Attendance[] => getStore('chitra_attendance'),
  getByStaffMonth: (staffId: string, yearMonth: string): Attendance[] =>
    getStore<Attendance>('chitra_attendance').filter(a => a.staffId === staffId && a.dateKey.startsWith(yearMonth)),
  upsert: (a: Omit<Attendance, 'id'>): void => {
    const items = getStore<Attendance>('chitra_attendance');
    const idx = items.findIndex(i => i.staffId === a.staffId && i.dateKey === a.dateKey);
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...a };
    } else {
      items.push({ ...a, id: generateId() });
    }
    setStore('chitra_attendance', items);
  },
};

// Expenses
export const expenseStore = {
  getAll: (): Expense[] => getStore('chitra_expenses'),
  getByMonth: (yearMonth: string): Expense[] =>
    getStore<Expense>('chitra_expenses').filter(e => e.dateKey.startsWith(yearMonth)),
  add: (e: Omit<Expense, 'id'>): Expense => {
    const items = getStore<Expense>('chitra_expenses');
    const newItem: Expense = { ...e, id: generateId() };
    items.push(newItem);
    setStore('chitra_expenses', items);
    return newItem;
  },
  update: (id: string, e: Partial<Expense>): void => {
    const items = getStore<Expense>('chitra_expenses');
    const idx = items.findIndex(i => i.id === id);
    if (idx >= 0) { items[idx] = { ...items[idx], ...e }; setStore('chitra_expenses', items); }
  },
  delete: (id: string): void => {
    setStore('chitra_expenses', getStore<Expense>('chitra_expenses').filter(i => i.id !== id));
  },
};

// Procurement
export const procurementStore = {
  getAll: (): Procurement[] => getStore('chitra_procurement'),
  getByMonth: (yearMonth: string): Procurement[] =>
    getStore<Procurement>('chitra_procurement').filter(p => p.dateKey.startsWith(yearMonth)),
  add: (p: Omit<Procurement, 'id'>): Procurement => {
    const items = getStore<Procurement>('chitra_procurement');
    const newItem: Procurement = { ...p, id: generateId() };
    items.push(newItem);
    setStore('chitra_procurement', items);
    return newItem;
  },
  delete: (id: string): void => {
    setStore('chitra_procurement', getStore<Procurement>('chitra_procurement').filter(i => i.id !== id));
  },
};

// Language preference
export const langStore = {
  get: (): 'en' | 'hi' => (localStorage.getItem('chitra_lang') as 'en' | 'hi') || 'en',
  set: (lang: 'en' | 'hi') => localStorage.setItem('chitra_lang', lang),
};
