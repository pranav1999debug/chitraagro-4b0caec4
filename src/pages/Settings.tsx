import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';
import { supabase } from '@/integrations/supabase/client';
import { Copy, LogOut, Plus, Trash2, Users, Link2, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Invite {
  id: string;
  invite_code: string;
  role: string;
  used_count: number;
  max_uses: number | null;
  created_at: string;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  profiles?: { display_name: string | null; avatar_url: string | null } | null;
}

export default function Settings() {
  const { lang } = useApp();
  const { user, profile, farmId, farmName, role, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [invites, setInvites] = useState<Invite[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [editFarmName, setEditFarmName] = useState(farmName || '');
  const [inviteRole, setInviteRole] = useState<'manager' | 'staff'>('staff');
  const [copied, setCopied] = useState<string | null>(null);

  const isOwner = role === 'owner';

  const loadData = async () => {
    if (!farmId) return;

    const { data: inv } = await supabase
      .from('farm_invites')
      .select('*')
      .eq('farm_id', farmId)
      .order('created_at', { ascending: false });
    setInvites((inv || []) as Invite[]);

    const { data: mem } = await supabase
      .from('farm_members')
      .select('id, user_id, role')
      .eq('farm_id', farmId);
    
    // Fetch profiles separately
    if (mem && mem.length > 0) {
      const userIds = mem.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);
      
      const membersWithProfiles = mem.map(m => ({
        ...m,
        profiles: profiles?.find(p => p.user_id === m.user_id) || null,
      }));
      setMembers(membersWithProfiles as Member[]);
    } else {
      setMembers([]);
    }
  };

  useEffect(() => { loadData(); }, [farmId]);

  const handleUpdateFarmName = async () => {
    if (!farmId || !editFarmName.trim()) return;
    await supabase.from('farms').update({ name: editFarmName.trim() }).eq('id', farmId);
    await refreshProfile();
    toast.success(lang === 'en' ? 'Farm name updated' : 'फार्म का नाम अपडेट किया');
  };

  const handleCreateInvite = async () => {
    if (!farmId || !user) return;
    const { error } = await supabase.from('farm_invites').insert({
      farm_id: farmId,
      role: inviteRole,
      created_by: user.id,
      max_uses: 10,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(lang === 'en' ? 'Invite created' : 'आमंत्रण बनाया');
    loadData();
  };

  const handleDeleteInvite = async (id: string) => {
    await supabase.from('farm_invites').delete().eq('id', id);
    loadData();
  };

  const handleRemoveMember = async (memberId: string) => {
    await supabase.from('farm_members').delete().eq('id', memberId);
    loadData();
  };

  const copyInviteLink = (code: string) => {
    const link = `${window.location.origin}/join?code=${code}`;
    navigator.clipboard.writeText(link);
    setCopied(code);
    toast.success(lang === 'en' ? 'Link copied!' : 'लिंक कॉपी हुआ!');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="pb-20">
      <AppHeader title={lang === 'en' ? 'Settings' : 'सेटिंग्स'} />
      <div className="p-4 space-y-4">
        {/* Profile */}
        <div className="stat-card space-y-2">
          <h3 className="font-heading text-sm font-semibold">{lang === 'en' ? 'Profile' : 'प्रोफ़ाइल'}</h3>
          <div className="flex items-center gap-3">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} className="w-10 h-10 rounded-full" alt="" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-heading font-bold text-sm">
                {profile?.display_name?.slice(0, 2).toUpperCase() || 'U'}
              </div>
            )}
            <div>
              <p className="font-heading font-semibold text-sm">{profile?.display_name || 'User'}</p>
              <p className="text-[10px] text-muted-foreground">{user?.email}</p>
              <p className="text-[10px] text-primary font-semibold capitalize">{role}</p>
            </div>
          </div>
        </div>

        {/* Farm Name */}
        <div className="stat-card space-y-2">
          <h3 className="font-heading text-sm font-semibold">{lang === 'en' ? 'Farm Name' : 'फार्म का नाम'}</h3>
          <div className="flex gap-2">
            <input
              className="input-field text-sm flex-1"
              value={editFarmName}
              onChange={e => setEditFarmName(e.target.value)}
              disabled={!isOwner}
            />
            {isOwner && (
              <button onClick={handleUpdateFarmName} className="action-button text-sm px-4">
                {t('common.save', lang)}
              </button>
            )}
          </div>
        </div>

        {/* Team Members */}
        <div className="stat-card space-y-3">
          <h3 className="font-heading text-sm font-semibold flex items-center gap-2">
            <Users size={16} /> {lang === 'en' ? 'Team Members' : 'टीम सदस्य'} ({members.length})
          </h3>
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 py-1">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-heading font-bold text-xs">
                {m.profiles?.display_name?.slice(0, 2).toUpperCase() || '??'}
              </div>
              <div className="flex-1">
                <p className="font-heading text-sm font-semibold">{m.profiles?.display_name || 'User'}</p>
                <p className="text-[10px] text-primary capitalize">{m.role}</p>
              </div>
              {isOwner && m.user_id !== user?.id && (
                <button onClick={() => handleRemoveMember(m.id)} className="p-1 text-destructive">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Invite Links (Owner only) */}
        {isOwner && (
          <div className="stat-card space-y-3">
            <h3 className="font-heading text-sm font-semibold flex items-center gap-2">
              <Link2 size={16} /> {lang === 'en' ? 'Invite Links' : 'आमंत्रण लिंक'}
            </h3>

            <div className="flex gap-2">
              <select
                className="input-field text-sm flex-1"
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as 'manager' | 'staff')}
              >
                <option value="staff">{lang === 'en' ? 'Staff (View Only)' : 'स्टाफ (केवल देखें)'}</option>
                <option value="manager">{lang === 'en' ? 'Manager (Edit)' : 'मैनेजर (संपादन)'}</option>
              </select>
              <button onClick={handleCreateInvite} className="action-button text-sm px-4 flex items-center gap-1">
                <Plus size={14} /> {lang === 'en' ? 'Create' : 'बनाएं'}
              </button>
            </div>

            {invites.map(inv => (
              <div key={inv.id} className="flex items-center gap-2 py-2 border-t border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-body text-muted-foreground capitalize">{inv.role} · {inv.used_count}/{inv.max_uses || '∞'} used</p>
                  <p className="text-[10px] text-muted-foreground truncate">{inv.invite_code}</p>
                </div>
                <button onClick={() => copyInviteLink(inv.invite_code)} className="p-2 text-primary">
                  {copied === inv.invite_code ? <Check size={16} /> : <Copy size={16} />}
                </button>
                <button onClick={() => handleDeleteInvite(inv.id)} className="p-2 text-destructive">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {invites.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                {lang === 'en' ? 'Create an invite link to share with your team' : 'अपनी टीम के साथ साझा करने के लिए एक आमंत्रण लिंक बनाएं'}
              </p>
            )}
          </div>
        )}

        {/* Logout */}
        <button onClick={handleLogout} className="w-full stat-card flex items-center justify-center gap-2 py-3 text-destructive font-heading font-semibold">
          <LogOut size={18} />
          {lang === 'en' ? 'Logout' : 'लॉगआउट'}
        </button>
      </div>
    </div>
  );
}
