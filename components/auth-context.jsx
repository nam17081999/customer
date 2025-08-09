import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const AuthContext = createContext({ user: null, role: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadSession() {
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    const sessUser = data?.session?.user || null;
    setUser(sessUser);
    if (sessUser) {
      let r = sessUser.user_metadata?.role || null;
      console.log('User role from metadata:', r);
      if (!r) {
        const { data: prof } = await supabase.from("profiles").select("role").eq("id", sessUser.id).maybeSingle();
        r = prof?.role || null;
      }
      setRole(r);
    } else {
      setRole(null);
    }
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

  const value = useMemo(() => ({ user, role, loading, signOut: () => supabase.auth.signOut() }), [user, role, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
