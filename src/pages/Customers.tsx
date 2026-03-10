import { useState } from 'react';
import AppHeader from '@/components/AppHeader';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';
import { useCustomers, useCustomerMutations, type DbCustomer } from '@/hooks/useFarmData';
import { Search, Plus, Trash2, Edit, X } from 'lucide-react';

const emptyForm = {
  name: '', phone: '' as string | null, address: '' as string | null, purchase_rate: 0, opening_balance: 0,
  time_group: 'morning', milk_type: 'cow',
};

export default function Customers() {
  const { lang } = useApp();
  const { role } = useAuth();
  const { data: customers = [], isLoading } = useCustomers();
  const { add, update, remove } = useCustomerMutations();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const canEdit = role === 'owner' || role === 'manager';
  const canDelete = role === 'owner';

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  );

  const morningCustomers = filtered.filter(c => c.time_group === 'morning' || c.time_group === 'both');
  const eveningCustomers = filtered.filter(c => c.time_group === 'evening' || c.time_group === 'both');

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editId) {
      update.mutate({ id: editId, ...form });
    } else {
      add.mutate(form);
    }
    setShowModal(false);
    setEditId(null);
    setForm(emptyForm);
  };

  const handleEdit = (c: DbCustomer) => {
    setEditId(c.id);
    setForm({ name: c.name, phone: c.phone, address: c.address, purchase_rate: c.purchase_rate, opening_balance: c.opening_balance, time_group: c.time_group, milk_type: c.milk_type });
    setShowModal(true);
  };

  const handleDelete = (id: string) => remove.mutate(id);

  const openAdd = () => { setEditId(null); setForm(emptyForm); setShowModal(true); };

  if (isLoading) return <div className="pb-20"><AppHeader title={t('nav.customers', lang)} /><div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div></div>;

  return (
    <div className="pb-20">
      <AppHeader title={t('nav.customers', lang)} />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="action-button text-xs py-2 px-4">{t('nav.customers', lang)}:{customers.length}</span>
          {canEdit && <button onClick={openAdd} className="ml-auto p-2 rounded-full bg-primary text-primary-foreground"><Plus size={20} /></button>}
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone" />
          <input type="text" placeholder={t('common.search', lang) + ' ' + t('nav.customers', lang)} value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9 text-sm" />
        </div>

        {customers.length === 0 ? (
          canEdit ? <button onClick={openAdd} className="w-full py-12 text-center text-primary font-heading text-lg font-semibold">{t('customer.addFirst', lang)}</button>
          : <p className="text-center text-muted-foreground text-sm py-12">{t('common.noData', lang)}</p>
        ) : (
          <>
            <p className="text-center text-muted-foreground text-xs font-body">{t('common.morning', lang)}: {morningCustomers.length}</p>
            {morningCustomers.map(c => (
              <CustomerCard key={c.id} customer={c} lang={lang} onEdit={canEdit ? handleEdit : undefined} onDelete={canDelete ? handleDelete : undefined} />
            ))}
            <p className="text-center text-muted-foreground text-xs font-body mt-4">{t('common.evening', lang)}: {eveningCustomers.length}</p>
            {eveningCustomers.map(c => (
              <CustomerCard key={c.id} customer={c} lang={lang} onEdit={canEdit ? handleEdit : undefined} onDelete={canDelete ? handleDelete : undefined} />
            ))}
          </>
        )}
      </div>

      {showModal && (
        <>
          <div className="modal-overlay" onClick={() => setShowModal(false)} />
          <div className="modal-content">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-heading text-lg font-bold">{t('customer.details', lang)}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-stone" /></button>
            </div>
            <div className="space-y-3">
              <input className="input-field" placeholder={t('common.name', lang)} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input className="input-field" placeholder={t('common.phone', lang)} inputMode="tel" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <input className="input-field" placeholder={t('common.address', lang)} value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} />
              <div>
                <label className="text-xs text-muted-foreground">{t('customer.purchaseRate', lang)}</label>
                <input className="input-field font-number" type="number" inputMode="numeric" value={form.purchase_rate || ''} onChange={e => setForm({ ...form, purchase_rate: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('customer.openingBalance', lang)}</label>
                <input className="input-field font-number" type="number" inputMode="numeric" value={form.opening_balance || ''} onChange={e => setForm({ ...form, opening_balance: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('customer.timeGroup', lang)}</label>
                <select className="input-field text-sm" value={form.time_group} onChange={e => setForm({ ...form, time_group: e.target.value })}>
                  <option value="morning">{t('common.morning', lang)}</option>
                  <option value="evening">{t('common.evening', lang)}</option>
                  <option value="both">{lang === 'en' ? 'Both' : 'दोनों'}</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('customer.milkType', lang)}</label>
                <select className="input-field text-sm" value={form.milk_type} onChange={e => setForm({ ...form, milk_type: e.target.value })}>
                  <option value="cow">{t('customer.cow', lang)}</option>
                  <option value="buffalo">{t('customer.buffalo', lang)}</option>
                  <option value="mixed">{t('customer.mixed', lang)}</option>
                </select>
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

function CustomerCard({ customer, lang, onEdit, onDelete }: { customer: DbCustomer; lang: 'en' | 'hi'; onEdit?: (c: DbCustomer) => void; onDelete?: (id: string) => void }) {
  const initials = customer.name.slice(0, 2).toUpperCase();
  return (
    <div className="stat-card flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-heading font-bold text-sm flex-shrink-0">{initials}</div>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-semibold text-sm truncate">{customer.name}</p>
        <p className="text-[10px] text-muted-foreground">{t('transaction.qty', lang)}: {customer.milk_type} · ₹{customer.purchase_rate}/L</p>
      </div>
      <div className="flex gap-1">
        {onEdit && <button onClick={() => onEdit(customer)} className="p-2 text-stone"><Edit size={16} /></button>}
        {onDelete && <button onClick={() => onDelete(customer.id)} className="p-2 text-destructive"><Trash2 size={16} /></button>}
      </div>
    </div>
  );
}
