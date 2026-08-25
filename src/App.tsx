import React from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./lib/AuthContext";

import Login from "./pages/Login";
import Home from "./pages/Home";
import Colaboradores from "./pages/cadastros/Colaboradores";
import Campos from "./pages/cadastros/Campos";
import Operadores from "./pages/cadastros/Operadores";
import ResetSistema from "./pages/cadastros/ResetSistema";
import NovaMissao from "./pages/missoes/NovaMissao";
import ConsultaMissoes from "./pages/missoes/ConsultaMissoes";
import CamposDisponiveis from "./pages/missoes/CamposDisponiveis";
import Inventario from "./pages/missoes/Inventario";
import AnaliseMissoes from "./pages/analise/AnaliseMissoes";
import AvaliacaoMissoes from "./pages/analise/AvaliacaoMissoes";
import MovimentacaoFinanceira from "./pages/financeiro/MovimentacaoFinanceira";
import CaixaGeral from "./pages/financeiro/CaixaGeral";
import AprovacaoFinanceira from "./pages/financeiro/AprovacaoFinanceira";
import ListaOperadores from "./pages/operadores/ListaOperadores";
import RelatorioPresencas from "./pages/operadores/RelatorioPresencas";

function Protected({
  perfis,
  children,
}: {
  perfis?: import("../shared/types").Perfil[];
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute perfis={perfis}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  const { loading } = useAuth();
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={<Protected>{<Home />}</Protected>} />

      <Route
        path="/cadastros/colaboradores"
        element={<Protected perfis={["Administrador"]}>{<Colaboradores />}</Protected>}
      />
      <Route path="/cadastros/campos" element={<Protected perfis={["Administrador"]}>{<Campos />}</Protected>} />
      <Route
        path="/cadastros/operadores"
        element={<Protected perfis={["Administrador"]}>{<Operadores />}</Protected>}
      />
      <Route
        path="/cadastros/reset"
        element={<Protected perfis={["Administrador"]}>{<ResetSistema />}</Protected>}
      />

      <Route
        path="/missoes/nova"
        element={
          <Protected perfis={["Administrador", "Coordenador", "Colaborador"]}>{<NovaMissao />}</Protected>
        }
      />
      <Route
        path="/missoes/nova/:id"
        element={
          <Protected perfis={["Administrador", "Coordenador", "Colaborador"]}>{<NovaMissao />}</Protected>
        }
      />
      <Route
        path="/missoes/consulta"
        element={
          <Protected perfis={["Administrador", "Coordenador", "Colaborador"]}>{<ConsultaMissoes />}</Protected>
        }
      />
      <Route
        path="/missoes/campos-disponiveis"
        element={
          <Protected perfis={["Administrador", "Coordenador", "Colaborador"]}>{<CamposDisponiveis />}</Protected>
        }
      />
      <Route
        path="/missoes/inventario"
        element={
          <Protected perfis={["Administrador", "Coordenador", "Colaborador"]}>{<Inventario />}</Protected>
        }
      />

      <Route
        path="/analise/missoes"
        element={<Protected perfis={["Administrador", "Coordenador"]}>{<AnaliseMissoes />}</Protected>}
      />
      <Route
        path="/analise/avaliacao"
        element={<Protected perfis={["Administrador", "Coordenador"]}>{<AvaliacaoMissoes />}</Protected>}
      />

      <Route
        path="/financeiro/movimentacao"
        element={
          <Protected perfis={["Administrador", "Financeiro", "Coordenador"]}>{<MovimentacaoFinanceira />}</Protected>
        }
      />
      <Route
        path="/financeiro/caixa"
        element={<Protected perfis={["Administrador", "Financeiro", "Coordenador"]}>{<CaixaGeral />}</Protected>}
      />
      <Route
        path="/financeiro/aprovacao"
        element={<Protected perfis={["Administrador", "Coordenador"]}>{<AprovacaoFinanceira />}</Protected>}
      />

      <Route
        path="/operadores/lista"
        element={
          <Protected perfis={["Administrador", "Coordenador", "Colaborador"]}>{<ListaOperadores />}</Protected>
        }
      />
      <Route
        path="/operadores/presencas"
        element={
          <Protected perfis={["Administrador", "Coordenador", "Colaborador"]}>{<RelatorioPresencas />}</Protected>
        }
      />

      <Route path="*" element={<Protected>{<Home />}</Protected>} />
    </Routes>
  );
}
