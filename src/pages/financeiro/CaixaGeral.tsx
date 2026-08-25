import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/Layout";
import { Banner } from "../../components/Field";
import { StatusFinanceiroBadge } from "../../components/StatusBadge";
import { api, ApiError } from "../../lib/api";
import { buildMovimentacaoRows } from "../../lib/financeiroRows";
import { totalInvestimentos, totalCreditosItens, resultadoLancamento, formatBRL, formatDate } from "../../../shared/calc";
import { STATUS_FINANCEIRO_PROVISAO } from "../../../shared/types";
import type { LancamentoFinanceiro, Missao } from "../../../shared/types";

export default function CaixaGeral() {
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([]);
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<LancamentoFinanceiro | null>(null);
  const [filtroTipo, setFiltroTipo] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [l, m] = await Promise.all([
          api.get<LancamentoFinanceiro[]>("/financeiro"),
          api.get<Missao[]>("/missoes"),
        ]);
        setLancamentos(l);
        setMissoes(m);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Erro ao carregar caixa geral.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const aprovados = useMemo(
    () => lancamentos.filter((l) => l.status === "Financeiro Aprovado" && (filtroTipo ? l.tipo === filtroTipo : true)),
    [lancamentos, filtroTipo]
  );

  const totalRecebido = aprovados.reduce((sum, l) => sum + totalCreditosItens(l.creditos), 0);
  const totalGasto = aprovados.reduce((sum, l) => sum + totalInvestimentos(l.investimentos), 0);
  const saldo = totalRecebido - totalGasto;

  // Provisões: tudo que ainda não é "Financeiro Aprovado" — missões Aprovada/
  // Finalizada sem lançamento ainda (status derivado) + lançamentos de
  // missão/projeto Em Andamento, Aprovação Pendente ou Financeiro Pendente.
  const linhasProvisao = useMemo(() => {
    const todas = buildMovimentacaoRows(missoes, lancamentos);
    return todas.filter((r) => STATUS_FINANCEIRO_PROVISAO.includes(r.status));
  }, [missoes, lancamentos]);

  const provisaoGasto = linhasProvisao.reduce((sum, r) => {
    if (r.lancamentoId) {
      const l = lancamentos.find((x) => x.id === r.lancamentoId);
      return sum + (l ? totalInvestimentos(l.investimentos) : 0);
    }
    return sum + r.investimentoPrevisto;
  }, 0);

  const provisaoCredito = linhasProvisao.reduce((sum, r) => {
    if (r.lancamentoId) {
      const l = lancamentos.find((x) => x.id === r.lancamentoId);
      return sum + (l ? totalCreditosItens(l.creditos) : 0);
    }
    return sum;
  }, 0);

  function titulo(l: LancamentoFinanceiro): string {
    if (l.tipo === "missao") {
      const m = missoes.find((x) => x.id === l.missaoId);
      return m ? `${m.nome} (${m.numero || "—"})` : "Missão";
    }
    return l.nomeProjeto || "Projeto";
  }

  return (
    <div>
      <PageHeader crumbs="Financeiro" title="Caixa Geral" />
      <Banner type="error">{error}</Banner>

      {loading ? (
        <div className="spinner" />
      ) : (
        <>
          <div className="grid grid-3">
            <div className="card">
              <h2>Total recebido</h2>
              <p className="value" style={{ fontSize: 24, color: "var(--green)" }}>
                {formatBRL(totalRecebido)}
              </p>
            </div>
            <div className="card">
              <h2>Total gasto</h2>
              <p className="value" style={{ fontSize: 24, color: "var(--red)" }}>
                {formatBRL(totalGasto)}
              </p>
            </div>
            <div className="card">
              <h2>Saldo em caixa</h2>
              <p className="value" style={{ fontSize: 24, color: "var(--gold)" }}>
                {formatBRL(saldo)}
              </p>
            </div>
          </div>
          <p className="hint" style={{ marginTop: -12, marginBottom: 16 }}>
            Números reais — considera só missões e projetos já com status "Financeiro Aprovado".
          </p>

          <div className="card">
            <div className="filters-bar">
              <div className="field" style={{ minWidth: 160 }}>
                <label>Origem</label>
                <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                  <option value="">Todas</option>
                  <option value="missao">Missão</option>
                  <option value="projeto">Projeto</option>
                </select>
              </div>
            </div>
            <h2>Lançamentos que compõem o caixa</h2>
            {aprovados.length === 0 ? (
              <div className="empty-state">Nenhum lançamento aprovado ainda.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Origem</th>
                      <th>Nome</th>
                      <th>Data</th>
                      <th>Recebido</th>
                      <th>Gasto</th>
                      <th>Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aprovados.map((l) => (
                      <tr key={l.id} style={{ cursor: "pointer" }} onClick={() => setDetalhe(l)}>
                        <td>{l.tipo === "missao" ? "Missão" : "Projeto"}</td>
                        <td>{titulo(l)}</td>
                        <td>{formatDate(l.createdAt)}</td>
                        <td>{formatBRL(totalCreditosItens(l.creditos))}</td>
                        <td>{formatBRL(totalInvestimentos(l.investimentos))}</td>
                        <td>{formatBRL(resultadoLancamento(l))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {detalhe && (
            <div className="card">
              <h2>{titulo(detalhe)}</h2>
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
                    {detalhe.investimentos.map((i) => (
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
              <div className="btn-row">
                <button className="btn btn-secondary" onClick={() => setDetalhe(null)}>
                  Fechar
                </button>
              </div>
            </div>
          )}

          <div className="card">
            <h2>Provisões (previsão futura)</h2>
            <p className="hint">
              Tudo que ainda não é "Financeiro Aprovado": missões Aprovada/Finalizada sem lançamento ainda,
              lançamentos Em Andamento, Aprovação Pendente ou Financeiro Pendente.
            </p>
            <div className="grid grid-3">
              <div className="summary-box">
                <span>Previsto a gastar</span>
                <span className="value">{formatBRL(provisaoGasto)}</span>
              </div>
              <div className="summary-box">
                <span>Previsto a receber (já lançado)</span>
                <span className="value">{formatBRL(provisaoCredito)}</span>
              </div>
              <div className="summary-box" style={{ borderColor: "var(--gold-dim)" }}>
                <span>Saldo previsto</span>
                <span className="value">{formatBRL(provisaoCredito - provisaoGasto)}</span>
              </div>
            </div>
            {linhasProvisao.length === 0 ? (
              <div className="empty-state">Nenhuma provisão em aberto.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Origem</th>
                      <th>Nome</th>
                      <th>Data</th>
                      <th>Colaborador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasProvisao.map((r) => (
                      <tr key={r.key}>
                        <td>
                          <StatusFinanceiroBadge status={r.status} />
                        </td>
                        <td>{r.origem === "missao" ? "Missão" : "Projeto"}</td>
                        <td>{r.nome}</td>
                        <td>{formatDate(r.data)}</td>
                        <td>{r.colaboradorNome}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
