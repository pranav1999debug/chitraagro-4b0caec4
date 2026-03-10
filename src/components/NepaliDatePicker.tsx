import { getNepaliMonthName, getAvailableYears, getDaysInMonth, type NepaliDate } from '@/lib/nepaliDate';
import { useApp } from '@/contexts/AppContext';

interface Props {
  date: NepaliDate;
  onChange: (date: NepaliDate) => void;
  showDay?: boolean;
}

export default function NepaliDatePicker({ date, onChange, showDay = true }: Props) {
  const { lang } = useApp();
  const years = getAvailableYears();
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: getDaysInMonth(date.year, date.month) }, (_, i) => i + 1);

  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <label className="text-xs text-muted-foreground font-body mb-1 block">
          {lang === 'en' ? 'Year' : 'वर्ष'}
        </label>
        <select
          value={date.year}
          onChange={e => onChange({ ...date, year: Number(e.target.value), day: 1 })}
          className="input-field text-sm font-number py-2"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="flex-1">
        <label className="text-xs text-muted-foreground font-body mb-1 block">
          {lang === 'en' ? 'Month' : 'महीना'}
        </label>
        <select
          value={date.month}
          onChange={e => onChange({ ...date, month: Number(e.target.value), day: 1 })}
          className="input-field text-sm font-number py-2"
        >
          {months.map(m => (
            <option key={m} value={m}>{getNepaliMonthName(m, lang === 'hi' ? 'np' : 'en')}</option>
          ))}
        </select>
      </div>
      {showDay && (
        <div className="flex-1">
          <label className="text-xs text-muted-foreground font-body mb-1 block">
            {lang === 'en' ? 'Day' : 'दिन'}
          </label>
          <select
            value={date.day}
            onChange={e => onChange({ ...date, day: Number(e.target.value) })}
            className="input-field text-sm font-number py-2"
          >
            {days.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
