import { useState, useMemo } from 'react';
import AppHeader from '@/components/AppHeader';
import NepaliDatePicker from '@/components/NepaliDatePicker';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { getTodayNepali, nepaliDateToKey, type NepaliDate } from '@/lib/nepaliDate';
import { customerStore, transactionStore, type Transaction } from '@/lib/store';

export default function Operations() {
  const { lang } = useApp();
  const today = getTodayNepali();
  const [date, setDate] = useState<NepaliDate>(today);
  const [timeGroup, setTimeGroup] = useState<'morning' | 'evening'>('morning');

  const dateKey = nepaliDateToKey(date);
  const customers = customerStore.getAll();
  const transactions = transactionStore.getByDate(dateKey);

  const filteredCustomers = customers.filter(
    c => c.timeGroup === timeGroup || c.timeGroup === 'both'
  );

  const txMap = useMemo(() => {
    const map: Record<string, Transaction> = {};
    transactions.filter(tx => tx.timeGroup === timeGroup).forEach(tx => { map[tx.customerId] = tx; });
    return map;
  }, [transactions, timeGroup]);

  const totalLiters = Object.values(txMap).reduce((s, tx) => s + tx.quantity, 0);
  const totalReceived = Object.values(txMap).reduce((s, tx) => s + tx.total, 0);

  const handleFieldChange = (customerId: string, field: 'quantity' | 'price' | 'mila', value: number) => {
    const existing = txMap[customerId];
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const qty = field === 'quantity' ? value : (existing?.quantity || 0);
    const price = field === 'price' ? value : (existing?.price || customer.purchaseRate);
    const mila = field === 'mila' ? value : (existing?.mila || 0);
    const total = qty * price - mila;

    if (existing) {
      transactionStore.update(existing.id, { [field]: value, total });
    } else {
      transactionStore.add({
        customerId,
        dateKey,
        timeGroup,
        quantity: qty,
        price,
        mila,
        total,
      });
    }
    // Force re-render
    setDate({ ...date });
  };

  return (
    <div className="pb-20">
      <AppHeader title={t('nav.operations', lang)} />
      <div className="p-4 space-y-4">
        {/* Date Picker */}
        <div className="stat-card">
          <h2 className="font-heading text-sm font-semibold mb-2">{t('transaction.selectDate', lang)}</h2>
          <NepaliDatePicker date={date} onChange={setDate} showDay />
          {/* Time Group Toggle */}
          <div className="flex mt-3 border-t border-border pt-3">
            {(['morning', 'evening'] as const).map(tg => (
              <button
                key={tg}
                onClick={() => setTimeGroup(tg)}
                className={`flex-1 text-center py-2 font-heading text-sm transition-colors ${
                  timeGroup === tg ? 'tab-active' : 'tab-inactive'
                }`}
              >
                {t(`common.${tg}`, lang)}
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
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

        {/* Customer List Table */}
        <div className="stat-card">
          <h3 className="font-heading text-sm font-semibold mb-3">
            {t(`common.${timeGroup}`, lang)} {t('nav.customers', lang)}: {filteredCustomers.length}
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
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map(customer => {
                    const tx = txMap[customer.id];
                    return (
                      <tr key={customer.id} className="border-b border-border/50">
                        <td className="data-table-cell text-left font-body text-xs">{customer.name}</td>
                        <td className="data-table-cell text-center">
                          <input
                            type="number"
                            inputMode="decimal"
                            value={tx?.quantity || ''}
                            placeholder="0"
                            onChange={e => handleFieldChange(customer.id, 'quantity', Number(e.target.value) || 0)}
                            className="w-14 text-center rounded border border-border py-1 font-number text-sm bg-card focus:outline-none focus:border-primary"
                          />
                        </td>
                        <td className="data-table-cell text-center">
                          <input
                            type="number"
                            inputMode="numeric"
                            value={tx?.price || customer.purchaseRate || ''}
                            onChange={e => handleFieldChange(customer.id, 'price', Number(e.target.value) || 0)}
                            className="w-14 text-center rounded border border-border py-1 font-number text-sm text-primary font-bold bg-card focus:outline-none focus:border-primary"
                          />
                        </td>
                        <td className="data-table-cell text-center">
                          <input
                            type="number"
                            inputMode="numeric"
                            value={tx?.mila || ''}
                            placeholder="0"
                            onChange={e => handleFieldChange(customer.id, 'mila', Number(e.target.value) || 0)}
                            className="w-14 text-center rounded border border-border py-1 font-number text-sm bg-card focus:outline-none focus:border-primary"
                          />
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
