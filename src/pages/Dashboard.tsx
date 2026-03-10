import { useState, useMemo } from 'react';
import AppHeader from '@/components/AppHeader';
import NepaliDatePicker from '@/components/NepaliDatePicker';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';
import { getTodayNepali, getDaysInMonth, nepaliDateToKey, type NepaliDate } from '@/lib/nepaliDate';
import { useCustomers, useAllTransactions, useStaff, useAllExpenses, useAllProcurement, usePayments } from '@/hooks/useFarmData';
import { Users, UserCog, IndianRupee, Receipt, Milk, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

export default function Dashboard() {
  const { lang } = useApp();
  const { farmName } = useAuth();
  const today = getTodayNepali();
  const [date, setDate] = useState<NepaliDate>({ year: today.year, month: today.month, day: today.day });

  const yearMonth = `${date.year}-${String(date.month).padStart(2, '0')}`;

  const { data: customers = [] } = useCustomers();
  const { data: staff = [] } = useStaff();
  const { data: allTransactions = [] } = useAllTransactions();
  const { data: allExpenses = [] } = useAllExpenses();
  const { data: allProcurement = [] } = useAllProcurement();
  const { data: allPayments = [] } = usePayments();

  const monthTransactions = allTransactions.filter(tx => tx.date_key.startsWith(yearMonth));
  const monthExpenses = allExpenses.filter(e => e.date_key.startsWith(yearMonth));
  const monthProcurement = allProcurement.filter(p => p.date_key.startsWith(yearMonth));

  const totalExpenses = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalProcurement = monthProcurement.reduce((s, p) => s + Number(p.total), 0);
  const staffAdvance = staff.reduce((s, st) => s + Number(st.advance), 0);

  const totalSalesAll = allTransactions.reduce((s, tx) => s + Number(tx.total), 0);
  const totalPaymentsAll = allPayments.reduce((s, p) => s + Number(p.amount), 0);
  const customerOpeningBal = customers.reduce((s, c) => s + Number(c.opening_balance), 0);
  const hisab = totalSalesAll + customerOpeningBal - totalPaymentsAll;

  const daysInMonth = getDaysInMonth(date.year, date.month);
  const dailyChartData = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const key = nepaliDateToKey({ year: date.year, month: date.month, day });
      const dayTx = monthTransactions.filter(tx => tx.date_key === key);
      const sales = dayTx.reduce((s, tx) => s + Number(tx.total), 0);
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
      <AppHeader title={farmName || t('app.name', lang)} />
      <div className="p-4 space-y-4">
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

        <NepaliDatePicker date={date} onChange={setDate} showDay={false} />

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
