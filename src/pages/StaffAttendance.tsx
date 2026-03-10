import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';
import NepaliDatePicker from '@/components/NepaliDatePicker';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { getTodayNepali, getDaysInMonth, nepaliDateToKey, type NepaliDate } from '@/lib/nepaliDate';
import { staffStore, attendanceStore } from '@/lib/store';
import { ArrowLeft } from 'lucide-react';

export default function StaffAttendance() {
  const { lang } = useApp();
  const { staffId } = useParams<{ staffId: string }>();
  const navigate = useNavigate();
  const today = getTodayNepali();
  const [filterDate, setFilterDate] = useState<NepaliDate>({ year: today.year, month: today.month, day: today.day });

  const staff = staffStore.getAll().find(s => s.id === staffId);
  if (!staff) return <div className="p-4">Staff not found</div>;

  const yearMonth = `${filterDate.year}-${String(filterDate.month).padStart(2, '0')}`;
  const daysInMonth = getDaysInMonth(filterDate.year, filterDate.month);

  const attendance = attendanceStore.getByStaffMonth(staffId!, yearMonth);
  const attMap = useMemo(() => {
    const m: Record<string, { present: boolean; advanceAmount: number }> = {};
    attendance.forEach(a => { m[a.dateKey] = { present: a.present, advanceAmount: a.advanceAmount }; });
    return m;
  }, [attendance]);

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dateKey = nepaliDateToKey({ year: filterDate.year, month: filterDate.month, day });
    return { day, dateKey, ...(attMap[dateKey] || { present: false, advanceAmount: 0 }) };
  });

  const presentDays = days.filter(d => d.present).length;
  const dailySalary = staff.salary / daysInMonth;
  const totalSalary = Math.round(presentDays * dailySalary);
  const totalAdvance = days.reduce((s, d) => s + d.advanceAmount, 0);
  const finalPayable = totalSalary - totalAdvance - staff.advance;

  const togglePresent = (dateKey: string, current: boolean) => {
    attendanceStore.upsert({ staffId: staffId!, dateKey, present: !current, advanceAmount: attMap[dateKey]?.advanceAmount || 0 });
    setFilterDate({ ...filterDate }); // force re-render
  };

  const setAdvance = (dateKey: string, amount: number) => {
    attendanceStore.upsert({ staffId: staffId!, dateKey, present: attMap[dateKey]?.present || false, advanceAmount: amount });
    setFilterDate({ ...filterDate });
  };

  return (
    <div className="pb-20">
      <AppHeader title={`${staff.name} - ${t('staff.attendance', lang)}`} />
      <div className="p-4 space-y-4">
        <button onClick={() => navigate('/staff')} className="flex items-center gap-1 text-sm text-primary font-body">
          <ArrowLeft size={16} /> {lang === 'en' ? 'Back' : 'वापस'}
        </button>

        <NepaliDatePicker date={filterDate} onChange={setFilterDate} showDay={false} />

        {/* Summary */}
        <div className="stat-card grid grid-cols-2 gap-2 text-xs font-body">
          <div>{t('staff.present', lang)}: <span className="font-number font-bold">{presentDays}</span></div>
          <div>{t('staff.salary', lang)}: <span className="font-number font-bold">₹{totalSalary}</span></div>
          <div>{t('staff.advance', lang)}: <span className="font-number font-bold text-destructive">₹{totalAdvance + staff.advance}</span></div>
          <div>{lang === 'en' ? 'Payable' : 'देय'}: <span className={`font-number font-bold ${finalPayable >= 0 ? 'text-primary' : 'text-destructive'}`}>₹{finalPayable}</span></div>
        </div>

        {/* Attendance Table */}
        <div className="stat-card overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="data-table-header text-left py-2">{t('common.date', lang)}</th>
                <th className="data-table-header text-center py-2">{t('staff.present', lang)}</th>
                <th className="data-table-header text-center py-2">{t('staff.advance', lang)}</th>
              </tr>
            </thead>
            <tbody>
              {days.map(d => (
                <tr key={d.dateKey} className="border-b border-border/50">
                  <td className="data-table-cell text-left font-number">{d.day}</td>
                  <td className="data-table-cell text-center">
                    <button
                      onClick={() => togglePresent(d.dateKey, d.present)}
                      className={`w-8 h-8 rounded-md text-xs font-bold transition-colors ${
                        d.present ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      {d.present ? 'P' : 'A'}
                    </button>
                  </td>
                  <td className="data-table-cell text-center">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={d.advanceAmount || ''}
                      placeholder="0"
                      onChange={e => setAdvance(d.dateKey, Number(e.target.value) || 0)}
                      className="w-16 text-center rounded border border-border py-1 font-number text-sm bg-card focus:outline-none focus:border-primary"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
