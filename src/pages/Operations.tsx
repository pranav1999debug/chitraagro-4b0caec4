import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import AppHeader from '@/components/AppHeader';
import NepaliDatePicker from '@/components/NepaliDatePicker';
import VoiceCommandButton from '@/components/VoiceCommandButton';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';
import { getTodayNepali, nepaliDateToKey, type NepaliDate } from '@/lib/nepaliDate';
import { useCustomers, useTransactions, useTransactionMutations, type DbTransaction, type DbCustomer } from '@/hooks/useFarmData';
import { MessageCircle, BarChart3, Loader2, Save, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface DraftEntry {
  quantity: string;
  price: string;
  mila: string;
  dirty: boolean;
}

export default function Operations() {
  const { lang } = useApp();
  const { role } = useAuth();
  const navigate = useNavigate();
  const today = getTodayNepali();
  const [date, setDate] = useState<NepaliDate>(today);
  const [timeGroup, setTimeGroup] = useState<'morning' | 'evening'>(() => new Date().getHours() < 12 ? 'morning' : 'evening');
  const [drafts, setDrafts] = useState<Record<string, DraftEntry>>({});
  const [saving, setSaving] = useState(false);
  const [activeQtyRow, setActiveQtyRow] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  // Track whether we're in the middle of saving to prevent useEffect from resetting drafts
  const savingRef = useRef(false);

  const dateKey = nepaliDateToKey(date);
  const { data: customers = [] } = useCustomers();
  const { data: transactions = [], isLoading: txLoading, isFetching: txFetching } = useTransactions(dateKey);
  const { add, update } = useTransactionMutations();

  const canEdit = role === 'owner' || role === 'manager';

  // Only active customers for the selected time group
  const filteredCustomers = useMemo(() =>
    customers.filter(c => c.is_active !== false && (c.time_group === timeGroup || c.time_group === 'both')),
    [customers, timeGroup]
  );

  const txMap = useMemo(() => {
    const map: Record<string, DbTransaction> = {};
    transactions.filter(tx => tx.time_group === timeGroup).forEach(tx => { map[tx.customer_id] = tx; });
    return map;
  }, [transactions, timeGroup]);

  // Check if ANY transactions exist for this date+timeGroup (means sheet was saved before)
  const hasAnySavedTransactions = useMemo(() => {
    return transactions.some(tx => tx.time_group === timeGroup);
  }, [transactions, timeGroup]);

  // Initialize drafts from saved data
  // If sheet was saved before: show saved values (or blank for unsaved customers)
  // If sheet is fresh (never saved): show defaults
  useEffect(() => {
    // Don't reset drafts while saving
    if (savingRef.current) return;

    const newDrafts: Record<string, DraftEntry> = {};
    filteredCustomers.forEach(c => {
      const tx = txMap[c.id];
      if (tx) {
        // Transaction exists — show saved values
        newDrafts[c.id] = {
          quantity: Number(tx.quantity) > 0 ? String(tx.quantity) : '',
          price: String(tx.price),
          mila: Number(tx.mila) > 0 ? String(tx.mila) : '',
          dirty: false,
        };
      } else if (!hasAnySavedTransactions) {
        // Fresh sheet (never saved) — show defaults
        const defaultQty = timeGroup === 'morning' ? c.default_qty_morning : c.default_qty_evening;
        newDrafts[c.id] = {
          quantity: defaultQty > 0 ? String(defaultQty) : '',
          price: c.purchase_rate ? String(c.purchase_rate) : '',
          mila: '',
          dirty: defaultQty > 0,
        };
      } else {
        // Sheet was saved before, but this customer had no entry — show blank (no defaults)
        newDrafts[c.id] = {
          quantity: '',
          price: c.purchase_rate ? String(c.purchase_rate) : '',
          mila: '',
          dirty: false,
        };
      }
    });
    setDrafts(newDrafts);
  }, [filteredCustomers, txMap, timeGroup, hasAnySavedTransactions]);

  const totalLiters = useMemo(() => {
    return filteredCustomers.reduce((s, c) => {
      const d = drafts[c.id];
      return s + (d ? Number(d.quantity) || 0 : 0);
    }, 0);
  }, [filteredCustomers, drafts]);

  const totalReceived = useMemo(() => {
    return filteredCustomers.reduce((s, c) => {
      const d = drafts[c.id];
      if (!d) return s;
      const qty = Number(d.quantity) || 0;
      const price = Number(d.price) || 0;
      const mila = Number(d.mila) || 0;
      return s + (qty * price - mila);
    }, 0);
  }, [filteredCustomers, drafts]);

  const isLoadingData = txLoading || txFetching;
  const dirtyCount = Object.values(drafts).filter(d => d.dirty).length;

  const handleFieldInput = (customerId: string, field: keyof DraftEntry, value: string) => {
    setDrafts(prev => ({
      ...prev,
      [customerId]: { ...prev[customerId], [field]: value, dirty: true }
    }));
  };

  const handleQuickAdd = (customerId: string, amount: number) => {
    setDrafts(prev => {
      const current = prev[customerId] || { quantity: '', price: '', mila: '', dirty: false };
      const currentQty = Number(current.quantity) || 0;
      return {
        ...prev,
        [customerId]: { ...current, quantity: String(currentQty + amount), dirty: true }
      };
    });
  };

  const handleSaveAll = useCallback(async () => {
    if (!canEdit || saving) return;
    setSaving(true);
    savingRef.current = true;
    let saved = 0;
    let failed = 0;

    // Collect all mutations to execute
    const mutations: Promise<any>[] = [];

    for (const customer of filteredCustomers) {
      const draft = drafts[customer.id];
      if (!draft?.dirty) continue;

      const qty = Number(draft.quantity) || 0;
      const price = Number(draft.price) || customer.purchase_rate;
      const mila = Number(draft.mila) || 0;
      const total = qty * price - mila;
      const existing = txMap[customer.id];

      if (existing) {
        mutations.push(
          update.mutateAsync({ id: existing.id, quantity: qty, price, mila, total })
            .then(() => { saved++; })
            .catch((err) => { console.error('Save failed for', customer.name, err); failed++; })
        );
      } else if (qty > 0) {
        mutations.push(
          add.mutateAsync({ customer_id: customer.id, date_key: dateKey, time_group: timeGroup, quantity: qty, price, mila, total })
            .then(() => { saved++; })
            .catch((err) => { console.error('Save failed for', customer.name, err); failed++; })
        );
      }
    }

    // Wait for ALL mutations to complete
    await Promise.all(mutations);

    // Now mark all as not dirty
    setDrafts(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { next[k] = { ...next[k], dirty: false }; });
      return next;
    });

    savingRef.current = false;
    setSaving(false);

    if (failed > 0) {
      toast({ title: '⚠️ Partial Save', description: `${saved} saved, ${failed} failed. Please retry.`, variant: 'destructive' });
    } else {
      toast({ title: '✅ Saved', description: `${saved} entries saved successfully` });
    }
  }, [canEdit, saving, filteredCustomers, drafts, txMap, dateKey, timeGroup, add, update]);

  // Voice command handler
  const handleVoiceApply = useCallback((entries: Array<{ customer_id: string; customer_name: string; quantity: number; price: number }>) => {
    setDrafts(prev => {
      const next = { ...prev };
      entries.forEach(e => {
        if (next[e.customer_id]) {
          next[e.customer_id] = {
            ...next[e.customer_id],
            quantity: String(e.quantity),
            price: String(e.price),
            dirty: true,
          };
        }
      });
      return next;
    });
  }, []);

  const handleWhatsApp = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    const draft = drafts[customerId];
    if (!customer || !draft) return;
    const qty = Number(draft.quantity) || 0;
    const price = Number(draft.price) || 0;
    const mila = Number(draft.mila) || 0;
    const msg = `Hi ${customer.name},\n\n📦 Amount: ${qty} Ltr @ ₹${price}\n💰 Mila: ₹${mila}\n\nThanks,\nCHITRA AGRO!! 🎉`;
    const phone = (customer.phone || '').replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Virtualizer for large lists
  const rowVirtualizer = useVirtualizer({
    count: filteredCustomers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => activeQtyRow ? 100 : 52,
    overscan: 10,
  });

  return (
    <div className="pb-20">
      <AppHeader title={t('nav.operations', lang)} />
      <div className="p-4 space-y-4">
        <div className="stat-card">
          <h2 className="font-heading text-sm font-semibold mb-2">{t('transaction.selectDate', lang)}</h2>
          <NepaliDatePicker date={date} onChange={setDate} showDay />
          <div className="flex mt-3 border-t border-border pt-3">
            {(['morning', 'evening'] as const).map(tg => (
              <button key={tg} onClick={() => setTimeGroup(tg)} className={`flex-1 text-center py-2 font-heading text-sm transition-colors ${timeGroup === tg ? 'tab-active' : 'tab-inactive'}`}>
                {t(`common.${tg}`, lang)}
              </button>
            ))}
          </div>
        </div>

        <div className="stat-card flex justify-between items-center">
          <div>
            <p className="text-xs text-muted-foreground">{t('transaction.todaysSales', lang)}</p>
            <p className="font-number text-xl font-bold">{totalLiters} Ltrs</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t('transaction.received', lang)}</p>
            <p className="font-number text-xl font-bold text-primary">₹{totalReceived}</p>
          </div>
          {isLoadingData && <Loader2 size={20} className="animate-spin text-primary" />}
        </div>

        {/* Save All Button - only show when there are dirty entries */}
        {canEdit && dirtyCount > 0 && (
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="action-button w-full flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Save All ({dirtyCount} changes)
          </button>
        )}

        {/* Voice Command Result / Button */}
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <VoiceCommandButton
              customers={customers}
              timeGroup={timeGroup}
              dateKey={dateKey}
              onApply={handleVoiceApply}
            />
          </div>
        </div>

        <div className="stat-card">
          <h3 className="font-heading text-sm font-semibold mb-3 flex justify-between items-center">
            <span>{t(`common.${timeGroup}`, lang)} {t('nav.customers', lang)}: {filteredCustomers.length}</span>
            <button onClick={() => navigate('/report')} className="text-xs text-primary flex items-center gap-1">
              <BarChart3 size={14} /> {t('dashboard.generateReport', lang)}
            </button>
          </h3>

          {filteredCustomers.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">{t('common.noData', lang)}</p>
          ) : (
            <>
              {isLoadingData && (
                <div className="flex items-center justify-center py-2 gap-2 text-primary">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm font-body">Loading...</span>
                </div>
              )}
              {/* Virtualized table */}
              <div ref={parentRef} className="overflow-auto -mx-4 px-4" style={{ maxHeight: '60vh' }}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-border">
                      <th className="data-table-header text-left py-2">{t('nav.customers', lang)}</th>
                      <th className="data-table-header text-center py-2">{t('transaction.qty', lang)}</th>
                      <th className="data-table-header text-center py-2">{t('transaction.price', lang)}</th>
                      <th className="data-table-header text-center py-2">{t('transaction.mila', lang)}</th>
                      <th className="data-table-header text-center py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td colSpan={5} style={{ height: rowVirtualizer.getTotalSize(), padding: 0, position: 'relative' }}>
                      {rowVirtualizer.getVirtualItems().map(virtualRow => {
                        const customer = filteredCustomers[virtualRow.index];
                        const draft = drafts[customer.id] || { quantity: '', price: '', mila: '', dirty: false };
                        const isDirty = draft.dirty;
                        const hasQty = Number(draft.quantity) > 0;

                        return (
                          <div
                            key={customer.id}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              transform: `translateY(${virtualRow.start}px)`,
                            }}
                          >
                            <div className={`flex items-center border-b border-border/50 ${isDirty ? 'bg-primary/5' : ''}`}>
                              <div className="data-table-cell text-left font-body text-xs flex-1 min-w-0 truncate">{customer.name}</div>
                              <div className="data-table-cell text-center flex-shrink-0">
                                <input type="number" inputMode="decimal"
                                  value={draft.quantity}
                                  placeholder="0"
                                  onChange={e => handleFieldInput(customer.id, 'quantity', e.target.value)}
                                  onFocus={() => setActiveQtyRow(customer.id)}
                                  onBlur={() => setTimeout(() => setActiveQtyRow(null), 200)}
                                  disabled={!canEdit}
                                  className="w-14 text-center rounded border border-border py-1 font-number text-sm bg-card focus:outline-none focus:border-primary disabled:opacity-50" />
                              </div>
                              <div className="data-table-cell text-center flex-shrink-0">
                                <input type="number" inputMode="numeric"
                                  value={draft.price}
                                  onChange={e => handleFieldInput(customer.id, 'price', e.target.value)}
                                  disabled={!canEdit}
                                  className="w-14 text-center rounded border border-border py-1 font-number text-sm text-primary font-bold bg-card focus:outline-none focus:border-primary disabled:opacity-50" />
                              </div>
                              <div className="data-table-cell text-center flex-shrink-0">
                                <input type="number" inputMode="numeric"
                                  value={draft.mila}
                                  placeholder="0"
                                  onChange={e => handleFieldInput(customer.id, 'mila', e.target.value)}
                                  disabled={!canEdit}
                                  className="w-14 text-center rounded border border-border py-1 font-number text-sm bg-card focus:outline-none focus:border-primary disabled:opacity-50" />
                              </div>
                              <div className="data-table-cell text-center flex-shrink-0">
                                {hasQty && (
                                  <button onClick={() => handleWhatsApp(customer.id)} className="p-1 text-primary">
                                    <MessageCircle size={16} />
                                  </button>
                                )}
                              </div>
                            </div>
                            {/* Quick quantity buttons */}
                            {activeQtyRow === customer.id && canEdit && (
                              <div className="flex gap-1 px-2 py-1 bg-muted/50">
                                {[0.5, 1, 2].map(amt => (
                                  <button key={amt} onClick={() => handleQuickAdd(customer.id, amt)}
                                    className="flex-1 text-xs py-1 rounded bg-primary/10 text-primary font-heading font-semibold flex items-center justify-center gap-0.5">
                                    <Plus size={10} />{amt}L
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </td></tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
