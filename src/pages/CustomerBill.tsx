import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';
import { getTodayNepali, getNepaliMonthName, getDaysInMonth } from '@/lib/nepaliDate';
import { useCustomers, useAllTransactions, usePayments } from '@/hooks/useFarmData';
import { Download, MessageCircle, ArrowLeft } from 'lucide-react';

export default function CustomerBill() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { lang } = useApp();
  const { farmName } = useAuth();
  const today = getTodayNepali();
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);

  const { data: customers = [] } = useCustomers();
  const { data: allTransactions = [] } = useAllTransactions();
  const { data: allPayments = [] } = usePayments();

  const customer = customers.find(c => c.id === customerId);
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
  const daysInMonth = getDaysInMonth(year, month);

  const dailyRecords = useMemo(() => {
    if (!customer) return [];
    const records: { day: number; dateKey: string; liters: number; rate: number; amount: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${yearMonth}-${String(d).padStart(2, '0')}`;
      const dayTx = allTransactions.filter(tx => tx.customer_id === customerId && tx.date_key === dateKey);
      if (dayTx.length > 0) {
        const liters = dayTx.reduce((s, tx) => s + Number(tx.quantity), 0);
        const amount = dayTx.reduce((s, tx) => s + Number(tx.total), 0);
        const rate = Number(dayTx[0].price);
        records.push({ day: d, dateKey, liters, rate, amount });
      }
    }
    return records;
  }, [allTransactions, customerId, yearMonth, daysInMonth, customer]);

  const monthPayments = useMemo(() => {
    if (!customer) return [];
    return allPayments.filter(p => p.customer_id === customerId && p.date_key.startsWith(yearMonth));
  }, [allPayments, customerId, yearMonth, customer]);

  if (!customer) return <div className="p-4 text-center text-muted-foreground">Customer not found</div>;

  const totalLiters = dailyRecords.reduce((s, r) => s + r.liters, 0);
  const totalAmount = dailyRecords.reduce((s, r) => s + r.amount, 0);
  const totalPayments = monthPayments.reduce((s, p) => s + Number(p.amount), 0);
  const previousBalance = Number(customer.opening_balance);
  const finalBalance = previousBalance + totalAmount - totalPayments;

  const monthName = getNepaliMonthName(month, lang === 'hi' ? 'np' : 'en');
  const displayFarmName = farmName || 'CHITRA AGRO';

  const getBillText = () => {
    return `Hello ${customer.name},\n\nMonthly Milk Bill Summary\n\nMonth: ${monthName} ${year}\n\nTotal Milk: ${totalLiters} Ltrs\nRate: Rs ${customer.purchase_rate}\nTotal Amount: Rs ${totalAmount}\nPayments Received: Rs ${totalPayments}\nPrevious Balance: Rs ${previousBalance}\nRemaining Balance: Rs ${finalBalance}\n\nThank you\n${displayFarmName}`;
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(getBillText());
    const phone = (customer.phone || '').replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  const handleDownloadPDF = () => {
    const content = getBillText();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bill_${customer.name}_${yearMonth}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pb-20">
      <AppHeader title={t('bill.monthlyBill', lang)} />
      <div className="p-4 space-y-4">
        <div className="stat-card flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1 text-muted-foreground"><ArrowLeft size={20} /></button>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-heading font-bold text-sm">{customer.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <p className="font-heading font-semibold text-sm">{customer.name}</p>
            <p className="text-[10px] text-muted-foreground">{customer.phone}</p>
          </div>
        </div>

        <div className="stat-card">
          <h3 className="font-heading text-sm font-semibold mb-2">{t('common.selectMonth', lang)}</h3>
          <div className="flex gap-2">
            <select className="input-field text-sm flex-1" value={year} onChange={e => setYear(Number(e.target.value))}>
              {[2080, 2081, 2082, 2083, 2084, 2085].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className="input-field text-sm flex-1" value={month} onChange={e => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{getNepaliMonthName(i + 1, lang === 'hi' ? 'np' : 'en')}</option>)}
            </select>
          </div>
        </div>

        <div className="stat-card">
          <h3 className="font-heading text-sm font-semibold mb-3">{t('bill.dailyRecords', lang)}</h3>
          {dailyRecords.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-6">{t('common.noData', lang)}</p>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="data-table-header text-left py-2">{t('common.date', lang)}</th>
                    <th className="data-table-header text-center py-2">{t('bill.liters', lang)}</th>
                    <th className="data-table-header text-center py-2">{t('transaction.price', lang)}</th>
                    <th className="data-table-header text-right py-2">{t('common.total', lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRecords.map(r => (
                    <tr key={r.day} className="border-b border-border/50">
                      <td className="data-table-cell text-left">{r.day}</td>
                      <td className="data-table-cell text-center">{r.liters}</td>
                      <td className="data-table-cell text-center">₹{r.rate}</td>
                      <td className="data-table-cell text-right">₹{r.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="stat-card space-y-2">
          <h3 className="font-heading text-sm font-semibold">{t('bill.summary', lang)}</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{t('bill.totalMilk', lang)}</span><span className="font-number font-semibold">{totalLiters} Ltrs</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('bill.totalAmount', lang)}</span><span className="font-number font-semibold">₹{totalAmount}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('bill.paymentsReceived', lang)}</span><span className="font-number font-semibold text-primary">₹{totalPayments}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('bill.previousBalance', lang)}</span><span className="font-number font-semibold">₹{previousBalance}</span></div>
            <div className="border-t border-border pt-2 flex justify-between">
              <span className="font-heading font-bold">{t('bill.finalBalance', lang)}</span>
              <span className={`font-number font-bold text-lg ${finalBalance > 0 ? 'text-destructive' : 'text-primary'}`}>₹{finalBalance}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={handleDownloadPDF} className="flex-1 stat-card flex items-center justify-center gap-2 py-3 text-sm font-heading font-semibold text-foreground active:opacity-80">
            <Download size={18} /> {t('bill.download', lang)}
          </button>
          <button onClick={handleWhatsApp} className="flex-1 action-button flex items-center justify-center gap-2 text-sm">
            <MessageCircle size={18} /> {t('bill.whatsapp', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
