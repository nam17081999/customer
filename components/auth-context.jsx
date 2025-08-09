import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const AuthContext = createContext({ user: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadSession() {
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    const sessUser = data?.session?.user || null;
    setUser(sessUser);
    setLoading(false);
  }

  useEffect(() => {
    loadSession();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadSession();
    });
    return () => {
      sub.subscription?.unsubscribe?.();
    };
  }, []);

  const value = useMemo(() => ({ user, loading, signOut: () => supabase.auth.signOut() }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
