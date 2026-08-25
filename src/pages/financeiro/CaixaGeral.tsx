import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/Layout";
import { Banner, Field } from "../../components/Field";
import { StatusFinanceiroBadge } from "../../components/StatusBadge";
import { api, ApiError } from "../../lib/api";
import { buildMovimentacaoRows } from "../../lib/financeiroRows";
import type { MovimentacaoRow } from "../../lib/financeiroRows";
import { totalInvestimentos, totalCreditosItens, resultadoLancamento, formatBRL, formatDate } from "../../../shared/calc";
import { STATUS_FINANCEIRO_PROVISAO } from "../../../shared/types";
import type { LancamentoFinanceiro, Missao } from "../../../shared/types";

// Data em que um lançamento entrou de fato no caixa — usada pro filtro de
// período do bloco "aprovados" (auditoria de "como estava o caixa naquela
// data"), lendo do histórico de status quando disponível.
function dataAprovacao(l: LancamentoFinanceiro): string {
  const entry = l.historicoStatus.find((h) => h.status === "Financeiro Aprovado");
  return (entry?.data || l.updatedAt || l.createdAt).slice(0, 10);
}

function quemEnviouAprovacao(l: LancamentoFinanceiro | null): string {
  if (!l) return "—";
  const entry = l.historicoStatus.find((h) => h.status === "Aprovação Pendente");
  return entry ? entry.colaboradorNome : "—";
}

function quemAprovouFinanceiro(l: LancamentoFinanceiro | null): string {
  if (!l) return "—";
  const entry = l.historicoStatus.find((h) => h.status === "Financeiro Aprovado");
  return entry ? entry.colaboradorNome : "—";
}

interface DetalheModal {
  titulo: string;
  status?: LancamentoFinanceiro["status"];
  lancamento: LancamentoFinanceiro | null;
  quantidadeOperadores: number | null;
  operadoresPresentes: number | null;
}

const EMPTY_FILTROS_CAIXA = { origem: "" as "" | "missao" | "projeto", dataInicio: "", dataFim: "", numero: "" };
const EMPTY_FILTROS_PROVISAO = { dataInicio: "", dataFim: "", numero: "" };

export default function CaixaGeral() {
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([]);
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheModal | null>(null);

  const [filtrosCaixa, setFiltrosCaixa] = useState(EMPTY_FILTROS_CAIXA);
  const [filtrosCaixaAplicados, setFiltrosCaixaAplicados] = useState(EMPTY_FILTROS_CAIXA);
  const [filtrosProvisao, setFiltrosProvisao] = useState(EMPTY_FILTROS_PROVISAO);
  const [filtrosProvisaoAplicados, setFiltrosProvisaoAplicados] = useState(EMPTY_FILTROS_PROVISAO);

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

  const numeroMissaoDoLancamento = useMemo(() => {
    const map = new Map(missoes.map((m) => [m.id, m.numero || ""]));
    return (l: LancamentoFinanceiro) => (l.tipo === "missao" && l.missaoId ? map.get(l.missaoId) || "" : "");
  }, [missoes]);

  const aprovados = useMemo(() => {
    const f = filtrosCaixaAplicados;
    return lancamentos
      .filter((l) => l.status === "Financeiro Aprovado")
      .filter((l) => (f.origem ? l.tipo === f.origem : true))
      .filter((l) => (f.dataInicio ? dataAprovacao(l) >= f.dataInicio : true))
      .filter((l) => (f.dataFim ? dataAprovacao(l) <= f.dataFim : true))
      .filter((l) => (f.numero ? numeroMissaoDoLancamento(l).toLowerCase().includes(f.numero.toLowerCase()) : true));
  }, [lancamentos, filtrosCaixaAplicados, numeroMissaoDoLancamento]);

  function pesquisarCaixa() {
    setFiltrosCaixaAplicados(filtrosCaixa);
  }
  function pesquisarProvisao() {
    setFiltrosProvisaoAplicados(filtrosProvisao);
  }

  const totalRecebido = aprovados.reduce((sum, l) => sum + totalCreditosItens(l.creditos), 0);
  const totalGasto = aprovados.reduce((sum, l) => sum + totalInvestimentos(l.investimentos), 0);
  const saldo = totalRecebido - totalGasto;

  // Provisões: tudo que ainda não é "Financeiro Aprovado" — missões Aprovada/
  // Finalizada sem lançamento ainda (status derivado) + lançamentos de
  // missão/projeto Em Andamento, Aprovação Pendente ou Financeiro Pendente.
  const linhasProvisaoTodas = useMemo(() => {
    const todas = buildMovimentacaoRows(missoes, lancamentos);
    return todas.filter((r) => STATUS_FINANCEIRO_PROVISAO.includes(r.status));
  }, [missoes, lancamentos]);

  const numeroMissaoDaLinha = useMemo(() => {
    const map = new Map(missoes.map((m) => [m.id, m.numero || ""]));
    return (r: MovimentacaoRow) => (r.origem === "missao" && r.missaoId ? map.get(r.missaoId) || "" : "");
  }, [missoes]);

  const linhasProvisao = useMemo(() => {
    const f = filtrosProvisaoAplicados;
    return linhasProvisaoTodas
      .filter((r) => (f.dataInicio ? r.data >= f.dataInicio : true))
      .filter((r) => (f.dataFim ? r.data <= f.dataFim : true))
      .filter((r) => (f.numero ? numeroMissaoDaLinha(r).toLowerCase().includes(f.numero.toLowerCase()) : true));
  }, [linhasProvisaoTodas, filtrosProvisaoAplicados, numeroMissaoDaLinha]);

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

  function abrirDetalheLancamento(l: LancamentoFinanceiro) {
    const m = l.tipo === "missao" ? missoes.find((x) => x.id === l.missaoId) : null;
    setDetalhe({
      titulo: titulo(l),
      status: l.status,
      lancamento: l,
      quantidadeOperadores: m?.quantidadeOperadores ?? null,
      operadoresPresentes: m?.avaliacao?.totalOperadoresPresentes ?? null,
    });
  }

  function abrirDetalheRow(r: MovimentacaoRow) {
    const l = r.lancamentoId ? lancamentos.find((x) => x.id === r.lancamentoId) || null : null;
    setDetalhe({
      titulo: r.nome,
      status: r.status,
      lancamento: l,
      quantidadeOperadores: r.quantidadeOperadores,
      operadoresPresentes: r.operadoresPresentes,
    });
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
            Números reais — considera só missões e projetos já com status "Financeiro Aprovado". Use os filtros
            abaixo para auditar como estava o caixa em um período específico.
          </p>

          <div className="card">
            <div className="filters-bar">
              <Field label="Origem">
                <select value={filtrosCaixa.origem} onChange={(e) => setFiltrosCaixa({ ...filtrosCaixa, origem: e.target.value as any })}>
                  <option value="">Todas</option>
                  <option value="missao">Missão</option>
                  <option value="projeto">Projeto</option>
                </select>
              </Field>
              <Field label="Aprovado a partir de" hint="Data em que entrou no caixa (Financeiro Aprovado).">
                <input
                  type="date"
                  value={filtrosCaixa.dataInicio}
                  onChange={(e) => setFiltrosCaixa({ ...filtrosCaixa, dataInicio: e.target.value })}
                />
              </Field>
              <Field label="Aprovado até">
                <input
                  type="date"
                  value={filtrosCaixa.dataFim}
                  onChange={(e) => setFiltrosCaixa({ ...filtrosCaixa, dataFim: e.target.value })}
                />
              </Field>
              <Field label="Número da missão">
                <input
                  type="text"
                  value={filtrosCaixa.numero}
                  onChange={(e) => setFiltrosCaixa({ ...filtrosCaixa, numero: e.target.value })}
                  placeholder="Ex: 003"
                />
              </Field>
              <button className="btn btn-primary" onClick={pesquisarCaixa}>
                Pesquisar
              </button>
            </div>
            <h2>Lançamentos que compõem o caixa</h2>
            {aprovados.length === 0 ? (
              <div className="empty-state">Nenhum lançamento aprovado neste filtro.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Origem</th>
                      <th>Nome</th>
                      <th>Aprovado em</th>
                      <th>Recebido</th>
                      <th>Gasto</th>
                      <th>Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aprovados.map((l) => (
                      <tr key={l.id} style={{ cursor: "pointer" }} onClick={() => abrirDetalheLancamento(l)}>
                        <td>{l.tipo === "missao" ? "Missão" : "Projeto"}</td>
                        <td>{titulo(l)}</td>
                        <td>{formatDate(dataAprovacao(l))}</td>
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

          <div className="card">
            <h2>Provisões (previsão futura)</h2>
            <p className="hint">
              Tudo que ainda não é "Financeiro Aprovado": missões Aprovada/Finalizada sem lançamento ainda,
              lançamentos Em Andamento, Aprovação Pendente ou Financeiro Pendente.
            </p>
            <div className="filters-bar">
              <Field label="Data início">
                <input
                  type="date"
                  value={filtrosProvisao.dataInicio}
                  onChange={(e) => setFiltrosProvisao({ ...filtrosProvisao, dataInicio: e.target.value })}
                />
              </Field>
              <Field label="Data fim">
                <input
                  type="date"
                  value={filtrosProvisao.dataFim}
                  onChange={(e) => setFiltrosProvisao({ ...filtrosProvisao, dataFim: e.target.value })}
                />
              </Field>
              <Field label="Número da missão">
                <input
                  type="text"
                  value={filtrosProvisao.numero}
                  onChange={(e) => setFiltrosProvisao({ ...filtrosProvisao, numero: e.target.value })}
                  placeholder="Ex: 003"
                />
              </Field>
              <button className="btn btn-primary" onClick={pesquisarProvisao}>
                Pesquisar
              </button>
            </div>
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
              <div className="empty-state">Nenhuma provisão em aberto neste filtro.</div>
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
                      <tr key={r.key} style={{ cursor: "pointer" }} onClick={() => abrirDetalheRow(r)}>
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

      {detalhe && (
        <div className="modal-overlay" onClick={() => setDetalhe(null)}>
          <div className="modal-box modal-box-lg" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2>{detalhe.titulo}</h2>
              {detalhe.status && <StatusFinanceiroBadge status={detalhe.status} />}
            </div>

            <p>
              <strong>Enviado para Aprovação Financeira por:</strong> {quemEnviouAprovacao(detalhe.lancamento)}
              &nbsp;·&nbsp; <strong>Aprovado por:</strong> {quemAprovouFinanceiro(detalhe.lancamento)}
            </p>
            {(detalhe.quantidadeOperadores != null || detalhe.operadoresPresentes != null) && (
              <p>
                <strong>Qtde Operadores:</strong> {detalhe.quantidadeOperadores ?? "—"} &nbsp;·&nbsp;{" "}
                <strong>Operadores Presentes:</strong> {detalhe.operadoresPresentes ?? "—"}
              </p>
            )}

            {detalhe.lancamento ? (
              <>
                <h3 style={{ marginTop: 16 }}>Despesas</h3>
                {detalhe.lancamento.investimentos.length === 0 ? (
                  <p className="hint">Nenhuma despesa lançada.</p>
                ) : (
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
                        {detalhe.lancamento.investimentos.map((i) => (
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
                )}

                <h3 style={{ marginTop: 16 }}>Créditos</h3>
                {detalhe.lancamento.creditos.length === 0 ? (
                  <p className="hint">Nenhum crédito lançado.</p>
                ) : (
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
                        {detalhe.lancamento.creditos.map((c) => (
                          <tr key={c.id}>
                            <td>{formatDate(c.data)}</td>
                            <td>{c.descricao}</td>
                            <td>{formatBRL(c.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <p className="hint" style={{ marginTop: 16 }}>
                Ainda não há lançamento financeiro iniciado para esta missão.
              </p>
            )}

            <div className="btn-row">
              <button className="btn btn-secondary" onClick={() => setDetalhe(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
