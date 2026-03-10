import { useState } from 'react';
import AppHeader from '@/components/AppHeader';
import NepaliDatePicker from '@/components/NepaliDatePicker';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';
import { getTodayNepali, nepaliDateToKey, type NepaliDate } from '@/lib/nepaliDate';
import { useExpenses, useExpenseMutations, type DbExpense } from '@/hooks/useFarmData';
import { Plus, Trash2, X } from 'lucide-react';

const CATEGORIES = ['Food', 'Medicine', 'Maintenance', 'Fuel', 'Other'];

export default function Expenses() {
  const { lang } = useApp();
  const { role } = useAuth();
  const today = getTodayNepali();
  const [filterDate, setFilterDate] = useState<NepaliDate>({ year: today.year, month: today.month, day: today.day });
  const yearMonth = `${filterDate.year}-${String(filterDate.month).padStart(2, '0')}`;

  const { data: expenses = [] } = useExpenses(yearMonth);
  const { add, remove } = useExpenseMutations();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ category: CATEGORIES[0], sub_category: '' as string | null, amount: 0, notes: '' as string | null, date: today });

  const canEdit = role === 'owner' || role === 'manager';
  const canDelete = role === 'owner';

  const handleSave = () => {
    if (!form.amount) return;
    add.mutate({
      category: form.category,
      sub_category: form.sub_category,
      amount: form.amount,
      notes: form.notes,
      date_key: nepaliDateToKey(form.date),
    });
    setShowModal(false);
    setForm({ category: CATEGORIES[0], sub_category: '', amount: 0, notes: '', date: today });
  };

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="pb-20">
      <AppHeader title={t('nav.expenses', lang)} />
      <div className="p-4 space-y-4">
        {canEdit && (
          <button onClick={() => setShowModal(true)} className="action-button w-full flex items-center justify-center gap-2">
            <Plus size={18} /> {t('expense.addExpense', lang)}
          </button>
        )}

        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-2">{lang === 'en' ? 'Selected Date' : 'चयनित तिथि'}</p>
          <NepaliDatePicker date={filterDate} onChange={setFilterDate} showDay={false} />
        </div>

        <div className="stat-card flex justify-between">
          <span className="text-sm font-body text-muted-foreground">{t('common.total', lang)}</span>
          <span className="font-number font-bold text-lg">₹{total}</span>
        </div>

        {expenses.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">{t('common.noData', lang)}</p>
        ) : (
          expenses.map(exp => (
            <div key={exp.id} className="stat-card flex items-center justify-between">
              <div>
                <p className="font-heading font-semibold text-sm">{exp.category}</p>
                {exp.sub_category && <p className="text-[10px] text-muted-foreground">{exp.sub_category}</p>}
                {exp.notes && <p className="text-[10px] text-muted-foreground">{exp.notes}</p>}
                <p className="text-[10px] text-stone">{exp.date_key}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-number font-bold text-destructive">₹{exp.amount}</span>
                {canDelete && <button onClick={() => remove.mutate(exp.id)} className="p-1 text-destructive"><Trash2 size={14} /></button>}
              </div>
            </div>
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
              <input className="input-field" placeholder={lang === 'en' ? 'Sub Category' : 'उप श्रेणी'} value={form.sub_category || ''} onChange={e => setForm({ ...form, sub_category: e.target.value })} />
              <div>
                <label className="text-xs text-muted-foreground">{t('common.amount', lang)}</label>
                <input className="input-field font-number" type="number" inputMode="numeric" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) || 0 })} />
              </div>
              <input className="input-field" placeholder={t('common.notes', lang)} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
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
