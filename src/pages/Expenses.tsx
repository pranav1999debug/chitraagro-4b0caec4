import { useState } from 'react';
import AppHeader from '@/components/AppHeader';
import NepaliDatePicker from '@/components/NepaliDatePicker';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { getTodayNepali, nepaliDateToKey, type NepaliDate } from '@/lib/nepaliDate';
import { expenseStore, type Expense } from '@/lib/store';
import { Plus, Trash2, X } from 'lucide-react';

const CATEGORIES = ['Food', 'Medicine', 'Maintenance', 'Fuel', 'Other'];

export default function Expenses() {
  const { lang } = useApp();
  const today = getTodayNepali();
  const [filterDate, setFilterDate] = useState<NepaliDate>({ year: today.year, month: today.month, day: today.day });
  const yearMonth = `${filterDate.year}-${String(filterDate.month).padStart(2, '0')}`;

  const [expenses, setExpenses] = useState(expenseStore.getByMonth(yearMonth));
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ category: CATEGORIES[0], subCategory: '', amount: 0, notes: '', date: today });

  const refresh = () => setExpenses(expenseStore.getByMonth(yearMonth));

  const handleDateChange = (d: NepaliDate) => {
    setFilterDate(d);
    const ym = `${d.year}-${String(d.month).padStart(2, '0')}`;
    setExpenses(expenseStore.getByMonth(ym));
  };

  const handleSave = () => {
    if (!form.amount) return;
    expenseStore.add({
      category: form.category,
      subCategory: form.subCategory,
      amount: form.amount,
      notes: form.notes,
      dateKey: nepaliDateToKey(form.date),
    });
    setShowModal(false);
    setForm({ category: CATEGORIES[0], subCategory: '', amount: 0, notes: '', date: today });
    refresh();
  };

  const handleDelete = (id: string) => {
    expenseStore.delete(id);
    refresh();
  };

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="pb-20">
      <AppHeader title={t('nav.expenses', lang)} />
      <div className="p-4 space-y-4">
        <button onClick={() => setShowModal(true)} className="action-button w-full flex items-center justify-center gap-2">
          <Plus size={18} /> {t('expense.addExpense', lang)}
        </button>

        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-2">{lang === 'en' ? 'Selected Date' : 'चयनित तिथि'}</p>
          <NepaliDatePicker date={filterDate} onChange={handleDateChange} showDay={false} />
        </div>

        <div className="stat-card flex justify-between">
          <span className="text-sm font-body text-muted-foreground">{t('common.total', lang)}</span>
          <span className="font-number font-bold text-lg">₹{total}</span>
        </div>

        {expenses.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">{t('common.noData', lang)}</p>
        ) : (
          expenses.map(exp => (
            <ExpenseCard key={exp.id} expense={exp} onDelete={handleDelete} />
          ))
        )}
      </div>

      {showModal && (
        <>
          <div className="modal-overlay" onClick={() => setShowModal(false)} />
          <div className="modal-content">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-heading text-lg font-bold">{t('expense.details', lang)}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-stone" /></button>
            </div>
            <div className="space-y-3">
              <NepaliDatePicker date={form.date} onChange={d => setForm({ ...form, date: d })} showDay />
              <div>
                <label className="text-xs text-muted-foreground">{t('expense.category', lang)}</label>
                <select className="input-field text-sm" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <input className="input-field" placeholder={lang === 'en' ? 'Sub Category' : 'उप श्रेणी'} value={form.subCategory} onChange={e => setForm({ ...form, subCategory: e.target.value })} />
              <div>
                <label className="text-xs text-muted-foreground">{t('common.amount', lang)}</label>
                <input className="input-field font-number" type="number" inputMode="numeric" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) || 0 })} />
              </div>
              <input className="input-field" placeholder={t('common.notes', lang)} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} className="action-button flex-1">{t('common.save', lang)}</button>
                <button onClick={() => setShowModal(false)} className="flex-1 rounded-lg border border-border py-3 text-muted-foreground font-heading">{t('common.cancel', lang)}</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ExpenseCard({ expense, onDelete }: { expense: Expense; onDelete: (id: string) => void }) {
  return (
    <div className="stat-card flex items-center justify-between">
      <div>
        <p className="font-heading font-semibold text-sm">{expense.category}</p>
        {expense.subCategory && <p className="text-[10px] text-muted-foreground">{expense.subCategory}</p>}
        {expense.notes && <p className="text-[10px] text-muted-foreground">{expense.notes}</p>}
        <p className="text-[10px] text-stone">{expense.dateKey}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-number font-bold text-destructive">₹{expense.amount}</span>
        <button onClick={() => onDelete(expense.id)} className="p-1 text-destructive"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}
