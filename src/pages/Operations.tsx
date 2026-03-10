import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';
import NepaliDatePicker from '@/components/NepaliDatePicker';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';
import { getTodayNepali, nepaliDateToKey, type NepaliDate } from '@/lib/nepaliDate';
import { useCustomers, useTransactions, useTransactionMutations, type DbTransaction } from '@/hooks/useFarmData';
import { MessageCircle, BarChart3 } from 'lucide-react';

export default function Operations() {
  const { lang } = useApp();
  const { role } = useAuth();
  const navigate = useNavigate();
  const today = getTodayNepali();
  const [date, setDate] = useState<NepaliDate>(today);
  const [timeGroup, setTimeGroup] = useState<'morning' | 'evening'>('morning');

  const dateKey = nepaliDateToKey(date);
  const { data: customers = [] } = useCustomers();
  const { data: transactions = [] } = useTransactions(dateKey);
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

  const handleFieldChange = (customerId: string, field: 'quantity' | 'price' | 'mila', value: number) => {
    if (!canEdit) return;
    const existing = txMap[customerId];
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const qty = field === 'quantity' ? value : Number(existing?.quantity || 0);
    const price = field === 'price' ? value : Number(existing?.price || customer.purchase_rate);
    const mila = field === 'mila' ? value : Number(existing?.mila || 0);
    const total = qty * price - mila;

    if (existing) {
      update.mutate({ id: existing.id, [field]: value, total });
    } else {
      add.mutate({
        customer_id: customerId,
        date_key: dateKey,
        time_group: timeGroup,
        quantity: qty,
        price,
        mila,
        total,
      });
    }
  };

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
                          <input type="number" inputMode="decimal" value={tx?.quantity || ''} placeholder="0"
                            onChange={e => handleFieldChange(customer.id, 'quantity', Number(e.target.value) || 0)}
                            disabled={!canEdit}
                            className="w-14 text-center rounded border border-border py-1 font-number text-sm bg-card focus:outline-none focus:border-primary disabled:opacity-50" />
                        </td>
                        <td className="data-table-cell text-center">
                          <input type="number" inputMode="numeric" value={tx?.price || customer.purchase_rate || ''}
                            onChange={e => handleFieldChange(customer.id, 'price', Number(e.target.value) || 0)}
                            disabled={!canEdit}
                            className="w-14 text-center rounded border border-border py-1 font-number text-sm text-primary font-bold bg-card focus:outline-none focus:border-primary disabled:opacity-50" />
                        </td>
                        <td className="data-table-cell text-center">
                          <input type="number" inputMode="numeric" value={tx?.mila || ''} placeholder="0"
                            onChange={e => handleFieldChange(customer.id, 'mila', Number(e.target.value) || 0)}
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
