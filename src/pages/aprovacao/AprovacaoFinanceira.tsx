import React, { useEffect, useState } from "react";
import { PageHeader } from "../../components/Layout";
import { Field, Banner } from "../../components/Field";
import { StatusFinanceiroBadge } from "../../components/StatusBadge";
import { api, ApiError } from "../../lib/api";
import { totalCreditos, totalGastos, resultadoLancamento, formatBRL, formatDate } from "../../../shared/calc";
import type { LancamentoFinanceiro, Missao } from "../../../shared/types";

export default function AprovacaoFinanceira() {
  const [lista, setLista] = useState<LancamentoFinanceiro[]>([]);
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<LancamentoFinanceiro | null>(null);
  const [observacao, setObservacao] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [l, m] = await Promise.all([
        api.get<LancamentoFinanceiro[]>("/financeiro"),
        api.get<Missao[]>("/missoes"),
      ]);
      setLista(l);
      setMissoes(m);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao carregar lançamentos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function abrir(l: LancamentoFinanceiro) {
    setSelecionado(l);
    setObservacao(l.observacaoAprovacao || "");
    setError(null);
    setSuccess(null);
  }

  async function agir(action: "salvar" | "aprovar" | "reprovar") {
    if (!selecionado) return;
    setActing(action);
    setError(null);
    try {
      const atualizado = await api.post<LancamentoFinanceiro>("/financeiro-aprovacao", {
        id: selecionado.id,
        action,
        observacao,
      });
      setSelecionado(atualizado);
      setSuccess(
        action === "salvar" ? "Observação salva." : action === "aprovar" ? "Lançamento aprovado." : "Lançamento reprovado."
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao processar.");
    } finally {
      setActing(null);
    }
  }

  function titulo(l: LancamentoFinanceiro): string {
    if (l.tipo === "missao") {
      const m = missoes.find((x) => x.id === l.missaoId);
      return m ? `${m.nome} (${m.numero})` : "Missão";
    }
    return l.nomeProjeto || "Projeto";
  }

  const travado = selecionado?.status === "Aprovado";

  return (
    <div>
      <PageHeader crumbs="Aprovação Financeira" title="Aprovação Financeira" />
      <Banner type="error">{error}</Banner>

      <div className="card">
        {loading ? (
          <div className="spinner" />
        ) : lista.length === 0 ? (
          <div className="empty-state">Nenhum lançamento financeiro ainda.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Origem</th>
                  <th>Data</th>
                  <th>Resultado</th>
                  <th>Criado por</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((l) => (
                  <tr key={l.id} style={{ cursor: "pointer" }} onClick={() => abrir(l)}>
                    <td>
                      <StatusFinanceiroBadge status={l.status} />
                    </td>
                    <td>{titulo(l)}</td>
                    <td>{formatDate(l.createdAt)}</td>
                    <td>{formatBRL(resultadoLancamento(l))}</td>
                    <td>{l.criadoPorNome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selecionado && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>{titulo(selecionado)}</h2>
            <StatusFinanceiroBadge status={selecionado.status} />
          </div>
          <Banner type="success">{success}</Banner>

          <div className="grid grid-3">
            <div className="summary-box">
              <span>Recebido</span>
              <span className="value">{formatBRL(totalCreditos(selecionado.creditos))}</span>
            </div>
            <div className="summary-box">
              <span>Gasto</span>
              <span className="value">{formatBRL(totalGastos(selecionado.gastos))}</span>
            </div>
            <div className="summary-box">
              <span>Resultado</span>
              <span className="value">{formatBRL(resultadoLancamento(selecionado))}</span>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qtd</th>
                  <th>Valor unit.</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {selecionado.gastos.map((g) => (
                  <tr key={g.id}>
                    <td>{g.nome}</td>
                    <td>{g.quantidade}</td>
                    <td>{formatBRL(g.valorUnitario)}</td>
                    <td>{formatBRL(g.quantidade * g.valorUnitario)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Field label="Observações">
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
              disabled={travado}
            />
          </Field>

          {!travado && (
            <div className="btn-row">
              <button className="btn btn-secondary" disabled={!!acting} onClick={() => agir("salvar")}>
                {acting === "salvar" ? "Salvando…" : "Salvar"}
              </button>
              <button className="btn btn-success" disabled={!!acting} onClick={() => agir("aprovar")}>
                {acting === "aprovar" ? "Aprovando…" : "Aprovado"}
              </button>
              <button className="btn btn-danger" disabled={!!acting} onClick={() => agir("reprovar")}>
                {acting === "reprovar" ? "Reprovando…" : "Reprovar"}
              </button>
            </div>
          )}
          {travado && <p className="hint">Lançamento aprovado — não pode mais ser alterado.</p>}

          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => setSelecionado(null)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
