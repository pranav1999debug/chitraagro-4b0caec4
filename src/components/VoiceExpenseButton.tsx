import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ExpenseEntry {
  category: string;
  sub_category?: string;
  amount: number;
  notes?: string;
  date_key: string;
}

interface VoiceExpenseButtonProps {
  categories: string[];
  todayDateKey: string;
  onApply: (entries: ExpenseEntry[]) => void;
}

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export default function VoiceExpenseButton({ categories, todayDateKey, onApply }: VoiceExpenseButtonProps) {
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<{ entries: ExpenseEntry[]; summary: string } | null>(null);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      toast({ title: '❌ Not Supported', description: 'Voice input is not supported. Try Chrome.' });
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN';
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalTranscript = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + ' ';
        else interim += event.results[i][0].transcript;
      }
      setTranscript(finalTranscript + interim);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech error:', event.error);
      setListening(false);
      if (event.error === 'not-allowed') toast({ title: '🎤 Microphone Blocked', description: 'Allow microphone access.' });
    };

    recognition.onend = () => {
      setListening(false);
      if (finalTranscript.trim()) processTranscript(finalTranscript.trim());
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setTranscript('');
    setResult(null);
  }, [categories, todayDateKey]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const processTranscript = async (text: string) => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('voice-parse-expense', {
        body: { transcript: text, categories, todayDateKey },
      });
      if (error) throw error;
      if (data?.error) { toast({ title: '❌ Error', description: data.error }); return; }
      setResult(data);
    } catch (e) {
      console.error('Voice parse error:', e);
      toast({ title: '❌ Failed', description: 'Could not process voice command.' });
    } finally {
      setProcessing(false);
    }
  };

  const handleApply = () => {
    if (result?.entries) {
      onApply(result.entries);
      setResult(null);
      setTranscript('');
      toast({ title: '✅ Applied', description: result.summary });
    }
  };

  const handleCancel = () => { setResult(null); setTranscript(''); };

  if (result) {
    return (
      <div className="stat-card space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-heading text-sm font-semibold">🎤 Voice Expense Result</h3>
          <button onClick={handleCancel} className="p-1 text-muted-foreground"><X size={18} /></button>
        </div>
        <p className="text-xs text-muted-foreground">{result.summary}</p>
        <div className="space-y-1 max-h-48 overflow-auto">
          {result.entries.map((e, i) => (
            <div key={i} className="flex justify-between items-center text-sm py-1 border-b border-border/50">
              <div>
                <span className="font-body font-semibold">{e.category}</span>
                {e.sub_category && <span className="text-muted-foreground"> · {e.sub_category}</span>}
                {e.notes && <p className="text-[10px] text-muted-foreground">{e.notes}</p>}
              </div>
              <div className="text-right">
                <span className="font-number font-bold">₹{e.amount}</span>
                <p className="text-[10px] text-muted-foreground">{e.date_key}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={handleCancel} className="flex-1 py-2 rounded-lg border border-border text-sm font-heading">Cancel</button>
          <button onClick={handleApply} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-heading font-semibold">
            Apply ({result.entries.length})
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {transcript && (
        <div className="stat-card flex-1">
          <p className="text-xs text-muted-foreground mb-1">🎤 Listening...</p>
          <p className="text-sm font-body">{transcript}</p>
        </div>
      )}
      {processing && (
        <div className="flex items-center gap-2">
          <Loader2 size={16} className="animate-spin text-primary" />
          <span className="text-sm font-body">Processing...</span>
        </div>
      )}
      <button
        onClick={listening ? stopListening : startListening}
        disabled={processing}
        className={`p-3 rounded-full shadow-lg transition-all ${
          listening ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-primary text-primary-foreground'
        } disabled:opacity-50`}
        title={listening ? 'Stop' : 'Voice Expense'}
      >
        {processing ? <Loader2 size={20} className="animate-spin" /> : listening ? <MicOff size={20} /> : <Mic size={20} />}
      </button>
    </div>
  );
}
