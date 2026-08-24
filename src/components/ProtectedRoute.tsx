import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import type { Perfil } from "../../shared/types";

export function ProtectedRoute({
  perfis,
  children,
}: {
  perfis?: Perfil[];
  children: React.ReactNode;
}) {
  const { user, loading, has } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (perfis && !has(...perfis)) {
    return (
      <div className="main" style={{ maxWidth: 640, margin: "60px auto" }}>
        <div className="card">
          <h2>Acesso não permitido</h2>
          <p>Seu perfil não tem acesso a esta tela.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
