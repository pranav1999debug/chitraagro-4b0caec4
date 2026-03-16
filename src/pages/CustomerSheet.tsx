import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { getDaysInMonth, getAvailableYears, getNepaliMonthName, getTodayNepali } from '@/lib/nepaliDate';
import {
  useCustomers,
  useAllTransactions,
  useTransactionMutations,
  type DbTransaction,
} from '@/hooks/useFarmData';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Edit, Save, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface RowDraft {
  dateKey: string;
  displayDate: string;
  quantity: string;
  rate: string;
  price: number;
  txId: string | null; // null = new row
  dirty: boolean;
}

export default function CustomerSheet() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { lang } = useApp();
  const { role, farmId } = useAuth();
  const today = getTodayNepali();

  const { data: customers = [] } = useCustomers();
  const { data: allTransactions = [] } = useAllTransactions();
  const { add: addTx, update: updateTx, invalidateAll } = useTransactionMutations();

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

  // Get existing transactions for this customer in selected month
  const existingTxMap = useMemo(() => {
    const map: Record<string, DbTransaction> = {};
    allTransactions
      .filter(tx => tx.customer_id === customerId && tx.date_key.startsWith(yearMonth))
      .forEach(tx => {
        // Use date_key + time_group as key to handle morning/evening
        const key = `${tx.date_key}_${tx.time_group}`;
        map[key] = tx;
      });
    return map;
  }, [allTransactions, customerId, yearMonth]);

  // Build rows: one per day, load saved data or defaults
  const buildRows = useCallback((): RowDraft[] => {
    if (!customer) return [];
    const defaultRate = customer.purchase_rate || 0;
    // Determine which time_group to use for this sheet
    const timeGroup = customer.time_group === 'evening' ? 'evening' : 'morning';
    
    const rows: RowDraft[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d).padStart(2, '0');
      const monthStr = String(month).padStart(2, '0');
      const dateKey = `${year}-${monthStr}-${dayStr}`;
      const displayDate = `${dayStr}-${monthStr}-${year}`;
      const mapKey = `${dateKey}_${timeGroup}`;
      const existing = existingTxMap[mapKey];

      if (existing) {
        const qty = Number(existing.quantity) || 0;
        const rate = Number(existing.price) || defaultRate;
        rows.push({
          dateKey,
          displayDate,
          quantity: String(qty),
          rate: String(rate),
          price: qty * rate,
          txId: existing.id,
          dirty: false,
        });
      } else {
        rows.push({
          dateKey,
          displayDate,
          quantity: '0',
          rate: String(defaultRate),
          price: 0,
          txId: null,
          dirty: false,
        });
      }
    }
    return rows;
  }, [customer, daysInMonth, month, year, existingTxMap]);

  // Initialize drafts when month/year changes or first load
  const currentRows = useMemo(() => {
    if (drafts !== null) return drafts;
    return buildRows();
  }, [drafts, buildRows]);

  // Reset drafts when month/year changes
  const handleYearChange = (y: number) => { setYear(y); setDrafts(null); setIsEditing(false); };
  const handleMonthChange = (m: number) => { setMonth(m); setDrafts(null); setIsEditing(false); };

  const handleEdit = () => {
    setDrafts(buildRows());
    setIsEditing(true);
  };

  const handleQtyChange = (idx: number, value: string) => {
    setDrafts(prev => {
      const rows = [...(prev || buildRows())];
      const rate = parseFloat(rows[idx].rate) || 0;
      const qty = parseFloat(value) || 0;
      rows[idx] = { ...rows[idx], quantity: value, price: qty * rate, dirty: true };
      return rows;
    });
  };

  const handleRateChange = (idx: number, value: string) => {
    setDrafts(prev => {
      const rows = [...(prev || buildRows())];
      const qty = parseFloat(rows[idx].quantity) || 0;
      const rate = parseFloat(value) || 0;
      rows[idx] = { ...rows[idx], rate: value, price: qty * rate, dirty: true };
      return rows;
    });
  };

  const handleSave = async () => {
    if (!customer || !farmId) return;
    setIsSaving(true);
    const timeGroup = customer.time_group === 'evening' ? 'evening' : 'morning';
    const rowsToSave = currentRows;
    let saved = 0;
    let failed = 0;

    try {
      await Promise.all(
        rowsToSave.map(async (row) => {
          const qty = parseFloat(row.quantity) || 0;
          const rate = parseFloat(row.rate) || 0;
          const total = qty * rate;

          try {
            if (row.txId) {
              // Update existing
              if (row.dirty) {
                await updateTx.mutateAsync({ id: row.txId, quantity: qty, price: rate, total });
                saved++;
              }
            } else {
              // Insert new
              await addTx.mutateAsync({
                customer_id: customer.id,
                date_key: row.dateKey,
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
        })
      );

      invalidateAll();
    } catch {
      // handled per-row
    }

    setIsSaving(false);
    setIsEditing(false);
    setDrafts(null); // re-build from fresh data

    if (failed > 0) {
      toast({ title: '⚠️ Partial Save', description: `${saved} saved, ${failed} failed`, variant: 'destructive' });
    } else {
      toast({ title: '✅ Saved', description: `${saved} rows saved for ${customer.name}` });
    }
  };

  // Summary
  const summary = useMemo(() => {
    const rows = currentRows;
    let totalQty = 0;
    let totalPrice = 0;
    rows.forEach(r => {
      totalQty += Number(r.quantity) || 0;
      totalPrice += r.price;
    });
    const avgRate = totalQty > 0 ? totalPrice / totalQty : (customer?.purchase_rate || 0);
    return { totalQty, totalPrice, avgRate };
  }, [currentRows, customer]);

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

        {/* Data Table */}
        <div className="stat-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left py-2.5 px-3 font-heading text-muted-foreground">Date</th>
                  <th className="text-center py-2.5 px-2 font-heading text-muted-foreground">Qty (L)</th>
                  <th className="text-center py-2.5 px-2 font-heading text-muted-foreground">Rate (₹)</th>
                  <th className="text-right py-2.5 px-3 font-heading text-muted-foreground">Price (₹)</th>
                </tr>
              </thead>
              <tbody>
                {currentRows.map((row, idx) => (
                  <tr key={row.dateKey} className={`border-t border-border/30 ${row.dirty ? 'bg-primary/5' : ''}`}>
                    <td className="py-2 px-3 font-number text-[11px]">{row.displayDate}</td>
                    <td className="py-1.5 px-1 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min="0"
                          value={row.quantity}
                          onChange={e => handleQtyChange(idx, e.target.value)}
                          className="w-16 rounded border border-border bg-card px-2 py-1.5 text-center font-number text-xs"
                        />
                      ) : (
                        <span className="font-number">{Number(row.quantity) || 0}</span>
                      )}
                    </td>
                    <td className="py-1.5 px-1 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          inputMode="decimal"
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
                ))}
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
