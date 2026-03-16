import { useCallback, useMemo, useState } from 'react';
import AppHeader from '@/components/AppHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';
import { getAvailableYears, getNepaliMonthName, getTodayNepali } from '@/lib/nepaliDate';
import {
  useAllTransactions,
  useCustomers,
  useCustomerMutations,
  useTransactionMutations,
  type DbCustomer,
  type DbTransaction,
} from '@/hooks/useFarmData';
import { Search, Plus, Trash2, Edit, X, ToggleLeft, ToggleRight, FileSpreadsheet, Save, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const emptyForm = {
  name: '',
  phone: '' as string | null,
  address: '' as string | null,
  purchase_rate: 0,
  opening_balance: 0,
  time_group: 'morning',
  milk_type: 'cow',
  is_active: true,
  default_qty_morning: 0,
  default_qty_evening: 0,
};

interface SheetDraft {
  quantity: string;
  price: string;
  dirty: boolean;
}

export default function Customers() {
  const { lang } = useApp();
  const { role } = useAuth();
  const today = getTodayNepali();

  const { data: customers = [], isLoading } = useCustomers();
  const { data: allTransactions = [] } = useAllTransactions();
  const { add, update, remove } = useCustomerMutations();
  const { update: updateTransaction } = useTransactionMutations();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showInactive, setShowInactive] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [sheetYear, setSheetYear] = useState(today.year);
  const [sheetMonth, setSheetMonth] = useState(today.month);
  const [openSheetCustomerId, setOpenSheetCustomerId] = useState<string | null>(null);
  const [editSheetCustomerId, setEditSheetCustomerId] = useState<string | null>(null);
  const [sheetDrafts, setSheetDrafts] = useState<Record<string, SheetDraft>>({});
  const [sheetSaving, setSheetSaving] = useState(false);

  const canEdit = role === 'owner' || role === 'manager';
  const canDelete = role === 'owner';

  const yearMonth = `${sheetYear}-${String(sheetMonth).padStart(2, '0')}`;
  const monthLabel = `${getNepaliMonthName(sheetMonth, lang === 'hi' ? 'np' : 'en')} ${sheetYear}`;

  const monthTransactionsByCustomer = useMemo(() => {
    const map: Record<string, DbTransaction[]> = {};
    allTransactions
      .filter(tx => tx.date_key.startsWith(yearMonth))
      .forEach(tx => {
        if (!map[tx.customer_id]) map[tx.customer_id] = [];
        map[tx.customer_id].push(tx);
      });

    Object.values(map).forEach(list => {
      list.sort((a, b) => {
        if (a.date_key === b.date_key) return a.time_group.localeCompare(b.time_group);
        return a.date_key.localeCompare(b.date_key);
      });
    });

    return map;
  }, [allTransactions, yearMonth]);

  const filtered = customers.filter(c => {
    if (!showInactive && c.is_active === false) return false;
    return c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search);
  });

  const morningCustomers = filtered.filter(c => c.time_group === 'morning' || c.time_group === 'both');
  const eveningCustomers = filtered.filter(c => c.time_group === 'evening' || c.time_group === 'both');

  const initializeSheetDrafts = useCallback((customerId: string) => {
    const rows = monthTransactionsByCustomer[customerId] || [];
    const next: Record<string, SheetDraft> = {};
    rows.forEach(tx => {
      next[tx.id] = {
        quantity: String(Number(tx.quantity) || 0),
        price: String(Number(tx.price) || 0),
        dirty: false,
      };
    });
    setSheetDrafts(next);
  }, [monthTransactionsByCustomer]);

  const openOrCloseSheet = (customerId: string) => {
    if (openSheetCustomerId === customerId) {
      setOpenSheetCustomerId(null);
      setEditSheetCustomerId(null);
      setSheetDrafts({});
      return;
    }

    setOpenSheetCustomerId(customerId);
    setEditSheetCustomerId(null);
    initializeSheetDrafts(customerId);
  };

  const handleSheetInput = (txId: string, field: keyof Omit<SheetDraft, 'dirty'>, value: string) => {
    setSheetDrafts(prev => ({
      ...prev,
      [txId]: {
        ...(prev[txId] || { quantity: '', price: '', dirty: false }),
        [field]: value,
        dirty: true,
      },
    }));
  };

  const saveSheet = async (customerId: string) => {
    const rows = monthTransactionsByCustomer[customerId] || [];
    const dirtyRows = rows.filter(r => sheetDrafts[r.id]?.dirty);

    if (dirtyRows.length === 0) {
      setEditSheetCustomerId(null);
      return;
    }

    setSheetSaving(true);
    let saved = 0;
    let failed = 0;

    await Promise.all(
      dirtyRows.map(async row => {
        const draft = sheetDrafts[row.id];
        const quantity = Number(draft?.quantity) || 0;
        const price = Number(draft?.price) || 0;
        const mila = Number(row.mila) || 0;
        const total = quantity * price - mila;

        try {
          await updateTransaction.mutateAsync({ id: row.id, quantity, price, total });
          saved++;
        } catch {
          failed++;
        }
      })
    );

    setSheetSaving(false);
    setEditSheetCustomerId(null);

    setSheetDrafts(prev => {
      const next = { ...prev };
      dirtyRows.forEach(row => {
        if (next[row.id]) next[row.id] = { ...next[row.id], dirty: false };
      });
      return next;
    });

    if (failed > 0) {
      toast({ title: '⚠️ Partial Save', description: `${saved} rows saved, ${failed} failed`, variant: 'destructive' });
      return;
    }

    toast({ title: '✅ Saved', description: `${saved} rows updated` });
  };

  const toggleSheetEdit = (customerId: string) => {
    if (editSheetCustomerId !== customerId) {
      setEditSheetCustomerId(customerId);
      initializeSheetDrafts(customerId);
      return;
    }
    saveSheet(customerId);
  };

  const getMonthTotalQty = (customerId: string) => {
    const rows = monthTransactionsByCustomer[customerId] || [];
    return rows.reduce((s, row) => s + (Number(row.quantity) || 0), 0);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editId) {
      update.mutate({ id: editId, ...form });
      toast({ title: '✅ Updated', description: `${form.name} updated` });
    } else {
      add.mutate(form);
      toast({ title: '✅ Added', description: `${form.name} added` });
    }
    setShowModal(false);
    setEditId(null);
    setForm(emptyForm);
  };

  const handleEdit = (c: DbCustomer) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      phone: c.phone,
      address: c.address,
      purchase_rate: c.purchase_rate,
      opening_balance: c.opening_balance,
      time_group: c.time_group,
      milk_type: c.milk_type,
      is_active: c.is_active !== false,
      default_qty_morning: c.default_qty_morning || 0,
      default_qty_evening: c.default_qty_evening || 0,
    });
    setShowModal(true);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      remove.mutate(deleteConfirm);
      toast({ title: '🗑️ Deleted', description: 'Customer removed' });
      setDeleteConfirm(null);
    }
  };

  const toggleActive = (c: DbCustomer) => {
    const newActive = c.is_active === false;
    update.mutate({ id: c.id, is_active: newActive } as any);
    toast({ title: newActive ? '✅ Activated' : '⏸️ Deactivated', description: c.name });
  };

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  if (isLoading)
    return (
      <div className="pb-20">
        <AppHeader title={t('nav.customers', lang)} />
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );

  return (
    <div className="pb-20">
      <AppHeader title={t('nav.customers', lang)} />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="action-button text-xs py-2 px-4">{t('nav.customers', lang)}:{customers.filter(c => c.is_active !== false).length}</span>
          <button onClick={() => setShowInactive(!showInactive)} className="text-xs text-muted-foreground flex items-center gap-1 ml-2">
            {showInactive ? <ToggleRight size={16} className="text-primary" /> : <ToggleLeft size={16} />}
            {showInactive ? 'Hide Inactive' : 'Show Inactive'}
          </button>
          {canEdit && (
            <button onClick={openAdd} className="ml-auto p-2 rounded-full bg-primary text-primary-foreground">
              <Plus size={20} />
            </button>
          )}
        </div>

        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-2">Monthly quantity sheet</p>
          <div className="grid grid-cols-2 gap-2">
            <select className="input-field text-sm py-2" value={sheetYear} onChange={e => setSheetYear(Number(e.target.value))}>
              {getAvailableYears().map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select className="input-field text-sm py-2" value={sheetMonth} onChange={e => setSheetMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{getNepaliMonthName(m, lang === 'hi' ? 'np' : 'en')}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={`${t('common.search', lang)} ${t('nav.customers', lang)}`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-9 text-sm"
          />
        </div>

        {filtered.length === 0 ? (
          canEdit ? (
            <button onClick={openAdd} className="w-full py-12 text-center text-primary font-heading text-lg font-semibold">
              {t('customer.addFirst', lang)}
            </button>
          ) : (
            <p className="text-center text-muted-foreground text-sm py-12">{t('common.noData', lang)}</p>
          )
        ) : (
          <>
            <p className="text-center text-muted-foreground text-xs font-body">{t('common.morning', lang)}: {morningCustomers.length}</p>
            {morningCustomers.map(c => (
              <div key={c.id} className="space-y-2">
                <CustomerCard
                  customer={c}
                  lang={lang}
                  onEdit={canEdit ? handleEdit : undefined}
                  onDelete={canDelete ? id => setDeleteConfirm(id) : undefined}
                  onToggle={canEdit ? toggleActive : undefined}
                />
                <CustomerMonthlySheet
                  customer={c}
                  monthLabel={monthLabel}
                  rows={monthTransactionsByCustomer[c.id] || []}
                  totalQty={getMonthTotalQty(c.id)}
                  isOpen={openSheetCustomerId === c.id}
                  isEditing={editSheetCustomerId === c.id}
                  isSaving={sheetSaving && editSheetCustomerId === c.id}
                  canEdit={canEdit}
                  drafts={sheetDrafts}
                  onToggleOpen={() => openOrCloseSheet(c.id)}
                  onToggleEdit={() => toggleSheetEdit(c.id)}
                  onFieldChange={handleSheetInput}
                />
              </div>
            ))}

            <p className="text-center text-muted-foreground text-xs font-body mt-4">{t('common.evening', lang)}: {eveningCustomers.length}</p>
            {eveningCustomers.map(c => (
              <div key={c.id} className="space-y-2">
                <CustomerCard
                  customer={c}
                  lang={lang}
                  onEdit={canEdit ? handleEdit : undefined}
                  onDelete={canDelete ? id => setDeleteConfirm(id) : undefined}
                  onToggle={canEdit ? toggleActive : undefined}
                />
                <CustomerMonthlySheet
                  customer={c}
                  monthLabel={monthLabel}
                  rows={monthTransactionsByCustomer[c.id] || []}
                  totalQty={getMonthTotalQty(c.id)}
                  isOpen={openSheetCustomerId === c.id}
                  isEditing={editSheetCustomerId === c.id}
                  isSaving={sheetSaving && editSheetCustomerId === c.id}
                  canEdit={canEdit}
                  drafts={sheetDrafts}
                  onToggleOpen={() => openOrCloseSheet(c.id)}
                  onToggleEdit={() => toggleSheetEdit(c.id)}
                  onFieldChange={handleSheetInput}
                />
              </div>
            ))}
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Customer"
        message="Are you sure you want to delete this customer? This action cannot be undone. Consider deactivating instead."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      {showModal && (
        <>
          <div className="modal-overlay" onClick={() => setShowModal(false)} />
          <div className="modal-content">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-heading text-lg font-bold">{editId ? 'Edit Customer' : t('customer.details', lang)}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <input className="input-field" placeholder={t('common.name', lang)} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input className="input-field" placeholder={t('common.phone', lang)} inputMode="tel" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <input className="input-field" placeholder={t('common.address', lang)} value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} />
              <div>
                <label className="text-xs text-muted-foreground">{t('customer.purchaseRate', lang)}</label>
                <input className="input-field font-number" type="number" inputMode="numeric" value={form.purchase_rate || ''} onChange={e => setForm({ ...form, purchase_rate: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('customer.openingBalance', lang)}</label>
                <input className="input-field font-number" type="number" inputMode="numeric" value={form.opening_balance || ''} onChange={e => setForm({ ...form, opening_balance: Number(e.target.value) || 0 })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Default Qty (Morning)</label>
                  <input className="input-field font-number" type="number" inputMode="decimal" value={form.default_qty_morning || ''} onChange={e => setForm({ ...form, default_qty_morning: Number(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Default Qty (Evening)</label>
                  <input className="input-field font-number" type="number" inputMode="decimal" value={form.default_qty_evening || ''} onChange={e => setForm({ ...form, default_qty_evening: Number(e.target.value) || 0 })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('customer.timeGroup', lang)}</label>
                <select className="input-field text-sm" value={form.time_group} onChange={e => setForm({ ...form, time_group: e.target.value })}>
                  <option value="morning">{t('common.morning', lang)}</option>
                  <option value="evening">{t('common.evening', lang)}</option>
                  <option value="both">{lang === 'en' ? 'Both' : 'दोनों'}</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('customer.milkType', lang)}</label>
                <select className="input-field text-sm" value={form.milk_type} onChange={e => setForm({ ...form, milk_type: e.target.value })}>
                  <option value="cow">{t('customer.cow', lang)}</option>
                  <option value="buffalo">{t('customer.buffalo', lang)}</option>
                  <option value="mixed">{t('customer.mixed', lang)}</option>
                </select>
              </div>
              <div className="flex items-center justify-between py-2">
                <label className="text-sm font-body">Active Customer</label>
                <button onClick={() => setForm({ ...form, is_active: !form.is_active })} className="flex items-center gap-2">
                  {form.is_active ? <ToggleRight size={28} className="text-primary" /> : <ToggleLeft size={28} className="text-muted-foreground" />}
                </button>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} className="action-button flex-1">{t('common.save', lang)}</button>
                <button onClick={() => setShowModal(false)} className="flex-1 rounded-lg border border-border py-3 text-muted-foreground font-heading">{t('common.cancel', lang)}</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CustomerMonthlySheet({
  customer,
  monthLabel,
  rows,
  totalQty,
  isOpen,
  isEditing,
  isSaving,
  canEdit,
  drafts,
  onToggleOpen,
  onToggleEdit,
  onFieldChange,
}: {
  customer: DbCustomer;
  monthLabel: string;
  rows: DbTransaction[];
  totalQty: number;
  isOpen: boolean;
  isEditing: boolean;
  isSaving: boolean;
  canEdit: boolean;
  drafts: Record<string, SheetDraft>;
  onToggleOpen: () => void;
  onToggleEdit: () => void;
  onFieldChange: (txId: string, field: keyof Omit<SheetDraft, 'dirty'>, value: string) => void;
}) {
  const draftAwareTotals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const qty = Number(drafts[row.id]?.quantity ?? row.quantity) || 0;
        const rate = Number(drafts[row.id]?.price ?? row.price) || 0;
        const amount = qty * rate - (Number(row.mila) || 0);
        return { qty: acc.qty + qty, amount: acc.amount + amount };
      },
      { qty: 0, amount: 0 }
    );
  }, [rows, drafts]);

  return (
    <div className="stat-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{monthLabel}</p>
          <p className="text-sm font-heading font-semibold">Qty: {totalQty} L</p>
        </div>
        <button onClick={onToggleOpen} className="rounded-md border border-border px-3 py-1.5 text-xs font-heading text-foreground flex items-center gap-1">
          <FileSpreadsheet size={13} />
          {isOpen ? 'Hide Sheet' : 'Open Sheet'}
        </button>
      </div>

      {isOpen && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Editable transaction sheet</p>
            {canEdit && rows.length > 0 && (
              <button
                onClick={onToggleEdit}
                disabled={isSaving}
                className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-heading flex items-center gap-1 disabled:opacity-60"
              >
                {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {isEditing ? 'Save Sheet' : 'Edit Sheet'}
              </button>
            )}
          </div>

          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No transactions in selected month.</p>
          ) : (
            <div className="overflow-x-auto -mx-3 px-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="data-table-header text-left py-2">Date</th>
                    <th className="data-table-header text-left py-2">Shift</th>
                    <th className="data-table-header text-center py-2">Qty</th>
                    <th className="data-table-header text-center py-2">Rate</th>
                    <th className="data-table-header text-right py-2">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const qtyValue = drafts[row.id]?.quantity ?? String(row.quantity ?? 0);
                    const rateValue = drafts[row.id]?.price ?? String(row.price ?? 0);
                    const rowAmount = (Number(qtyValue) || 0) * (Number(rateValue) || 0) - (Number(row.mila) || 0);
                    return (
                      <tr key={row.id} className="border-b border-border/50">
                        <td className="py-2">{row.date_key.split('-').reverse().join('-')}</td>
                        <td className="py-2 capitalize">{row.time_group}</td>
                        <td className="py-2 text-center">
                          {isEditing ? (
                            <input
                              type="number"
                              inputMode="decimal"
                              value={qtyValue}
                              onChange={e => onFieldChange(row.id, 'quantity', e.target.value)}
                              className="w-16 rounded border border-border bg-card px-2 py-1 text-center font-number"
                            />
                          ) : (
                            <span className="font-number">{Number(qtyValue) || 0}</span>
                          )}
                        </td>
                        <td className="py-2 text-center">
                          {isEditing ? (
                            <input
                              type="number"
                              inputMode="decimal"
                              value={rateValue}
                              onChange={e => onFieldChange(row.id, 'price', e.target.value)}
                              className="w-16 rounded border border-border bg-card px-2 py-1 text-center font-number"
                            />
                          ) : (
                            <span className="font-number">₹{Number(rateValue) || 0}</span>
                          )}
                        </td>
                        <td className="py-2 text-right font-number">₹{rowAmount}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} className="pt-2 text-muted-foreground">Total</td>
                    <td className="pt-2 text-center font-number font-semibold">{draftAwareTotals.qty}</td>
                    <td></td>
                    <td className="pt-2 text-right font-number font-semibold">₹{draftAwareTotals.amount}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CustomerCard({
  customer,
  lang,
  onEdit,
  onDelete,
  onToggle,
}: {
  customer: DbCustomer;
  lang: 'en' | 'hi';
  onEdit?: (c: DbCustomer) => void;
  onDelete?: (id: string) => void;
  onToggle?: (c: DbCustomer) => void;
}) {
  const initials = customer.name.slice(0, 2).toUpperCase();
  const inactive = customer.is_active === false;
  return (
    <div className={`stat-card flex items-center gap-3 ${inactive ? 'opacity-50' : ''}`}>
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-heading font-bold text-sm flex-shrink-0">{initials}</div>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-semibold text-sm truncate">
          {customer.name} {inactive && <span className="text-[10px] text-muted-foreground">(Inactive)</span>}
        </p>
        <p className="text-[10px] text-muted-foreground">{customer.milk_type} · ₹{customer.purchase_rate}/L</p>
      </div>
      <div className="flex gap-1">
        {onToggle && (
          <button onClick={() => onToggle(customer)} className="p-2 text-muted-foreground">
            {inactive ? <ToggleLeft size={16} /> : <ToggleRight size={16} className="text-primary" />}
          </button>
        )}
        {onEdit && (
          <button onClick={() => onEdit(customer)} className="p-2 text-muted-foreground">
            <Edit size={16} />
          </button>
        )}
        {onDelete && (
          <button onClick={() => onDelete(customer.id)} className="p-2 text-destructive">
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
