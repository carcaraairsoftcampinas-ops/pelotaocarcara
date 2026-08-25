import React, { useEffect, useState } from "react";
import { PageHeader } from "../../components/Layout";
import { Field, Banner } from "../../components/Field";
import { StatusFinanceiroBadge } from "../../components/StatusBadge";
import { api, ApiError } from "../../lib/api";
import { useActionNotice } from "../../lib/ActionNoticeContext";
import { totalInvestimentos, totalCreditosItens, resultadoLancamento, formatBRL, formatDate } from "../../../shared/calc";
import type { LancamentoFinanceiro, Missao } from "../../../shared/types";

export default function AprovacaoFinanceira() {
  const { notify } = useActionNotice();
  const [lista, setLista] = useState<LancamentoFinanceiro[]>([]);
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  }

  async function agir(action: "aprovar" | "reprovar") {
    if (!selecionado) return;
    if (!observacao.trim()) {
      setError("Preencha o campo Observações antes de aprovar ou reprovar.");
      return;
    }
    if (!confirm(`Confirma a ação "${action === "aprovar" ? "aprovar" : "reprovar"}" para este lançamento?`)) return;
    setActing(action);
    setError(null);
    try {
      const atualizado = await api.post<LancamentoFinanceiro>("/financeiro-aprovacao", {
        id: selecionado.id,
        action,
        observacao,
      });
      setSelecionado(atualizado);
      notify(action === "aprovar" ? "Lançamento aprovado com sucesso." : "Lançamento reprovado com sucesso.");
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
      return m ? `${m.nome} (${m.numero || "—"})` : "Missão";
    }
    return l.nomeProjeto || "Projeto";
  }

  function qtdeOperadores(l: LancamentoFinanceiro): number | null {
    if (l.tipo !== "missao") return null;
    const m = missoes.find((x) => x.id === l.missaoId);
    return m?.quantidadeOperadores ?? null;
  }

  const podeAgir = selecionado?.status === "Aprovação Pendente";

  return (
    <div>
      <PageHeader crumbs="Financeiro" title="Aprovação Financeira" />
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
                  <th>Nome</th>
                  <th>Data</th>
                  <th>Resultado</th>
                  <th>Criado por</th>
                  <th>Qtde Operadores</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((l) => (
                  <tr key={l.id} style={{ cursor: "pointer" }} onClick={() => abrir(l)}>
                    <td>
                      <StatusFinanceiroBadge status={l.status} />
                    </td>
                    <td>{l.tipo === "missao" ? "Missão" : "Projeto"}</td>
                    <td>{titulo(l)}</td>
                    <td>{formatDate(l.createdAt)}</td>
                    <td>{formatBRL(resultadoLancamento(l))}</td>
                    <td>{l.criadoPorNome}</td>
                    <td>{qtdeOperadores(l) ?? "—"}</td>
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

          <div className="grid grid-3">
            <div className="summary-box">
              <span>Créditos</span>
              <span className="value">{formatBRL(totalCreditosItens(selecionado.creditos))}</span>
            </div>
            <div className="summary-box">
              <span>Despesas</span>
              <span className="value">{formatBRL(totalInvestimentos(selecionado.investimentos))}</span>
            </div>
            <div className="summary-box">
              <span>Resultado</span>
              <span className="value">{formatBRL(resultadoLancamento(selecionado))}</span>
            </div>
          </div>

          <h3 style={{ marginTop: 16 }}>Despesas</h3>
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
                {selecionado.investimentos.map((i) => (
                  <tr key={i.id}>
                    <td>{i.nome}</td>
                    <td>{i.quantidade}</td>
                    <td>{formatBRL(i.valorUnitario)}</td>
                    <td>{formatBRL(i.quantidade * i.valorUnitario)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ marginTop: 16 }}>Créditos</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {selecionado.creditos.map((c) => (
                  <tr key={c.id}>
                    <td>{formatDate(c.data)}</td>
                    <td>{c.descricao}</td>
                    <td>{formatBRL(c.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Field label="Observações" required={podeAgir} hint="Obrigatório para aprovar ou reprovar.">
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} disabled={!podeAgir} />
          </Field>

          {podeAgir ? (
            <div className="btn-row">
              <button className="btn btn-success" disabled={!!acting} onClick={() => agir("aprovar")}>
                {acting === "aprovar" ? "Aprovando…" : "Aprovado"}
              </button>
              <button className="btn btn-danger" disabled={!!acting} onClick={() => agir("reprovar")}>
                {acting === "reprovar" ? "Reprovando…" : "Reprovar"}
              </button>
            </div>
          ) : selecionado.status === "Financeiro Aprovado" ? (
            <p className="hint">Lançamento aprovado — não pode mais ser alterado.</p>
          ) : (
            <p className="hint">Este lançamento ainda não foi enviado para Aprovação Financeira.</p>
          )}

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
