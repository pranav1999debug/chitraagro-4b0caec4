import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { getDaysInMonth, getAvailableYears, getNepaliMonthName, getTodayNepali } from '@/lib/nepaliDate';
import {
  useCustomers,
  useCustomerMonthTransactions,
  useTransactionMutations,
  type DbTransaction,
} from '@/hooks/useFarmData';
import { ArrowLeft, Edit, Save, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface RowDraft {
  dateKey: string;
  displayDate: string;
  morningQty: string;
  eveningQty: string;
  rate: string;
  price: number;
  morningTxId: string | null;
  eveningTxId: string | null;
  dirty: boolean;
}

export default function CustomerSheet() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { lang } = useApp();
  const { role, farmId } = useAuth();
  const today = getTodayNepali();

  const { data: customers = [] } = useCustomers();

  const customer = customers.find(c => c.id === customerId);

  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [drafts, setDrafts] = useState<RowDraft[] | null>(null);

  const canEdit = role === 'owner' || role === 'manager';
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
  const daysInMonth = getDaysInMonth(year, month);
  const monthLabel = `${getNepaliMonthName(month, lang === 'hi' ? 'np' : 'en')} ${year}`;

  // Use targeted query - fetches only this customer's transactions for selected month
  const { data: customerTransactions = [], isLoading } = useCustomerMonthTransactions(customerId, yearMonth);
  const { add: addTx, update: updateTx, invalidateAll } = useTransactionMutations();

  const showBothColumns = customer?.time_group === 'both';

  // Build maps for morning and evening transactions
  const txMaps = useMemo(() => {
    const morning: Record<string, DbTransaction> = {};
    const evening: Record<string, DbTransaction> = {};
    customerTransactions.forEach(tx => {
      if (tx.time_group === 'morning') morning[tx.date_key] = tx;
      else if (tx.time_group === 'evening') evening[tx.date_key] = tx;
    });
    return { morning, evening };
  }, [customerTransactions]);

  // Build rows: one per day
  const buildRows = useCallback((): RowDraft[] => {
    if (!customer) return [];
    const defaultRate = customer.purchase_rate || 0;

    const rows: RowDraft[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d).padStart(2, '0');
      const monthStr = String(month).padStart(2, '0');
      const dateKey = `${year}-${monthStr}-${dayStr}`;
      const displayDate = `${dayStr}-${monthStr}-${year}`;

      const morningTx = txMaps.morning[dateKey];
      const eveningTx = txMaps.evening[dateKey];

      const mQty = morningTx ? Number(morningTx.quantity) || 0 : 0;
      const eQty = eveningTx ? Number(eveningTx.quantity) || 0 : 0;
      const rate = morningTx ? Number(morningTx.price) || defaultRate : eveningTx ? Number(eveningTx.price) || defaultRate : defaultRate;
      const totalQty = showBothColumns ? mQty + eQty : customer.time_group === 'evening' ? eQty : mQty;

      rows.push({
        dateKey,
        displayDate,
        morningQty: String(mQty),
        eveningQty: String(eQty),
        rate: String(rate),
        price: totalQty * rate,
        morningTxId: morningTx?.id || null,
        eveningTxId: eveningTx?.id || null,
        dirty: false,
      });
    }
    return rows;
  }, [customer, daysInMonth, month, year, txMaps, showBothColumns]);

  const currentRows = useMemo(() => {
    if (drafts !== null) return drafts;
    return buildRows();
  }, [drafts, buildRows]);

  const handleYearChange = (y: number) => { setYear(y); setDrafts(null); setIsEditing(false); };
  const handleMonthChange = (m: number) => { setMonth(m); setDrafts(null); setIsEditing(false); };

  const handleEdit = () => {
    setDrafts(buildRows());
    setIsEditing(true);
  };

  const handleQtyChange = (idx: number, field: 'morningQty' | 'eveningQty', value: string) => {
    setDrafts(prev => {
      const rows = [...(prev || buildRows())];
      const row = { ...rows[idx], [field]: value, dirty: true };
      const mQty = parseFloat(field === 'morningQty' ? value : row.morningQty) || 0;
      const eQty = parseFloat(field === 'eveningQty' ? value : row.eveningQty) || 0;
      const rate = parseFloat(row.rate) || 0;
      const totalQty = showBothColumns ? mQty + eQty : customer?.time_group === 'evening' ? eQty : mQty;
      row.price = totalQty * rate;
      rows[idx] = row;
      return rows;
    });
  };

  const handleRateChange = (idx: number, value: string) => {
    setDrafts(prev => {
      const rows = [...(prev || buildRows())];
      const row = { ...rows[idx], rate: value, dirty: true };
      const mQty = parseFloat(row.morningQty) || 0;
      const eQty = parseFloat(row.eveningQty) || 0;
      const rate = parseFloat(value) || 0;
      const totalQty = showBothColumns ? mQty + eQty : customer?.time_group === 'evening' ? eQty : mQty;
      row.price = totalQty * rate;
      rows[idx] = row;
      return rows;
    });
  };

  const handleSave = async () => {
    if (!customer || !farmId) return;
    setIsSaving(true);
    const rowsToSave = currentRows;
    let saved = 0;
    let failed = 0;

    const saveTx = async (
      txId: string | null,
      qty: number,
      rate: number,
      total: number,
      dateKey: string,
      timeGroup: string,
      dirty: boolean
    ) => {
      try {
        if (txId) {
          if (dirty) {
            await updateTx.mutateAsync({ id: txId, quantity: qty, price: rate, total });
            saved++;
          }
        } else if (qty > 0) {
          await addTx.mutateAsync({
            customer_id: customer.id,
            date_key: dateKey,
            time_group: timeGroup,
            quantity: qty,
            price: rate,
            mila: 0,
            total,
          });
          saved++;
        }
      } catch {
        failed++;
      }
    };

    try {
      const mutations: Promise<void>[] = [];
      for (const row of rowsToSave) {
        const rate = parseFloat(row.rate) || 0;
        const mQty = parseFloat(row.morningQty) || 0;
        const eQty = parseFloat(row.eveningQty) || 0;

        if (customer.time_group !== 'evening') {
          mutations.push(saveTx(row.morningTxId, mQty, rate, mQty * rate, row.dateKey, 'morning', row.dirty));
        }
        if (customer.time_group === 'evening' || customer.time_group === 'both') {
          mutations.push(saveTx(row.eveningTxId, eQty, rate, eQty * rate, row.dateKey, 'evening', row.dirty));
        }
      }
      await Promise.all(mutations);
      invalidateAll();
    } catch {
      // handled per-row
    }

    setIsSaving(false);
    setIsEditing(false);
    setDrafts(null);

    if (failed > 0) {
      toast({ title: '⚠️ Partial Save', description: `${saved} saved, ${failed} failed`, variant: 'destructive' });
    } else {
      toast({ title: '✅ Saved', description: `${saved} rows saved for ${customer.name}` });
    }
  };

  // Summary
  const summary = useMemo(() => {
    let totalQty = 0;
    let totalPrice = 0;
    currentRows.forEach(r => {
      const mQty = Number(r.morningQty) || 0;
      const eQty = Number(r.eveningQty) || 0;
      const qty = showBothColumns ? mQty + eQty : customer?.time_group === 'evening' ? eQty : mQty;
      totalQty += qty;
      totalPrice += r.price;
    });
    const avgRate = totalQty > 0 ? totalPrice / totalQty : (customer?.purchase_rate || 0);
    return { totalQty, totalPrice, avgRate };
  }, [currentRows, customer, showBothColumns]);

  if (!customer) {
    return (
      <div className="pb-20">
        <AppHeader title="Customer Sheet" />
        <div className="p-4 text-center text-muted-foreground">Customer not found</div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <AppHeader title="Customer Sheet" />
      <div className="p-4 space-y-3">
        {/* Back + Customer Name */}
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/customers')} className="p-2 rounded-lg text-muted-foreground hover:bg-muted">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h2 className="font-heading font-bold text-base">{customer.name}</h2>
            <p className="text-xs text-muted-foreground">{customer.milk_type} · ₹{customer.purchase_rate}/L · {customer.time_group}</p>
          </div>
          {canEdit && (
            isEditing ? (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-heading flex items-center gap-1.5 disabled:opacity-60"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save
              </button>
            ) : (
              <button
                onClick={handleEdit}
                className="rounded-lg border border-border px-4 py-2 text-sm font-heading flex items-center gap-1.5"
              >
                <Edit size={14} /> Edit
              </button>
            )
          )}
        </div>

        {/* Year/Month selector */}
        <div className="grid grid-cols-2 gap-2">
          <select className="input-field text-sm py-2" value={year} onChange={e => handleYearChange(Number(e.target.value))}>
            {getAvailableYears().map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="input-field text-sm py-2" value={month} onChange={e => handleMonthChange(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{getNepaliMonthName(m, lang === 'hi' ? 'np' : 'en')}</option>
            ))}
          </select>
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center justify-center py-2 gap-2 text-primary">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        )}

        {/* Data Table */}
        <div className="stat-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left py-2.5 px-3 font-heading text-muted-foreground">Date</th>
                  {showBothColumns ? (
                    <>
                      <th className="text-center py-2.5 px-1 font-heading text-muted-foreground">AM</th>
                      <th className="text-center py-2.5 px-1 font-heading text-muted-foreground">PM</th>
                    </>
                  ) : (
                    <th className="text-center py-2.5 px-2 font-heading text-muted-foreground">Qty (L)</th>
                  )}
                  <th className="text-center py-2.5 px-2 font-heading text-muted-foreground">Rate (₹)</th>
                  <th className="text-right py-2.5 px-3 font-heading text-muted-foreground">Price (₹)</th>
                </tr>
              </thead>
              <tbody>
                {currentRows.map((row, idx) => {
                  const displayQty = showBothColumns
                    ? (Number(row.morningQty) || 0) + (Number(row.eveningQty) || 0)
                    : customer.time_group === 'evening'
                    ? Number(row.eveningQty) || 0
                    : Number(row.morningQty) || 0;

                  return (
                    <tr key={row.dateKey} className={`border-t border-border/30 ${row.dirty ? 'bg-primary/5' : ''}`}>
                      <td className="py-2 px-3 font-number text-[11px]">{row.displayDate}</td>
                      {showBothColumns ? (
                        <>
                          <td className="py-1.5 px-1 text-center">
                            {isEditing ? (
                              <input
                                type="number" inputMode="decimal" step="0.1" min="0"
                                value={row.morningQty}
                                onChange={e => handleQtyChange(idx, 'morningQty', e.target.value)}
                                className="w-12 rounded border border-border bg-card px-1 py-1.5 text-center font-number text-xs"
                              />
                            ) : (
                              <span className="font-number">{Number(row.morningQty) || 0}</span>
                            )}
                          </td>
                          <td className="py-1.5 px-1 text-center">
                            {isEditing ? (
                              <input
                                type="number" inputMode="decimal" step="0.1" min="0"
                                value={row.eveningQty}
                                onChange={e => handleQtyChange(idx, 'eveningQty', e.target.value)}
                                className="w-12 rounded border border-border bg-card px-1 py-1.5 text-center font-number text-xs"
                              />
                            ) : (
                              <span className="font-number">{Number(row.eveningQty) || 0}</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <td className="py-1.5 px-1 text-center">
                          {isEditing ? (
                            <input
                              type="number" inputMode="decimal" step="0.1" min="0"
                              value={customer.time_group === 'evening' ? row.eveningQty : row.morningQty}
                              onChange={e => handleQtyChange(idx, customer.time_group === 'evening' ? 'eveningQty' : 'morningQty', e.target.value)}
                              className="w-16 rounded border border-border bg-card px-2 py-1.5 text-center font-number text-xs"
                            />
                          ) : (
                            <span className="font-number">{displayQty}</span>
                          )}
                        </td>
                      )}
                      <td className="py-1.5 px-1 text-center">
                        {isEditing ? (
                          <input
                            type="number" inputMode="decimal"
                            value={row.rate}
                            onChange={e => handleRateChange(idx, e.target.value)}
                            className="w-16 rounded border border-border bg-card px-2 py-1.5 text-center font-number text-xs"
                          />
                        ) : (
                          <span className="font-number">{Number(row.rate) || 0}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-number font-medium">{row.price.toFixed(0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary */}
        <div className="stat-card space-y-2">
          <h3 className="font-heading font-semibold text-sm">{monthLabel} — Summary</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground">Total Qty</p>
              <p className="font-number font-bold text-lg">{summary.totalQty.toFixed(1)} L</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Avg Rate</p>
              <p className="font-number font-bold text-lg">₹{summary.avgRate.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Total Price</p>
              <p className="font-number font-bold text-lg">₹{summary.totalPrice.toFixed(0)}</p>
            </div>
          </div>
        </div>

        {/* Generate Report button */}
        <button
          onClick={() => navigate(`/customers/${customerId}/bill`)}
          className="w-full action-button py-3 text-sm"
        >
          Generate Full Report / Bill
        </button>
      </div>
    </div>
  );
}
