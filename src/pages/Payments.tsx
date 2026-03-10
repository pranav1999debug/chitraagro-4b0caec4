import { useState } from 'react';
import AppHeader from '@/components/AppHeader';
import NepaliDatePicker from '@/components/NepaliDatePicker';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';
import { getTodayNepali, nepaliDateToKey, type NepaliDate } from '@/lib/nepaliDate';
import { useCustomers, useAllTransactions, usePayments, usePaymentMutations, type DbCustomer } from '@/hooks/useFarmData';
import { Search, Plus, X, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Payments() {
  const { lang } = useApp();
  const { role } = useAuth();
  const navigate = useNavigate();
  const { data: customers = [] } = useCustomers();
  const { data: allTx = [] } = useAllTransactions();
  const { data: allPayments = [] } = usePayments();
  const { add } = usePaymentMutations();
  const [search, setSearch] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<DbCustomer | null>(null);
  const [payDate, setPayDate] = useState<NepaliDate>(getTodayNepali());
  const [payAmount, setPayAmount] = useState(0);
  const [payNotes, setPayNotes] = useState('');

  const canEdit = role === 'owner' || role === 'manager';

  const getBalance = (c: DbCustomer) => {
    const txTotal = allTx.filter(tx => tx.customer_id === c.id).reduce((s, tx) => s + Number(tx.total), 0);
    const payTotal = allPayments.filter(p => p.customer_id === c.id).reduce((s, p) => s + Number(p.amount), 0);
    return Number(c.opening_balance) + txTotal - payTotal;
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search)
  );

  const handleAddPayment = () => {
    if (!selectedCustomer || payAmount <= 0) return;
    add.mutate({
      customer_id: selectedCustomer.id,
      date_key: nepaliDateToKey(payDate),
      amount: payAmount,
      notes: payNotes,
    });
    setShowPayModal(false);
    setPayAmount(0);
    setPayNotes('');
    setSelectedCustomer(null);
  };

  const openPay = (c: DbCustomer) => {
    setSelectedCustomer(c);
    setPayDate(getTodayNepali());
    setPayAmount(0);
    setPayNotes('');
    setShowPayModal(true);
  };

  return (
    <div className="pb-20">
      <AppHeader title={t('nav.payments', lang)} />
      <div className="p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder={t('common.search', lang)} value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9 text-sm" />
        </div>

        {filtered.map(c => {
          const balance = getBalance(c);
          return (
            <div key={c.id} className="stat-card">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-heading font-bold text-xs">
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-heading font-semibold text-sm">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground">{c.phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">{t('bill.balance', lang)}</p>
                  <p className={`font-number font-bold text-sm ${balance > 0 ? 'text-destructive' : 'text-primary'}`}>₹{balance}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {canEdit && (
                  <button onClick={() => openPay(c)} className="flex-1 action-button text-xs py-2 flex items-center justify-center gap-1">
                    <Plus size={14} /> {t('bill.addPayment', lang)}
                  </button>
                )}
                <button onClick={() => navigate(`/customers/${c.id}/bill`)} className="flex-1 stat-card text-xs py-2 flex items-center justify-center gap-1 font-heading font-semibold">
                  <FileText size={14} /> {t('bill.viewBill', lang)}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showPayModal && selectedCustomer && (
        <>
          <div className="modal-overlay" onClick={() => setShowPayModal(false)} />
          <div className="modal-content">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-heading text-lg font-bold">{t('bill.addPayment', lang)} - {selectedCustomer.name}</h2>
              <button onClick={() => setShowPayModal(false)}><X size={20} className="text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">{t('common.date', lang)}</label>
                <NepaliDatePicker date={payDate} onChange={setPayDate} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('common.amount', lang)}</label>
                <input className="input-field font-number" type="number" inputMode="numeric" value={payAmount || ''} onChange={e => setPayAmount(Number(e.target.value) || 0)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('common.notes', lang)}</label>
                <input className="input-field" value={payNotes} onChange={e => setPayNotes(e.target.value)} />
              </div>
              <button onClick={handleAddPayment} className="action-button w-full">{t('common.save', lang)}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
