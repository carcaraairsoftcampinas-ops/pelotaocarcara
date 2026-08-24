import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function Home() {
  const { has } = useAuth();
  if (has("Administrador", "Coordenador", "Colaborador")) return <Navigate to="/missoes/consulta" replace />;
  if (has("Financeiro")) return <Navigate to="/financeiro/lancamento" replace />;
  return (
    <div className="card">
      <h2>Bem-vindo</h2>
      <p>Você não tem nenhum módulo disponível. Fale com um administrador.</p>
    </div>
  );
}
