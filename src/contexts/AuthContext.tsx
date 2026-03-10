import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  active_farm_id: string | null;
}

interface FarmMember {
  farm_id: string;
  role: 'owner' | 'manager' | 'staff';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  farmId: string | null;
  farmName: string | null;
  role: 'owner' | 'manager' | 'staff' | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, profile: null, farmId: null, farmName: null,
  role: null, loading: true, signOut: async () => {}, refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [farmId, setFarmId] = useState<string | null>(null);
  const [farmName, setFarmName] = useState<string | null>(null);
  const [role, setRole] = useState<'owner' | 'manager' | 'staff' | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (prof) {
      setProfile(prof as Profile);
      const activeFarm = prof.active_farm_id;

      if (activeFarm) {
        setFarmId(activeFarm);

        const { data: farm } = await supabase
          .from('farms')
          .select('name')
          .eq('id', activeFarm)
          .single();
        setFarmName(farm?.name || null);

        const { data: member } = await supabase
          .from('farm_members')
          .select('role')
          .eq('farm_id', activeFarm)
          .eq('user_id', userId)
          .single();
        setRole((member?.role as 'owner' | 'manager' | 'staff') || null);
      }
    }
  };

  useEffect(() => {
    // Set up auth listener BEFORE getSession
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);

      if (sess?.user) {
        // Use setTimeout to avoid Supabase deadlock
        setTimeout(() => fetchProfile(sess.user.id), 0);
      } else {
        setProfile(null);
        setFarmId(null);
        setFarmName(null);
        setRole(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        fetchProfile(sess.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setFarmId(null);
    setFarmName(null);
    setRole(null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, farmId, farmName, role, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
