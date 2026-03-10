import { useState } from 'react';
import AppHeader from '@/components/AppHeader';
import NepaliDatePicker from '@/components/NepaliDatePicker';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { getTodayNepali, nepaliDateToKey, type NepaliDate } from '@/lib/nepaliDate';
import { procurementStore, type Procurement } from '@/lib/store';
import { Plus, Trash2, X } from 'lucide-react';

export default function ProcurementPage() {
  const { lang } = useApp();
  const today = getTodayNepali();
  const [filterDate, setFilterDate] = useState<NepaliDate>({ year: today.year, month: today.month, day: today.day });
  const yearMonth = `${filterDate.year}-${String(filterDate.month).padStart(2, '0')}`;

  const [items, setItems] = useState(procurementStore.getByMonth(yearMonth));
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ supplierName: '', quantity: 0, rate: 0, date: today });

  const refresh = () => setItems(procurementStore.getByMonth(yearMonth));

  const handleDateChange = (d: NepaliDate) => {
    setFilterDate(d);
    const ym = `${d.year}-${String(d.month).padStart(2, '0')}`;
    setItems(procurementStore.getByMonth(ym));
  };

  const handleSave = () => {
    if (!form.supplierName.trim() || !form.quantity) return;
    procurementStore.add({
      supplierName: form.supplierName,
      quantity: form.quantity,
      rate: form.rate,
      total: form.quantity * form.rate,
      dateKey: nepaliDateToKey(form.date),
    });
    setShowModal(false);
    setForm({ supplierName: '', quantity: 0, rate: 0, date: today });
    refresh();
  };

  const totalQty = items.reduce((s, p) => s + p.quantity, 0);
  const totalAmount = items.reduce((s, p) => s + p.total, 0);

  return (
    <div className="pb-20">
      <AppHeader title={t('nav.procurement', lang)} />
      <div className="p-4 space-y-4">
        <button onClick={() => setShowModal(true)} className="action-button w-full flex items-center justify-center gap-2">
          <Plus size={18} /> {t('procurement.addProcurement', lang)}
        </button>

        <NepaliDatePicker date={filterDate} onChange={handleDateChange} showDay={false} />

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
                <p className="font-heading font-semibold text-sm">{p.supplierName}</p>
                <p className="text-[10px] text-muted-foreground">{p.quantity}L × ₹{p.rate} · {p.dateKey}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-number font-bold">₹{p.total}</span>
                <button onClick={() => { procurementStore.delete(p.id); refresh(); }} className="p-1 text-destructive">
                  <Trash2 size={14} />
                </button>
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
              <h2 className="font-heading text-lg font-bold">{t('procurement.addProcurement', lang)}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-stone" /></button>
            </div>
            <div className="space-y-3">
              <NepaliDatePicker date={form.date} onChange={d => setForm({ ...form, date: d })} showDay />
              <input className="input-field" placeholder={t('procurement.supplier', lang)} value={form.supplierName} onChange={e => setForm({ ...form, supplierName: e.target.value })} />
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
