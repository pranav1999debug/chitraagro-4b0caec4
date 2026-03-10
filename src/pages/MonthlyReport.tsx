import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { getTodayNepali, getNepaliMonthName, getDaysInMonth } from '@/lib/nepaliDate';
import { useCustomers, useAllTransactions, usePayments, useAllProcurement, useAllExpenses, useStaff, useAllAttendance } from '@/hooks/useFarmData';
import { ArrowLeft, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

export default function MonthlyReport() {
  const navigate = useNavigate();
  const { lang } = useApp();
  const today = getTodayNepali();
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);

  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
  const daysInMonth = getDaysInMonth(year, month);
  const monthName = getNepaliMonthName(month, lang === 'hi' ? 'np' : 'en');

  const { data: customers = [] } = useCustomers();
  const { data: allTx = [] } = useAllTransactions();
  const { data: allPayments = [] } = usePayments();
  const { data: allProcurement = [] } = useAllProcurement();
  const { data: allExpenses = [] } = useAllExpenses();
  const { data: allStaff = [] } = useStaff();
  const { data: allAttendance = [] } = useAllAttendance();

  const data = useMemo(() => {
    const monthTx = allTx.filter(tx => tx.date_key.startsWith(yearMonth));
    const monthPayments = allPayments.filter(p => p.date_key.startsWith(yearMonth));
    const monthProcurement = allProcurement.filter(p => p.date_key.startsWith(yearMonth));
    const monthExpenses = allExpenses.filter(e => e.date_key.startsWith(yearMonth));
    const monthAttendance = allAttendance.filter(a => a.date_key.startsWith(yearMonth));

    const totalLitersSold = monthTx.reduce((s, tx) => s + Number(tx.quantity), 0);
    const totalSalesAmount = monthTx.reduce((s, tx) => s + Number(tx.total), 0);
    const totalMilkPurchased = monthProcurement.reduce((s, p) => s + Number(p.quantity), 0);
    const procurementCost = monthProcurement.reduce((s, p) => s + Number(p.total), 0);
    const totalExpenses = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const totalPaymentsReceived = monthPayments.reduce((s, p) => s + Number(p.amount), 0);

    const expenseByCategory: Record<string, number> = {};
    monthExpenses.forEach(e => {
      expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + Number(e.amount);
    });

    const totalSalary = allStaff.reduce((s, staff) => {
      const staffAtt = monthAttendance.filter(a => a.staff_id === staff.id && a.present);
      const presentDays = staffAtt.length;
      const dailyRate = Number(staff.salary) / 30;
      return s + presentDays * dailyRate;
    }, 0);
    const totalAdvance = monthAttendance.reduce((s, a) => s + Number(a.advance_amount), 0);

    const totalPending = customers.reduce((s, c) => {
      const custTx = allTx.filter(tx => tx.customer_id === c.id);
      const custPay = allPayments.filter(p => p.customer_id === c.id);
      const balance = Number(c.opening_balance) + custTx.reduce((a, tx) => a + Number(tx.total), 0) - custPay.reduce((a, p) => a + Number(p.amount), 0);
      return s + balance;
    }, 0);

    const totalRevenue = totalSalesAmount;
    const totalCosts = procurementCost + totalExpenses + Math.round(totalSalary);
    const profitLoss = totalRevenue - totalCosts;

    const dailyChart: { day: number; sales: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dk = `${yearMonth}-${String(d).padStart(2, '0')}`;
      const daySales = monthTx.filter(tx => tx.date_key === dk).reduce((s, tx) => s + Number(tx.total), 0);
      if (daySales > 0) dailyChart.push({ day: d, sales: daySales });
    }

    return {
      totalLitersSold, totalSalesAmount, totalMilkPurchased, procurementCost,
      totalExpenses, expenseByCategory, totalSalary: Math.round(totalSalary),
      totalAdvance, totalPaymentsReceived, totalPending,
      totalRevenue, totalCosts, profitLoss, dailyChart,
    };
  }, [allTx, allPayments, allProcurement, allExpenses, allStaff, allAttendance, customers, yearMonth, daysInMonth]);

  const handleDownload = () => {
    const lines = [
      `Monthly Business Summary - ${monthName} ${year}`, '',
      `Milk Sales: ${data.totalLitersSold} Ltrs | Rs ${data.totalSalesAmount}`,
      `Procurement: ${data.totalMilkPurchased} Ltrs | Rs ${data.procurementCost}`,
      `Total Expenses: Rs ${data.totalExpenses}`,
      ...Object.entries(data.expenseByCategory).map(([cat, amt]) => `  ${cat}: Rs ${amt}`),
      `Staff Salary: Rs ${data.totalSalary}`,
      `Staff Advance: Rs ${data.totalAdvance}`,
      `Payments Received: Rs ${data.totalPaymentsReceived}`,
      `Pending Balance: Rs ${data.totalPending}`, '',
      `Revenue: Rs ${data.totalRevenue}`,
      `Costs: Rs ${data.totalCosts}`,
      `${data.profitLoss >= 0 ? 'Profit' : 'Loss'}: Rs ${Math.abs(data.profitLoss)}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `report_${yearMonth}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pb-20">
      <AppHeader title={t('report.title', lang)} />
      <div className="p-4 space-y-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft size={16} /> {t('common.cancel', lang)}
        </button>

        <div className="stat-card">
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
          <h3 className="font-heading text-sm font-semibold mb-2">{t('report.milkSales', lang)}</h3>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('report.totalLiters', lang)}</span><span className="font-number font-bold">{data.totalLitersSold} Ltrs</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('report.salesAmount', lang)}</span><span className="font-number font-bold">₹{data.totalSalesAmount}</span></div>
        </div>

        <div className="stat-card">
          <h3 className="font-heading text-sm font-semibold mb-2">{t('nav.procurement', lang)}</h3>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('report.milkPurchased', lang)}</span><span className="font-number font-bold">{data.totalMilkPurchased} Ltrs</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('report.procurementCost', lang)}</span><span className="font-number font-bold">₹{data.procurementCost}</span></div>
        </div>

        <div className="stat-card">
          <h3 className="font-heading text-sm font-semibold mb-2">{t('nav.expenses', lang)}</h3>
          <div className="flex justify-between text-sm mb-1"><span className="text-muted-foreground">{t('dashboard.totalExpenses', lang)}</span><span className="font-number font-bold">₹{data.totalExpenses}</span></div>
          {Object.entries(data.expenseByCategory).map(([cat, amt]) => (
            <div key={cat} className="flex justify-between text-xs pl-3"><span className="text-muted-foreground">{cat}</span><span className="font-number">₹{amt}</span></div>
          ))}
        </div>

        <div className="stat-card">
          <h3 className="font-heading text-sm font-semibold mb-2">{t('nav.staff', lang)}</h3>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('report.totalSalary', lang)}</span><span className="font-number font-bold">₹{data.totalSalary}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('report.totalAdvance', lang)}</span><span className="font-number font-bold">₹{data.totalAdvance}</span></div>
        </div>

        <div className="stat-card">
          <h3 className="font-heading text-sm font-semibold mb-2">{t('nav.customers', lang)}</h3>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('report.paymentsReceived', lang)}</span><span className="font-number font-bold text-primary">₹{data.totalPaymentsReceived}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('report.pendingBalance', lang)}</span><span className="font-number font-bold text-destructive">₹{data.totalPending}</span></div>
        </div>

        <div className={`stat-card border-2 ${data.profitLoss >= 0 ? 'border-primary' : 'border-destructive'}`}>
          <h3 className="font-heading text-sm font-semibold mb-2">{t('report.profitLoss', lang)}</h3>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('report.revenue', lang)}</span><span className="font-number font-bold">₹{data.totalRevenue}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('report.totalCosts', lang)}</span><span className="font-number font-bold">₹{data.totalCosts}</span></div>
          <div className="border-t border-border pt-2 mt-2 flex justify-between items-center">
            <div className="flex items-center gap-1">
              {data.profitLoss >= 0 ? <TrendingUp size={18} className="text-primary" /> : <TrendingDown size={18} className="text-destructive" />}
              <span className="font-heading font-bold">{data.profitLoss >= 0 ? t('report.profit', lang) : t('report.loss', lang)}</span>
            </div>
            <span className={`font-number font-bold text-xl ${data.profitLoss >= 0 ? 'text-primary' : 'text-destructive'}`}>₹{Math.abs(data.profitLoss)}</span>
          </div>
        </div>

        {data.dailyChart.length > 0 && (
          <div className="stat-card">
            <h3 className="font-heading text-sm font-semibold mb-3">{t('report.dailySales', lang)}</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.dailyChart}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="sales" fill="hsl(122, 46%, 33%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <button onClick={handleDownload} className="action-button w-full flex items-center justify-center gap-2">
          <Download size={18} /> {t('report.downloadReport', lang)}
        </button>
      </div>
    </div>
  );
}
