import { useState, useMemo } from 'react';
import AppHeader from '@/components/AppHeader';
import NepaliDatePicker from '@/components/NepaliDatePicker';
import ConfirmDialog from '@/components/ConfirmDialog';
import VoiceExpenseButton from '@/components/VoiceExpenseButton';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';
import { getTodayNepali, nepaliDateToKey, type NepaliDate } from '@/lib/nepaliDate';
import { useExpenses, useExpenseMutations, type DbExpense } from '@/hooks/useFarmData';
import { Plus, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const canEdit = role === 'owner' || role === 'manager';
  const canDelete = role === 'owner';
  const todayDateKey = nepaliDateToKey(today);

  const handleSave = () => {
    if (!form.amount) return;
    add.mutate({
      category: form.category,
      sub_category: form.sub_category,
      amount: form.amount,
      notes: form.notes,
      date_key: nepaliDateToKey(form.date),
    });
    toast({ title: '✅ Added', description: `₹${form.amount} expense recorded` });
    setShowModal(false);
    setForm({ category: CATEGORIES[0], sub_category: '', amount: 0, notes: '', date: today });
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      remove.mutate(deleteConfirm);
      toast({ title: '🗑️ Deleted', description: 'Expense removed' });
      setDeleteConfirm(null);
    }
  };

  // Group expenses by category
  const grouped = useMemo(() => {
    const map: Record<string, DbExpense[]> = {};
    expenses.forEach(e => {
      if (!map[e.category]) map[e.category] = [];
      map[e.category].push(e);
    });
    return map;
  }, [expenses]);

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Voice command handler
  const handleVoiceApply = (entries: Array<{ category: string; sub_category?: string; amount: number; notes?: string; date_key: string }>) => {
    entries.forEach(e => {
      add.mutate({
        category: e.category,
        sub_category: e.sub_category || null,
        amount: e.amount,
        notes: e.notes || null,
        date_key: e.date_key,
      });
    });
  };

  return (
    <div className="pb-20">
      <AppHeader title={t('nav.expenses', lang)} />
      <div className="p-4 space-y-4">
        <div className="flex gap-2">
          {canEdit && (
            <button onClick={() => setShowModal(true)} className="action-button flex-1 flex items-center justify-center gap-2">
              <Plus size={18} /> {t('expense.addExpense', lang)}
            </button>
          )}
          {canEdit && (
            <VoiceExpenseButton
              categories={CATEGORIES}
              todayDateKey={todayDateKey}
              onApply={handleVoiceApply}
            />
          )}
        </div>

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
          Object.entries(grouped).map(([category, items]) => {
            const catTotal = items.reduce((s, e) => s + Number(e.amount), 0);
            const isExpanded = expandedCategories[category] !== false; // default expanded
            return (
              <div key={category} className="stat-card overflow-hidden">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between py-1"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                    <span className="font-heading font-semibold text-sm">{category}</span>
                    <span className="text-xs text-muted-foreground">({items.length})</span>
                  </div>
                  <span className="font-number font-bold text-destructive">₹{catTotal}</span>
                </button>
                {isExpanded && (
                  <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                    {items.map(exp => (
                      <div key={exp.id} className="flex items-center justify-between py-1">
                        <div>
                          {exp.sub_category && <p className="text-xs font-body">{exp.sub_category}</p>}
                          {exp.notes && <p className="text-[10px] text-muted-foreground">{exp.notes}</p>}
                          <p className="text-[10px] text-muted-foreground">{exp.date_key}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-number font-bold text-sm text-destructive">₹{exp.amount}</span>
                          {canDelete && <button onClick={() => setDeleteConfirm(exp.id)} className="p-1 text-destructive"><Trash2 size={14} /></button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Expense"
        message="Are you sure you want to delete this expense record?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      {showModal && (
        <>
          <div className="modal-overlay" onClick={() => setShowModal(false)} />
          <div className="modal-content">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-heading text-lg font-bold">{t('expense.details', lang)}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-muted-foreground" /></button>
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
