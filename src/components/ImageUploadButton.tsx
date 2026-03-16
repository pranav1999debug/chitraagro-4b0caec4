import { useState, useRef, useCallback } from 'react';
import { Camera, Loader2, X, Check, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { DbCustomer } from '@/hooks/useFarmData';

interface ParsedEntry {
  name: string;
  name_english?: string;
  quantity: number;
  confidence?: 'high' | 'medium' | 'low';
  matched_customer_id?: string;
  matched_customer_name?: string;
}

interface Props {
  customers: DbCustomer[];
  onApply: (entries: Array<{ customer_id: string; customer_name: string; quantity: number; price: number }>) => void;
}

export default function ImageUploadButton({ customers, onApply }: Props) {
  const [parsing, setParsing] = useState(false);
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const matchCustomer = useCallback((name: string, nameEn?: string): { id: string; name: string } | null => {
    const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
    const n1 = normalize(name);
    const n2 = nameEn ? normalize(nameEn) : '';

    // Exact match
    for (const c of customers) {
      const cn = normalize(c.name);
      if (cn === n1 || (n2 && cn === n2)) return { id: c.id, name: c.name };
    }
    // Partial/includes match
    for (const c of customers) {
      const cn = normalize(c.name);
      if (cn.includes(n1) || n1.includes(cn) || (n2 && (cn.includes(n2) || n2.includes(cn)))) {
        return { id: c.id, name: c.name };
      }
    }
    return null;
  }, [customers]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // strip data:...;base64,
        };
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke('parse-dairy-image', {
        body: {
          image_base64: base64,
          customer_names: customers.map(c => c.name),
        },
      });

      if (error) throw error;

      const parsed: ParsedEntry[] = (data?.entries || []).map((e: any) => {
        const match = matchCustomer(e.name, e.name_english);
        return {
          ...e,
          matched_customer_id: match?.id,
          matched_customer_name: match?.name,
        };
      });

      setEntries(parsed);
      setShowPopup(true);

      if (parsed.length === 0) {
        toast({ title: '⚠️ No entries found', description: 'Could not read any customer data from the image', variant: 'destructive' });
      }
    } catch (err: any) {
      console.error('Image parse error:', err);
      toast({ title: '❌ Failed to parse image', description: err.message || 'Please try again', variant: 'destructive' });
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleEntryChange = (index: number, field: 'quantity' | 'matched_customer_id', value: any) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== index) return e;
      if (field === 'matched_customer_id') {
        const c = customers.find(c => c.id === value);
        return { ...e, matched_customer_id: value, matched_customer_name: c?.name };
      }
      return { ...e, [field]: parseFloat(value) || 0 };
    }));
  };

  const handleApply = () => {
    const validEntries = entries
      .filter(e => e.matched_customer_id && e.quantity > 0)
      .map(e => {
        const customer = customers.find(c => c.id === e.matched_customer_id);
        return {
          customer_id: e.matched_customer_id!,
          customer_name: e.matched_customer_name || e.name,
          quantity: e.quantity,
          price: customer?.purchase_rate || 0,
        };
      });

    if (validEntries.length === 0) {
      toast({ title: '⚠️ No valid entries', description: 'Match customers before saving', variant: 'destructive' });
      return;
    }

    onApply(validEntries);
    setShowPopup(false);
    setEntries([]);
    toast({ title: '✅ Applied', description: `${validEntries.length} entries filled from image` });
  };

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      
      <button
        onClick={() => fileRef.current?.click()}
        disabled={parsing}
        className={`p-3 rounded-full shadow-lg transition-all ${
          parsing
            ? 'bg-primary/70 text-primary-foreground'
            : 'bg-primary text-primary-foreground'
        } disabled:opacity-50`}
        title="Scan Dairy Page"
      >
        {parsing ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
      </button>

      {showPopup && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
          <div className="bg-card w-full max-w-lg max-h-[85vh] rounded-t-2xl sm:rounded-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-heading font-bold text-base">📋 Extracted Entries ({entries.length})</h3>
              <button onClick={() => { setShowPopup(false); setEntries([]); }} className="p-1">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-3 space-y-2">
              {entries.map((entry, i) => (
                <div key={i} className={`p-3 rounded-lg border ${entry.matched_customer_id ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5'}`}>
                  <div className="flex items-start gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-heading text-sm font-semibold truncate">{entry.name}</p>
                      {entry.name_english && entry.name_english !== entry.name && (
                        <p className="text-xs text-muted-foreground">{entry.name_english}</p>
                      )}
                    </div>
                    {entry.confidence && entry.confidence !== 'high' && (
                      <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    )}
                  </div>

                  <div className="flex gap-2 items-center">
                    <select
                      value={entry.matched_customer_id || ''}
                      onChange={e => handleEntryChange(i, 'matched_customer_id', e.target.value)}
                      className="flex-1 text-xs rounded border border-border py-1.5 px-2 bg-card font-body"
                    >
                      <option value="">-- Match Customer --</option>
                      {customers.filter(c => c.is_active !== false).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={entry.quantity}
                      onChange={e => handleEntryChange(i, 'quantity', e.target.value)}
                      className="w-16 text-center rounded border border-border py-1.5 font-number text-sm bg-card"
                    />
                    <span className="text-xs text-muted-foreground">Ltr</span>
                  </div>
                </div>
              ))}

              {entries.length === 0 && (
                <p className="text-center text-muted-foreground py-8 text-sm">No entries found in image</p>
              )}
            </div>

            <div className="p-4 border-t border-border flex gap-2">
              <button onClick={() => { setShowPopup(false); setEntries([]); }} className="flex-1 py-2.5 rounded-lg border border-border font-heading text-sm">
                Cancel
              </button>
              <button onClick={handleApply} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-heading text-sm font-semibold flex items-center justify-center gap-1.5">
                <Check size={16} /> Save & Fill
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
