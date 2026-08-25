import React, { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import type { SessionUser } from "../../shared/types";

export default function Login() {
  const { user, loading, refresh } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const sessaoExpirada = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("expirada") === "1";

  useEffect(() => {
    if (user || loading) return;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError(
        "VITE_GOOGLE_CLIENT_ID não configurado. Veja o SETUP.md para criar as credenciais do Google e configurar as variáveis de ambiente."
      );
      return;
    }

    let cancelled = false;
    let tries = 0;
    const tryInit = () => {
      if (cancelled) return;
      if (window.google?.accounts?.id && buttonRef.current) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            setError(null);
            try {
              await api.post<{ user: SessionUser }>("/auth-login", { credential: response.credential });
              await refresh();
            } catch (err: any) {
              setError(err?.message || "Não foi possível entrar.");
            }
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "signin_with",
          width: 260,
        });
        setReady(true);
      } else if (tries < 40) {
        tries++;
        setTimeout(tryInit, 150);
      } else {
        setError("Não foi possível carregar o login do Google. Verifique sua conexão e recarregue a página.");
      }
    };
    tryInit();
    return () => {
      cancelled = true;
    };
  }, [user, loading, refresh]);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="login-screen">
      <div className="login-card">
        <img src="/logo-carcara.jpg" alt="Carcará Airsoft Team" style={{ borderRadius: 12 }} />
        <h1>Sistema de Missões</h1>
        <p>Entre com sua conta Google cadastrada pelo time para acessar o sistema.</p>
        {sessaoExpirada && !error && (
          <div className="banner banner-error" style={{ textAlign: "left" }}>
            Sua sessão expirou. Faça login novamente.
          </div>
        )}
        <div ref={buttonRef} style={{ display: "flex", justifyContent: "center", minHeight: 44 }} />
        {!ready && !error && <div className="spinner" style={{ marginTop: 10 }} />}
        {error && <div className="banner banner-error" style={{ marginTop: 16, textAlign: "left" }}>{error}</div>}
      </div>
    </div>
  );
}
