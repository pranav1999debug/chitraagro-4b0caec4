import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';
import NepaliDatePicker from '@/components/NepaliDatePicker';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';
import { getTodayNepali, nepaliDateToKey, type NepaliDate } from '@/lib/nepaliDate';
import { useCustomers, useTransactions, useTransactionMutations, type DbTransaction } from '@/hooks/useFarmData';
import { MessageCircle, BarChart3, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function Operations() {
  const { lang } = useApp();
  const { role } = useAuth();
  const navigate = useNavigate();
  const today = getTodayNepali();
  const [date, setDate] = useState<NepaliDate>(today);
  const [timeGroup, setTimeGroup] = useState<'morning' | 'evening'>('morning');

  // Local draft state for input fields (before blur-save)
  const [drafts, setDrafts] = useState<Record<string, { quantity?: string; price?: string; mila?: string }>>({});

  const dateKey = nepaliDateToKey(date);
  const { data: customers = [] } = useCustomers();
  const { data: transactions = [], isLoading: txLoading, isFetching: txFetching } = useTransactions(dateKey);
  const { add, update } = useTransactionMutations();

  const canEdit = role === 'owner' || role === 'manager';

  const filteredCustomers = customers.filter(
    c => c.time_group === timeGroup || c.time_group === 'both'
  );

  const txMap = useMemo(() => {
    const map: Record<string, DbTransaction> = {};
    transactions.filter(tx => tx.time_group === timeGroup).forEach(tx => { map[tx.customer_id] = tx; });
    return map;
  }, [transactions, timeGroup]);

  const totalLiters = Object.values(txMap).reduce((s, tx) => s + Number(tx.quantity), 0);
  const totalReceived = Object.values(txMap).reduce((s, tx) => s + Number(tx.total), 0);

  const isLoadingData = txLoading || txFetching;

  // Get displayed value: draft first, then DB, then default
  const getFieldValue = (customerId: string, field: 'quantity' | 'price' | 'mila') => {
    const draft = drafts[customerId]?.[field];
    if (draft !== undefined) return draft;
    const tx = txMap[customerId];
    if (tx) {
      const val = Number(tx[field]);
      return val > 0 ? String(val) : '';
    }
    if (field === 'price') {
      const customer = customers.find(c => c.id === customerId);
      return customer?.purchase_rate ? String(customer.purchase_rate) : '';
    }
    return '';
  };

  const handleFieldInput = (customerId: string, field: 'quantity' | 'price' | 'mila', value: string) => {
    setDrafts(prev => ({
      ...prev,
      [customerId]: { ...prev[customerId], [field]: value }
    }));
  };

  const handleFieldBlur = useCallback((customerId: string, field: 'quantity' | 'price' | 'mila') => {
    if (!canEdit) return;
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const existing = txMap[customerId];
    const draftVal = drafts[customerId]?.[field];
    
    // If no draft change, skip
    if (draftVal === undefined) return;

    const value = Number(draftVal) || 0;
    const qty = field === 'quantity' ? value : Number(existing?.quantity || 0);
    const price = field === 'price' ? value : Number(existing?.price || customer.purchase_rate);
    const mila = field === 'mila' ? value : Number(existing?.mila || 0);
    const total = qty * price - mila;

    // Clear draft for this field
    setDrafts(prev => {
      const next = { ...prev };
      if (next[customerId]) {
        delete next[customerId][field];
        if (Object.keys(next[customerId]).length === 0) delete next[customerId];
      }
      return next;
    });

    if (existing) {
      update.mutate(
        { id: existing.id, [field]: value, total },
        {
          onSuccess: () => {
            const fieldLabel = field === 'quantity' ? `${value} Ltr` : field === 'price' ? `₹${value}` : `₹${value} mila`;
            toast({
              title: '✅ Entry Updated',
              description: `${customer.name}: ${fieldLabel}`,
            });
          },
        }
      );
    } else if (qty > 0) {
      add.mutate(
        {
          customer_id: customerId,
          date_key: dateKey,
          time_group: timeGroup,
          quantity: qty,
          price,
          mila,
          total,
        },
        {
          onSuccess: () => {
            toast({
              title: '✅ Entry Added',
              description: `${customer.name}: ${qty} Ltr @ ₹${price}`,
            });
          },
        }
      );
    }
  }, [canEdit, customers, txMap, drafts, dateKey, timeGroup, add, update]);

  const handleWhatsApp = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    const tx = txMap[customerId];
    if (!customer || !tx) return;
    const msg = `M's ${customer.name},\n\n📦 Amount: ${tx.quantity} Ltr @ ${tx.price}\n💰 Received: Rs ${tx.mila || 0}\n\nThanks,\nCHITRA AGRO!! 🎉`;
    const phone = (customer.phone || '').replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

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
          {isLoadingData && (
            <Loader2 size={20} className="animate-spin text-primary" />
          )}
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
            <div className="overflow-x-auto -mx-4 px-4">
              {isLoadingData && (
                <div className="flex items-center justify-center py-4 gap-2 text-primary">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm font-body">Loading entries...</span>
                </div>
              )}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="data-table-header text-left py-2">{t('nav.customers', lang)}</th>
                    <th className="data-table-header text-center py-2">{t('transaction.qty', lang)}</th>
                    <th className="data-table-header text-center py-2">{t('transaction.price', lang)}</th>
                    <th className="data-table-header text-center py-2">{t('transaction.mila', lang)}</th>
                    <th className="data-table-header text-center py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map(customer => {
                    const tx = txMap[customer.id];
                    return (
                      <tr key={customer.id} className="border-b border-border/50">
                        <td className="data-table-cell text-left font-body text-xs">{customer.name}</td>
                        <td className="data-table-cell text-center">
                          <input type="number" inputMode="decimal"
                            value={getFieldValue(customer.id, 'quantity')}
                            placeholder="0"
                            onChange={e => handleFieldInput(customer.id, 'quantity', e.target.value)}
                            onBlur={() => handleFieldBlur(customer.id, 'quantity')}
                            disabled={!canEdit}
                            className="w-14 text-center rounded border border-border py-1 font-number text-sm bg-card focus:outline-none focus:border-primary disabled:opacity-50" />
                        </td>
                        <td className="data-table-cell text-center">
                          <input type="number" inputMode="numeric"
                            value={getFieldValue(customer.id, 'price')}
                            onChange={e => handleFieldInput(customer.id, 'price', e.target.value)}
                            onBlur={() => handleFieldBlur(customer.id, 'price')}
                            disabled={!canEdit}
                            className="w-14 text-center rounded border border-border py-1 font-number text-sm text-primary font-bold bg-card focus:outline-none focus:border-primary disabled:opacity-50" />
                        </td>
                        <td className="data-table-cell text-center">
                          <input type="number" inputMode="numeric"
                            value={getFieldValue(customer.id, 'mila')}
                            placeholder="0"
                            onChange={e => handleFieldInput(customer.id, 'mila', e.target.value)}
                            onBlur={() => handleFieldBlur(customer.id, 'mila')}
                            disabled={!canEdit}
                            className="w-14 text-center rounded border border-border py-1 font-number text-sm bg-card focus:outline-none focus:border-primary disabled:opacity-50" />
                        </td>
                        <td className="data-table-cell text-center">
                          {tx && Number(tx.quantity) > 0 && (
                            <button onClick={() => handleWhatsApp(customer.id)} className="p-1 text-primary">
                              <MessageCircle size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
