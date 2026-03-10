import { useState, useMemo } from 'react';
import AppHeader from '@/components/AppHeader';
import NepaliDatePicker from '@/components/NepaliDatePicker';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { getTodayNepali, getDaysInMonth, nepaliDateToKey, type NepaliDate } from '@/lib/nepaliDate';
import { customerStore, transactionStore, staffStore, expenseStore, procurementStore, paymentStore } from '@/lib/store';
import { Users, UserCog, IndianRupee, Receipt, Milk, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

export default function Dashboard() {
  const { lang } = useApp();
  const today = getTodayNepali();
  const [date, setDate] = useState<NepaliDate>({ year: today.year, month: today.month, day: today.day });

  const yearMonth = `${date.year}-${String(date.month).padStart(2, '0')}`;

  const customers = customerStore.getAll();
  const staff = staffStore.getAll();
  const allTransactions = transactionStore.getAll();
  const monthTransactions = allTransactions.filter(tx => tx.dateKey.startsWith(yearMonth));
  const monthExpenses = expenseStore.getByMonth(yearMonth);
  const monthProcurement = procurementStore.getByMonth(yearMonth);
  const allPayments = paymentStore.getAll();

  const totalExpenses = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const totalProcurement = monthProcurement.reduce((s, p) => s + p.total, 0);
  const staffAdvance = staff.reduce((s, st) => s + st.advance, 0);

  // Hisab: total sales - total payments
  const totalSalesAll = allTransactions.reduce((s, tx) => s + tx.total, 0);
  const totalPaymentsAll = allPayments.reduce((s, p) => s + p.amount, 0);
  const customerOpeningBal = customers.reduce((s, c) => s + c.openingBalance, 0);
  const hisab = totalSalesAll + customerOpeningBal - totalPaymentsAll;

  // Daily chart data
  const daysInMonth = getDaysInMonth(date.year, date.month);
  const dailyChartData = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const key = nepaliDateToKey({ year: date.year, month: date.month, day });
      const dayTx = monthTransactions.filter(tx => tx.dateKey === key);
      const sales = dayTx.reduce((s, tx) => s + tx.total, 0);
      return { day: String(day).padStart(2, '0'), sales };
    });
  }, [date.year, date.month, daysInMonth, monthTransactions]);

  const stats = [
    { label: t('dashboard.totalCustomers', lang), value: customers.length, icon: Users },
    { label: t('dashboard.totalStaff', lang), value: staff.length, icon: UserCog },
    { label: t('dashboard.hisab', lang), value: `₹${hisab}`, icon: IndianRupee, negative: hisab > 0 },
    { label: t('dashboard.totalExpenses', lang), value: `₹${totalExpenses}`, icon: Receipt },
    { label: t('dashboard.milkProcurement', lang), value: `₹${totalProcurement}`, icon: Milk },
    { label: t('dashboard.staffAdvance', lang), value: `₹${staffAdvance}`, icon: Wallet },
  ];

  return (
    <div className="pb-20">
      <AppHeader title={t('app.name', lang)} />
      <div className="p-4 space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2">
          {stats.map(({ label, value, icon: Icon, negative }) => (
            <div key={label} className="stat-card flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className={`font-number text-lg font-bold ${negative ? 'text-destructive' : 'text-foreground'}`}>
                  {value}
                </span>
                <Icon size={18} className="text-stone" />
              </div>
              <span className="text-[10px] text-muted-foreground font-body leading-tight">{label}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <NepaliDatePicker date={date} onChange={setDate} showDay={false} />

        {/* Daily Transactions Chart */}
        <div className="stat-card">
          <h2 className="font-heading text-base font-semibold mb-3">{t('dashboard.dailyTransactions', lang)}</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChartData}>
                <XAxis dataKey="day" tick={{ fontSize: 9 }} interval={2} />
                <YAxis tick={{ fontSize: 9 }} width={35} />
                <Tooltip formatter={(v: number) => [`₹${v}`, 'Sales']} />
                <Bar dataKey="sales" fill="hsl(122, 46%, 33%)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
