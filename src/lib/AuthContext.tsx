import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import type { Perfil, SessionUser } from "../../shared/types";

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  has: (...perfis: Perfil[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ user: SessionUser | null }>("/auth-me");
      setUser(data?.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth-logout");
    setUser(null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const has = useCallback((...perfis: Perfil[]) => !!user && user.perfis.some((p) => perfis.includes(p)), [user]);

  return <AuthContext.Provider value={{ user, loading, refresh, logout, has }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
