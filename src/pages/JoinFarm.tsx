import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Milk, CheckCircle, XCircle } from 'lucide-react';

export default function JoinFarm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const inviteCode = searchParams.get('code');

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'no-code'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!inviteCode) {
      setStatus('no-code');
      setMessage('No invite code provided');
      return;
    }
    if (!user) {
      setStatus('loading');
      setMessage('Please sign in first...');
      return;
    }

    const joinFarm = async () => {
      setStatus('loading');
      setMessage('Joining farm...');

      const { data, error } = await supabase.rpc('join_farm_by_invite', {
        _invite_code: inviteCode,
      });

      if (error) {
        setStatus('error');
        setMessage(error.message);
        return;
      }

      const result = data as { success?: boolean; error?: string; farm_id?: string };
      if (result.error) {
        if (result.error === 'Already a member') {
          setStatus('success');
          setMessage('You are already a member of this farm!');
        } else {
          setStatus('error');
          setMessage(result.error);
        }
      } else {
        setStatus('success');
        setMessage('Successfully joined the farm!');
        await refreshProfile();
      }
    };

    joinFarm();
  }, [inviteCode, user]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <Milk size={32} className="text-primary" />
        </div>

        {status === 'loading' && (
          <div className="space-y-2">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground font-body text-sm">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <CheckCircle size={48} className="text-primary mx-auto" />
            <p className="font-heading text-lg font-bold text-foreground">{message}</p>
            <button onClick={() => navigate('/')} className="action-button w-full">
              Go to Dashboard
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <XCircle size={48} className="text-destructive mx-auto" />
            <p className="font-heading text-lg font-bold text-foreground">{message}</p>
            <button onClick={() => navigate('/')} className="action-button w-full">
              Go to Dashboard
            </button>
          </div>
        )}

        {status === 'no-code' && (
          <div className="space-y-4">
            <p className="font-heading text-lg font-bold text-foreground">Invalid Invite Link</p>
            <button onClick={() => navigate('/')} className="action-button w-full">
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
