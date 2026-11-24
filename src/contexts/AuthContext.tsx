import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isSupabaseConfigured: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (email: string, password: string, fullName?: string) => Promise<{ error: string | null; needsConfirmation?: boolean }>;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signInWithOAuth: (provider: "github" | "google") => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: "Cloud accounts are not configured for this deployment." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  }, []);

  const signUpWithPassword = useCallback(
    async (email: string, password: string, fullName?: string) => {
      if (!supabase) return { error: "Cloud accounts are not configured for this deployment." };
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: fullName ? { full_name: fullName } : undefined,
          emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
        },
      });
      if (error) return { error: error.message };
      return {
        error: null,
        needsConfirmation: !data.session,
      };
    },
    []
  );

  const signInWithMagicLink = useCallback(async (email: string) => {
    if (!supabase) return { error: "Cloud accounts are not configured for this deployment." };
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
      },
    });
    return { error: error ? error.message : null };
  }, []);

  const signInWithOAuth = useCallback(async (provider: "github" | "google") => {
    if (!supabase) return { error: "Cloud accounts are not configured for this deployment." };
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin + import.meta.env.BASE_URL,
      },
    });
    return { error: error ? error.message : null };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      isSupabaseConfigured,
      signInWithPassword,
      signUpWithPassword,
      signInWithMagicLink,
      signInWithOAuth,
      signOut,
    }),
    [user, session, loading, signInWithPassword, signUpWithPassword, signInWithMagicLink, signInWithOAuth, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const GUEST_FALLBACK: AuthContextValue = {
  user: null,
  session: null,
  loading: false,
  isSupabaseConfigured: false,
  signInWithPassword: async () => ({ error: "Auth provider not mounted" }),
  signUpWithPassword: async () => ({ error: "Auth provider not mounted" }),
  signInWithMagicLink: async () => ({ error: "Auth provider not mounted" }),
  signInWithOAuth: async () => ({ error: "Auth provider not mounted" }),
  signOut: async () => {},
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  return ctx ?? GUEST_FALLBACK;
}
