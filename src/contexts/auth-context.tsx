import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Session } from '@supabase/supabase-js';

import { registerForPushNotificationsAsync, savePushToken } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

export type UserRole = 'owner' | 'driver';

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  created_at: string;
};

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setProfile(data as Profile);
      return;
    }

    // 'PGRST116' = satir bulunamadi (Supabase'in .single() donen hatasi).
    // Bu gercekten hesabin silindigi/artik gecersiz oldugu anlamina gelir,
    // bu durumda oturumu kapatip girise donuyoruz. Baska bir hata (agi
    // kopmasi, gecici sunucu hatasi vb.) icin oturumu KAPATMIYORUZ - aksi
    // halde kullanici internet dalgalanmasi yuzunden habersizce disari
    // atilmis olur.
    if (error?.code === 'PGRST116') {
      await supabase.auth.signOut();
    } else if (error) {
      console.warn('Profil yuklenemedi (gecici hata olabilir):', error);
    }
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        await loadProfile(data.session.user.id);
      }
      if (mounted) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        await loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!profile) return;
    registerForPushNotificationsAsync()
      .then((token) => {
        if (token) return savePushToken(profile.id, token);
      })
      .catch(() => {});
  }, [profile?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      refreshProfile: async () => {
        if (session) await loadProfile(session.user.id);
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() bir AuthProvider icinde kullanilmali.');
  }
  return ctx;
}
