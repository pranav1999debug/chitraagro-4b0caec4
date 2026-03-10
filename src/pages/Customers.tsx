import { useState } from 'react';
import AppHeader from '@/components/AppHeader';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { customerStore, type Customer } from '@/lib/store';
import { Search, Plus, Trash2, Edit, X } from 'lucide-react';

const emptyCustomer = {
  name: '', phone: '', address: '', purchaseRate: 0, openingBalance: 0,
  timeGroup: 'morning' as const, milkType: 'cow' as const,
};

export default function Customers() {
  const { lang } = useApp();
  const [customers, setCustomers] = useState(customerStore.getAll());
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyCustomer);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const morningCustomers = filtered.filter(c => c.timeGroup === 'morning' || c.timeGroup === 'both');
  const eveningCustomers = filtered.filter(c => c.timeGroup === 'evening' || c.timeGroup === 'both');

  const refresh = () => setCustomers(customerStore.getAll());

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editId) {
      customerStore.update(editId, form);
    } else {
      customerStore.add(form);
    }
    setShowModal(false);
    setEditId(null);
    setForm(emptyCustomer);
    refresh();
  };

  const handleEdit = (c: Customer) => {
    setEditId(c.id);
    setForm({ name: c.name, phone: c.phone, address: c.address, purchaseRate: c.purchaseRate, openingBalance: c.openingBalance, timeGroup: c.timeGroup as 'morning' | 'evening' | 'both', milkType: c.milkType as 'cow' | 'buffalo' | 'mixed' });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    customerStore.delete(id);
    refresh();
  };

  const openAdd = () => {
    setEditId(null);
    setForm(emptyCustomer);
    setShowModal(true);
  };

  return (
    <div className="pb-20">
      <AppHeader title={t('nav.customers', lang)} />
      <div className="p-4 space-y-3">
        {/* Search & Count */}
        <div className="flex items-center gap-2">
          <span className="action-button text-xs py-2 px-4">
            {t('nav.customers', lang)}:{customers.length}
          </span>
          <button onClick={openAdd} className="ml-auto p-2 rounded-full bg-primary text-primary-foreground">
            <Plus size={20} />
          </button>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone" />
          <input
            type="text"
            placeholder={t('common.search', lang) + ' ' + t('nav.customers', lang)}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-9 text-sm"
          />
        </div>

        {customers.length === 0 ? (
          <button onClick={openAdd} className="w-full py-12 text-center text-primary font-heading text-lg font-semibold">
            {t('customer.addFirst', lang)}
          </button>
        ) : (
          <>
            {/* Morning */}
            <p className="text-center text-muted-foreground text-xs font-body">
              {t('common.morning', lang)}: {morningCustomers.length}
            </p>
            {morningCustomers.map(c => (
              <CustomerCard key={c.id} customer={c} lang={lang} onEdit={handleEdit} onDelete={handleDelete} />
            ))}

            {/* Evening */}
            <p className="text-center text-muted-foreground text-xs font-body mt-4">
              {t('common.evening', lang)}: {eveningCustomers.length}
            </p>
            {eveningCustomers.map(c => (
              <CustomerCard key={c.id} customer={c} lang={lang} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </>
        )}
      </div>

      {/* Modal */}
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
              <input className="input-field" placeholder={t('common.phone', lang)} inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <input className="input-field" placeholder={t('common.address', lang)} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              <div>
                <label className="text-xs text-muted-foreground">{t('customer.purchaseRate', lang)}</label>
                <input className="input-field font-number" type="number" inputMode="numeric" value={form.purchaseRate || ''} onChange={e => setForm({ ...form, purchaseRate: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('customer.openingBalance', lang)}</label>
                <input className="input-field font-number" type="number" inputMode="numeric" value={form.openingBalance || ''} onChange={e => setForm({ ...form, openingBalance: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('customer.timeGroup', lang)}</label>
              <select className="input-field text-sm" value={form.timeGroup} onChange={e => setForm({ ...form, timeGroup: e.target.value as typeof form.timeGroup })}>
                  <option value="morning">{t('common.morning', lang)}</option>
                  <option value="evening">{t('common.evening', lang)}</option>
                  <option value="both">{lang === 'en' ? 'Both' : 'दोनों'}</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('customer.milkType', lang)}</label>
              <select className="input-field text-sm" value={form.milkType} onChange={e => setForm({ ...form, milkType: e.target.value as typeof form.milkType })}>
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

function CustomerCard({ customer, lang, onEdit, onDelete }: { customer: Customer; lang: 'en' | 'hi'; onEdit: (c: Customer) => void; onDelete: (id: string) => void }) {
  const initials = customer.name.slice(0, 2).toUpperCase();
  return (
    <div className="stat-card flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-heading font-bold text-sm flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-semibold text-sm truncate">{customer.name}</p>
        <p className="text-[10px] text-muted-foreground">
          {t('transaction.qty', lang)}: {customer.milkType} · ₹{customer.purchaseRate}/L
        </p>
      </div>
      <div className="flex gap-1">
        <button onClick={() => onEdit(customer)} className="p-2 text-stone"><Edit size={16} /></button>
        <button onClick={() => onDelete(customer.id)} className="p-2 text-destructive"><Trash2 size={16} /></button>
      </div>
    </div>
  );
}
