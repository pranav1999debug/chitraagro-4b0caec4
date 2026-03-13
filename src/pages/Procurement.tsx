import { useState, useMemo } from 'react';
import AppHeader from '@/components/AppHeader';
import NepaliDatePicker from '@/components/NepaliDatePicker';
import ConfirmDialog from '@/components/ConfirmDialog';
import VoiceProcurementButton from '@/components/VoiceProcurementButton';
import type { ProcurementEntry } from '@/components/VoiceProcurementButton';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';
import { getTodayNepali, nepaliDateToKey, type NepaliDate } from '@/lib/nepaliDate';
import { useProcurement, useProcurementMutations, useSuppliers, useSupplierMutations, type DbSupplier } from '@/hooks/useFarmData';
import { Plus, Trash2, X, ChevronDown, ChevronRight, Users, Edit2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function ProcurementPage() {
  const { lang } = useApp();
  const { role } = useAuth();
  const today = getTodayNepali();
  const [filterDate, setFilterDate] = useState<NepaliDate>({ year: today.year, month: today.month, day: today.day });
  const yearMonth = `${filterDate.year}-${String(filterDate.month).padStart(2, '0')}`;
  const todayDateKey = nepaliDateToKey(today);

  const { data: items = [] } = useProcurement(yearMonth);
  const { data: suppliers = [] } = useSuppliers();
  const { add, remove } = useProcurementMutations();
  const supplierMutations = useSupplierMutations();
  
  const [showModal, setShowModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<DbSupplier | null>(null);
  const [form, setForm] = useState({ supplier_name: '', supplier_id: '' as string | null, quantity: 0, rate: 0, date: today });
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', default_qty: 0, default_rate: 0 });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteSupplierConfirm, setDeleteSupplierConfirm] = useState<string | null>(null);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({});
  const [showSupplierList, setShowSupplierList] = useState(false);

  const canEdit = role === 'owner' || role === 'manager';
  const canDelete = role === 'owner';

  const handleSave = () => {
    if (!form.supplier_name.trim() || !form.quantity) return;
    add.mutate({
      supplier_name: form.supplier_name,
      supplier_id: form.supplier_id || null,
      quantity: form.quantity,
      rate: form.rate,
      total: form.quantity * form.rate,
      date_key: nepaliDateToKey(form.date),
    });
    toast({ title: '✅ Added', description: `${form.supplier_name}: ${form.quantity}L` });
    setShowModal(false);
    setForm({ supplier_name: '', supplier_id: null, quantity: 0, rate: 0, date: today });
  };

  const handleSaveSupplier = () => {
    if (!supplierForm.name.trim()) return;
    if (editingSupplier) {
      supplierMutations.update.mutate({ id: editingSupplier.id, ...supplierForm, is_active: true });
      toast({ title: '✅ Updated', description: `Supplier ${supplierForm.name} updated` });
    } else {
      supplierMutations.add.mutate({ ...supplierForm, is_active: true });
      toast({ title: '✅ Added', description: `Supplier ${supplierForm.name} added` });
    }
    setShowSupplierModal(false);
    setEditingSupplier(null);
    setSupplierForm({ name: '', phone: '', default_qty: 0, default_rate: 0 });
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      remove.mutate(deleteConfirm);
      toast({ title: '🗑️ Deleted', description: 'Procurement record removed' });
      setDeleteConfirm(null);
    }
  };

  const confirmDeleteSupplier = () => {
    if (deleteSupplierConfirm) {
      supplierMutations.remove.mutate(deleteSupplierConfirm);
      toast({ title: '🗑️ Deleted', description: 'Supplier removed' });
      setDeleteSupplierConfirm(null);
    }
  };

  const openAddWithSupplier = (supplier: DbSupplier) => {
    setForm({
      supplier_name: supplier.name,
      supplier_id: supplier.id,
      quantity: supplier.default_qty,
      rate: supplier.default_rate,
      date: today,
    });
    setShowModal(true);
  };

  const openEditSupplier = (supplier: DbSupplier) => {
    setEditingSupplier(supplier);
    setSupplierForm({ name: supplier.name, phone: supplier.phone || '', default_qty: supplier.default_qty, default_rate: supplier.default_rate });
    setShowSupplierModal(true);
  };

  // Group procurement by supplier
  const grouped = useMemo(() => {
    const map: Record<string, typeof items> = {};
    items.forEach(p => {
      const key = p.supplier_name;
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }, [items]);

  const totalQty = items.reduce((s, p) => s + Number(p.quantity), 0);
  const totalAmount = items.reduce((s, p) => s + Number(p.total), 0);

  const toggleSupplier = (name: string) => {
    setExpandedSuppliers(prev => ({ ...prev, [name]: !prev[name] }));
  };

  // Voice command handler
  const handleVoiceApply = (entries: ProcurementEntry[]) => {
    entries.forEach(e => {
      add.mutate({
        supplier_name: e.supplier_name,
        supplier_id: e.supplier_id || null,
        quantity: e.quantity,
        rate: e.rate,
        total: e.total,
        date_key: e.date_key,
      });
    });
  };

  return (
    <div className="pb-20">
      <AppHeader title={t('nav.procurement', lang)} />
      <div className="p-4 space-y-4">
        <div className="flex gap-2">
          {canEdit && (
            <button onClick={() => setShowModal(true)} className="action-button flex-1 flex items-center justify-center gap-2">
              <Plus size={18} /> {t('procurement.addProcurement', lang)}
            </button>
          )}
          {canEdit && (
            <VoiceProcurementButton
              suppliers={suppliers}
              todayDateKey={todayDateKey}
              onApply={handleVoiceApply}
            />
          )}
        </div>

        {/* Supplier Management */}
        <div className="stat-card">
          <button onClick={() => setShowSupplierList(!showSupplierList)} className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-primary" />
              <span className="font-heading text-sm font-semibold">{lang === 'en' ? 'Suppliers' : 'आपूर्तिकर्ता'} ({suppliers.length})</span>
            </div>
            {showSupplierList ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {showSupplierList && (
            <div className="mt-3 space-y-2 border-t border-border/50 pt-2">
              {canEdit && (
                <button onClick={() => { setEditingSupplier(null); setSupplierForm({ name: '', phone: '', default_qty: 0, default_rate: 0 }); setShowSupplierModal(true); }}
                  className="w-full text-xs py-2 rounded-lg border border-dashed border-primary/50 text-primary font-heading flex items-center justify-center gap-1">
                  <Plus size={14} /> {lang === 'en' ? 'Add Supplier' : 'आपूर्तिकर्ता जोड़ें'}
                </button>
              )}
              {suppliers.map(s => (
                <div key={s.id} className="flex items-center justify-between py-1 border-b border-border/30">
                  <div>
                    <p className="font-body text-sm font-semibold">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {s.phone && `📞 ${s.phone} · `}
                      Default: {s.default_qty}L @ ₹{s.default_rate}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <>
                        <button onClick={() => openAddWithSupplier(s)} className="p-1 text-primary" title="Quick Add"><Plus size={14} /></button>
                        <button onClick={() => openEditSupplier(s)} className="p-1 text-muted-foreground" title="Edit"><Edit2 size={14} /></button>
                      </>
                    )}
                    {canDelete && <button onClick={() => setDeleteSupplierConfirm(s.id)} className="p-1 text-destructive" title="Delete"><Trash2 size={14} /></button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
          Object.entries(grouped).map(([supplierName, records]) => {
            const supTotal = records.reduce((s, p) => s + Number(p.total), 0);
            const supQty = records.reduce((s, p) => s + Number(p.quantity), 0);
            const isExpanded = expandedSuppliers[supplierName] !== false;
            return (
              <div key={supplierName} className="stat-card overflow-hidden">
                <button onClick={() => toggleSupplier(supplierName)} className="w-full flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                    <span className="font-heading font-semibold text-sm">{supplierName}</span>
                    <span className="text-xs text-muted-foreground">({records.length}) · {supQty}L</span>
                  </div>
                  <span className="font-number font-bold">₹{supTotal}</span>
                </button>
                {isExpanded && (
                  <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                    {records.map(p => (
                      <div key={p.id} className="flex items-center justify-between py-1">
                        <p className="text-[10px] text-muted-foreground">{p.quantity}L × ₹{p.rate} · {p.date_key}</p>
                        <div className="flex items-center gap-2">
                          <span className="font-number font-bold text-sm">₹{p.total}</span>
                          {canDelete && <button onClick={() => setDeleteConfirm(p.id)} className="p-1 text-destructive"><Trash2 size={14} /></button>}
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

      <ConfirmDialog open={!!deleteConfirm} title="Delete Procurement" message="Are you sure?" confirmLabel="Delete" variant="danger" onConfirm={confirmDelete} onCancel={() => setDeleteConfirm(null)} />
      <ConfirmDialog open={!!deleteSupplierConfirm} title="Delete Supplier" message="Are you sure you want to delete this supplier?" confirmLabel="Delete" variant="danger" onConfirm={confirmDeleteSupplier} onCancel={() => setDeleteSupplierConfirm(null)} />

      {/* Add Procurement Modal */}
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
              {/* Supplier selector */}
              <div>
                <label className="text-xs text-muted-foreground">{t('procurement.supplier', lang)}</label>
                <select className="input-field text-sm" value={form.supplier_id || ''} onChange={e => {
                  const s = suppliers.find(s => s.id === e.target.value);
                  if (s) {
                    setForm({ ...form, supplier_name: s.name, supplier_id: s.id, quantity: s.default_qty, rate: s.default_rate });
                  } else {
                    setForm({ ...form, supplier_id: null });
                  }
                }}>
                  <option value="">{lang === 'en' ? '-- Select or type below --' : '-- चुनें या नीचे लिखें --'}</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input className="input-field mt-1" placeholder={t('procurement.supplier', lang)} value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value, supplier_id: null })} />
              </div>
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

      {/* Supplier Modal */}
      {showSupplierModal && (
        <>
          <div className="modal-overlay" onClick={() => setShowSupplierModal(false)} />
          <div className="modal-content">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-heading text-lg font-bold">{editingSupplier ? (lang === 'en' ? 'Edit Supplier' : 'आपूर्तिकर्ता संपादित करें') : (lang === 'en' ? 'Add Supplier' : 'आपूर्तिकर्ता जोड़ें')}</h2>
              <button onClick={() => setShowSupplierModal(false)}><X size={20} className="text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <input className="input-field" placeholder={t('common.name', lang)} value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} />
              <input className="input-field" placeholder={t('common.phone', lang)} value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
              <div>
                <label className="text-xs text-muted-foreground">{lang === 'en' ? 'Default Qty (L)' : 'डिफ़ॉल्ट मात्रा (L)'}</label>
                <input className="input-field font-number" type="number" inputMode="decimal" value={supplierForm.default_qty || ''} onChange={e => setSupplierForm({ ...supplierForm, default_qty: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{lang === 'en' ? 'Default Rate (₹/L)' : 'डिफ़ॉल्ट दर (₹/L)'}</label>
                <input className="input-field font-number" type="number" inputMode="numeric" value={supplierForm.default_rate || ''} onChange={e => setSupplierForm({ ...supplierForm, default_rate: Number(e.target.value) || 0 })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveSupplier} className="action-button flex-1">{t('common.save', lang)}</button>
                <button onClick={() => setShowSupplierModal(false)} className="flex-1 rounded-lg border border-border py-3 text-muted-foreground font-heading">{t('common.cancel', lang)}</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
