import React, { useState } from "react";
import { PageHeader } from "../../components/Layout";
import { Field, Banner } from "../../components/Field";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";

const FRASE_CONFIRMACAO = "RESETAR TUDO";

const NOMES_STORE: Record<string, string> = {
  colaboradores: "Colaboradores",
  campos: "Campos",
  operadores: "Operadores",
  produtos: "Produtos",
  missoes: "Missões",
  financeiro: "Lançamentos financeiros",
  counters: "Contadores de numeração",
  arquivos: "Arquivos anexados",
  logs: "Logs de auditoria",
};

export default function ResetSistema() {
  const { logout } = useAuth();
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resetando, setResetando] = useState(false);
  const [resultado, setResultado] = useState<Record<string, number> | null>(null);

  const habilitado = texto === FRASE_CONFIRMACAO;

  async function resetar() {
    if (!habilitado) return;
    if (
      !confirm(
        "Isso vai apagar TODOS os dados do sistema (missões, colaboradores, campos, operadores e financeiro) e não pode ser desfeito. Confirma?"
      )
    ) {
      return;
    }
    setResetando(true);
    setError(null);
    try {
      const res = await api.post<{ ok: boolean; apagados: Record<string, number> }>("/admin-reset", {
        confirmacao: texto,
      });
      setResultado(res.apagados);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao resetar o sistema.");
    } finally {
      setResetando(false);
    }
  }

  if (resultado) {
    return (
      <div>
        <PageHeader crumbs="Cadastros" title="Reset do Sistema" />
        <div className="card">
          <h2>Reset concluído</h2>
          <p>Todos os dados foram apagados:</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Área</th>
                  <th>Registros apagados</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(resultado).map(([key, count]) => (
                  <tr key={key}>
                    <td>{NOMES_STORE[key] || key}</td>
                    <td>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint" style={{ marginTop: 14 }}>
            Sua sessão atual continua ativa por enquanto, mas seu próprio cadastro de colaborador também foi
            apagado. Saia e faça login de novo com o Google para o sistema te recriar automaticamente como
            Administrador.
          </p>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={() => logout()}>
              Sair e fazer login novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader crumbs="Cadastros" title="Reset do Sistema" />
      <Banner type="error">{error}</Banner>
      <div className="card">
        <h2>Apagar todos os dados e começar do zero</h2>
        <p>
          Esta ação apaga <strong>permanentemente</strong> todos os registros do sistema — Missões, Colaboradores,
          Campos, Operadores, lançamentos do Financeiro, os arquivos anexados e também os Logs de auditoria — e
          zera os contadores de numeração (a próxima missão volta a ser 001 do ano, o próximo operador volta a
          ser 0001 do ano).
        </p>
        <p>
          <strong>Não pode ser desfeito.</strong> Use só se quiser limpar dados de teste antes de colocar o
          sistema pra valer com o time.
        </p>
        <p className="hint">
          Os backups (tela "Backup") não são apagados pelo Reset — se o reset foi engano, dá pra restaurar um
          backup anterior depois.
        </p>
        <Field label={`Digite "${FRASE_CONFIRMACAO}" para habilitar o botão`} required>
          <input type="text" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={FRASE_CONFIRMACAO} />
        </Field>
        <div className="btn-row">
          <button className="btn btn-danger" disabled={!habilitado || resetando} onClick={resetar}>
            {resetando ? "Apagando…" : "Apagar tudo e resetar"}
          </button>
        </div>
      </div>
    </div>
  );
}
