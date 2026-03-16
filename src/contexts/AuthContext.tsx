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

interface AuthCache {
  profile: Profile;
  farmName: string | null;
  role: 'owner' | 'manager' | 'staff' | null;
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

const AUTH_CACHE_PREFIX = 'chitra_auth_cache_';

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  farmId: null,
  farmName: null,
  role: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
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

  const getCacheKey = (userId: string) => `${AUTH_CACHE_PREFIX}${userId}`;

  const loadAuthCache = (userId: string): AuthCache | null => {
    try {
      const raw = localStorage.getItem(getCacheKey(userId));
      if (!raw) return null;
      return JSON.parse(raw) as AuthCache;
    } catch {
      return null;
    }
  };

  const saveAuthCache = (userId: string, cache: AuthCache) => {
    try {
      localStorage.setItem(getCacheKey(userId), JSON.stringify(cache));
    } catch {
      // ignore cache write issues
    }
  };

  const clearAuthCache = (userId?: string) => {
    if (!userId) return;
    localStorage.removeItem(getCacheKey(userId));
  };

  const hydrateFromCache = (userId: string) => {
    const cached = loadAuthCache(userId);
    if (!cached) return false;

    setProfile(cached.profile);
    setFarmId(cached.profile.active_farm_id || null);
    setFarmName(cached.farmName || null);
    setRole(cached.role || null);
    return true;
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data: prof, error: profileError } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
      if (profileError || !prof) {
        hydrateFromCache(userId);
        return;
      }

      const normalizedProfile = prof as Profile;
      setProfile(normalizedProfile);

      const activeFarm = normalizedProfile.active_farm_id;
      if (!activeFarm) {
        setFarmId(null);
        setFarmName(null);
        setRole(null);
        saveAuthCache(userId, { profile: normalizedProfile, farmName: null, role: null });
        return;
      }

      setFarmId(activeFarm);

      const [{ data: farm }, { data: member }] = await Promise.all([
        supabase.from('farms').select('name').eq('id', activeFarm).single(),
        supabase.from('farm_members').select('role').eq('farm_id', activeFarm).eq('user_id', userId).single(),
      ]);

      const nextFarmName = farm?.name || null;
      const nextRole = (member?.role as 'owner' | 'manager' | 'staff' | null) || null;

      setFarmName(nextFarmName);
      setRole(nextRole);

      saveAuthCache(userId, {
        profile: normalizedProfile,
        farmName: nextFarmName,
        role: nextRole,
      });
    } catch {
      hydrateFromCache(userId);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);

      if (sess?.user) {
        setTimeout(() => fetchProfile(sess.user.id), 0);
      } else {
        setProfile(null);
        setFarmId(null);
        setFarmName(null);
        setRole(null);
      }

      setLoading(false);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: sess } }) => {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          fetchProfile(sess.user.id);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const currentUserId = user?.id;
    await supabase.auth.signOut();
    clearAuthCache(currentUserId);
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

  return <AuthContext.Provider value={{ user, session, profile, farmId, farmName, role, loading, signOut, refreshProfile }}>{children}</AuthContext.Provider>;
};
