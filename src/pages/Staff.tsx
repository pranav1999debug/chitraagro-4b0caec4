import { useState } from 'react';
import AppHeader from '@/components/AppHeader';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';
import { useStaff, useStaffMutations, type DbStaff } from '@/hooks/useFarmData';
import { Plus, Trash2, Edit, X, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const emptyStaff = { name: '', position: '' as string | null, phone: '' as string | null, email: '' as string | null, salary: 0, advance: 0, join_date: '' as string | null };

export default function StaffPage() {
  const { lang } = useApp();
  const { role } = useAuth();
  const navigate = useNavigate();
  const { data: staffList = [] } = useStaff();
  const { add, update, remove } = useStaffMutations();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyStaff);

  const canEdit = role === 'owner' || role === 'manager';
  const canDelete = role === 'owner';

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editId) {
      update.mutate({ id: editId, ...form });
    } else {
      add.mutate(form);
    }
    setShowModal(false);
    setEditId(null);
    setForm(emptyStaff);
  };

  const handleEdit = (s: DbStaff) => {
    setEditId(s.id);
    setForm({ name: s.name, position: s.position, phone: s.phone, email: s.email, salary: s.salary, advance: s.advance, join_date: s.join_date });
    setShowModal(true);
  };

  return (
    <div className="pb-20">
      <AppHeader title={t('nav.staff', lang)} />
      <div className="p-4 space-y-3">
        {canEdit && (
          <button onClick={() => { setEditId(null); setForm(emptyStaff); setShowModal(true); }} className="action-button w-full flex items-center justify-center gap-2">
            <Plus size={18} /> {t('staff.addStaff', lang)}
          </button>
        )}

        {staffList.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-12">{t('common.noData', lang)}</p>
        ) : (
          staffList.map(s => (
            <div key={s.id} className="stat-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-heading font-bold text-sm flex-shrink-0">
                  {s.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-semibold text-sm">{s.name}</p>
                  <p className="text-[10px] text-muted-foreground">{s.position} · ₹{s.salary}/mo</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => navigate(`/staff/${s.id}/attendance`)} className="p-2 text-primary"><ClipboardList size={16} /></button>
                  {canEdit && <button onClick={() => handleEdit(s)} className="p-2 text-stone"><Edit size={16} /></button>}
                  {canDelete && <button onClick={() => remove.mutate(s.id)} className="p-2 text-destructive"><Trash2 size={16} /></button>}
                </div>
              </div>
              <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                <span>{t('staff.advance', lang)}: <span className="font-number text-destructive">₹{s.advance}</span></span>
                <span>{t('common.phone', lang)}: {s.phone || '-'}</span>
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
              <h2 className="font-heading text-lg font-bold">{t('staff.addStaff', lang)}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-stone" /></button>
            </div>
            <div className="space-y-3">
              <input className="input-field" placeholder={t('common.name', lang)} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input className="input-field" placeholder={t('staff.position', lang)} value={form.position || ''} onChange={e => setForm({ ...form, position: e.target.value })} />
              <input className="input-field" placeholder={t('common.phone', lang)} inputMode="tel" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <input className="input-field" placeholder="Email" type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
              <div>
                <label className="text-xs text-muted-foreground">{t('staff.salary', lang)}</label>
                <input className="input-field font-number" type="number" inputMode="numeric" value={form.salary || ''} onChange={e => setForm({ ...form, salary: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('staff.advance', lang)}</label>
                <input className="input-field font-number" type="number" inputMode="numeric" value={form.advance || ''} onChange={e => setForm({ ...form, advance: Number(e.target.value) || 0 })} />
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
