import { useState } from 'react';
import AppHeader from '@/components/AppHeader';
import NepaliDatePicker from '@/components/NepaliDatePicker';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';
import { getTodayNepali, nepaliDateToKey, type NepaliDate } from '@/lib/nepaliDate';
import { useProcurement, useProcurementMutations } from '@/hooks/useFarmData';
import { Plus, Trash2, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function ProcurementPage() {
  const { lang } = useApp();
  const { role } = useAuth();
  const today = getTodayNepali();
  const [filterDate, setFilterDate] = useState<NepaliDate>({ year: today.year, month: today.month, day: today.day });
  const yearMonth = `${filterDate.year}-${String(filterDate.month).padStart(2, '0')}`;

  const { data: items = [] } = useProcurement(yearMonth);
  const { add, remove } = useProcurementMutations();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ supplier_name: '', quantity: 0, rate: 0, date: today });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const canEdit = role === 'owner' || role === 'manager';
  const canDelete = role === 'owner';

  const handleSave = () => {
    if (!form.supplier_name.trim() || !form.quantity) return;
    add.mutate({
      supplier_name: form.supplier_name,
      quantity: form.quantity,
      rate: form.rate,
      total: form.quantity * form.rate,
      date_key: nepaliDateToKey(form.date),
    });
    toast({ title: '✅ Added', description: `${form.supplier_name}: ${form.quantity}L` });
    setShowModal(false);
    setForm({ supplier_name: '', quantity: 0, rate: 0, date: today });
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      remove.mutate(deleteConfirm);
      toast({ title: '🗑️ Deleted', description: 'Procurement record removed' });
      setDeleteConfirm(null);
    }
  };

  const totalQty = items.reduce((s, p) => s + Number(p.quantity), 0);
  const totalAmount = items.reduce((s, p) => s + Number(p.total), 0);

  return (
    <div className="pb-20">
      <AppHeader title={t('nav.procurement', lang)} />
      <div className="p-4 space-y-4">
        {canEdit && (
          <button onClick={() => setShowModal(true)} className="action-button w-full flex items-center justify-center gap-2">
            <Plus size={18} /> {t('procurement.addProcurement', lang)}
          </button>
        )}

        <NepaliDatePicker date={filterDate} onChange={setFilterDate} showDay={false} />

        <div className="stat-card flex justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{t('common.total', lang)} {t('procurement.quantity', lang)}</p>
            <p className="font-number font-bold text-lg">{totalQty} Ltrs</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t('common.total', lang)}</p>
            <p className="font-number font-bold text-lg">₹{totalAmount}</p>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">{t('common.noData', lang)}</p>
        ) : (
          items.map(p => (
            <div key={p.id} className="stat-card flex items-center justify-between">
              <div>
                <p className="font-heading font-semibold text-sm">{p.supplier_name}</p>
                <p className="text-[10px] text-muted-foreground">{p.quantity}L × ₹{p.rate} · {p.date_key}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-number font-bold">₹{p.total}</span>
                {canDelete && <button onClick={() => setDeleteConfirm(p.id)} className="p-1 text-destructive"><Trash2 size={14} /></button>}
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Procurement"
        message="Are you sure you want to delete this procurement record?"
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
              <h2 className="font-heading text-lg font-bold">{t('procurement.addProcurement', lang)}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <NepaliDatePicker date={form.date} onChange={d => setForm({ ...form, date: d })} showDay />
              <input className="input-field" placeholder={t('procurement.supplier', lang)} value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} />
              <div>
                <label className="text-xs text-muted-foreground">{t('procurement.quantity', lang)}</label>
                <input className="input-field font-number" type="number" inputMode="decimal" value={form.quantity || ''} onChange={e => setForm({ ...form, quantity: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('procurement.rate', lang)}</label>
                <input className="input-field font-number" type="number" inputMode="numeric" value={form.rate || ''} onChange={e => setForm({ ...form, rate: Number(e.target.value) || 0 })} />
              </div>
              <div className="stat-card text-center">
                <span className="text-xs text-muted-foreground">{t('common.total', lang)}: </span>
                <span className="font-number font-bold text-lg">₹{form.quantity * form.rate}</span>
              </div>
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
