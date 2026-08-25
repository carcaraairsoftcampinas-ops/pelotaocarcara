import React, { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { PageHeader } from "../../components/Layout";
import { Field, Banner } from "../../components/Field";
import { StatusFinanceiroBadge } from "../../components/StatusBadge";
import { api, ApiError } from "../../lib/api";
import { useActionNotice } from "../../lib/ActionNoticeContext";
import { buildMovimentacaoRows } from "../../lib/financeiroRows";
import type { MovimentacaoRow } from "../../lib/financeiroRows";
import { totalInvestimentos, totalCreditosItens, formatBRL, formatDate } from "../../../shared/calc";
import type { ItemInvestimento, ItemCredito, LancamentoFinanceiro, Missao, StatusFinanceiro } from "../../../shared/types";

const STATUS_OPCOES: StatusFinanceiro[] = ["Em Andamento", "Aprovação Pendente", "Financeiro Pendente"];

const EMPTY_FILTROS = {
  origem: "" as "" | "missao" | "projeto",
  dataInicio: "",
  dataFim: "",
  colaborador: "",
  nome: "",
  status: "",
};

export default function MovimentacaoFinanceira() {
  const { notify } = useActionNotice();
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filtros, setFiltros] = useState(EMPTY_FILTROS);
  const [filtrosAplicados, setFiltrosAplicados] = useState(EMPTY_FILTROS);

  // --- formulário (Lançar Projeto / iniciar ou editar lançamento de missão) ---
  const [formOpen, setFormOpen] = useState(false);
  const [formId, setFormId] = useState<string | null>(null);
  const [formTipo, setFormTipo] = useState<"missao" | "projeto">("projeto");
  const [formMissao, setFormMissao] = useState<Missao | null>(null);
  const [formStatus, setFormStatus] = useState<StatusFinanceiro>("Em Andamento");
  const [formObservacaoAprovacao, setFormObservacaoAprovacao] = useState("");
  const [nomeProjeto, setNomeProjeto] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [observacoesDados, setObservacoesDados] = useState("");
  const [investimentos, setInvestimentos] = useState<ItemInvestimento[]>([]);
  const [observacoesInvestimentos, setObservacoesInvestimentos] = useState("");
  const [creditos, setCreditos] = useState<ItemCredito[]>([]);
  const [saving, setSaving] = useState<"save" | "aprovacao" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [m, l] = await Promise.all([
        api.get<Missao[]>("/missoes"),
        api.get<LancamentoFinanceiro[]>("/financeiro"),
      ]);
      setMissoes(m);
      setLancamentos(l);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao carregar movimentação financeira.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const todasLinhas = useMemo(() => buildMovimentacaoRows(missoes, lancamentos), [missoes, lancamentos]);
  const linhasEmAberto = useMemo(() => todasLinhas.filter((r) => r.status !== "Financeiro Aprovado"), [todasLinhas]);

  const colaboradoresUnicos = useMemo(
    () => Array.from(new Set(linhasEmAberto.map((r) => r.colaboradorNome))).sort(),
    [linhasEmAberto]
  );

  const linhasFiltradas = useMemo(() => {
    const f = filtrosAplicados;
    return linhasEmAberto
      .filter((r) => (f.origem ? r.origem === f.origem : true))
      .filter((r) => (f.dataInicio ? r.data >= f.dataInicio : true))
      .filter((r) => (f.dataFim ? r.data <= f.dataFim : true))
      .filter((r) => (f.colaborador ? r.colaboradorNome === f.colaborador : true))
      .filter((r) => (f.nome ? r.nome.toLowerCase().includes(f.nome.toLowerCase()) : true))
      .filter((r) => (f.status ? r.status === f.status : true));
  }, [linhasEmAberto, filtrosAplicados]);

  function pesquisar() {
    setFiltrosAplicados(filtros);
  }

  function resetForm() {
    setFormId(null);
    setFormMissao(null);
    setFormStatus("Em Andamento");
    setFormObservacaoAprovacao("");
    setNomeProjeto("");
    setDataInicio("");
    setDataFinal("");
    setObservacoesDados("");
    setInvestimentos([]);
    setObservacoesInvestimentos("");
    setCreditos([]);
    setFormError(null);
  }

  function abrirNovoProjeto() {
    resetForm();
    setFormTipo("projeto");
    setFormOpen(true);
  }

  async function abrirLinha(row: MovimentacaoRow) {
    resetForm();
    setFormError(null);
    if (row.lancamentoId) {
      // já existe lançamento — carrega pra edição/visualização.
      try {
        const l = await api.get<LancamentoFinanceiro>(`/financeiro?id=${row.lancamentoId}`);
        setFormId(l.id);
        setFormTipo(l.tipo);
        setFormStatus(l.status);
        setFormObservacaoAprovacao(l.observacaoAprovacao);
        setNomeProjeto(l.nomeProjeto || "");
        setDataInicio(l.dataInicio || "");
        setDataFinal(l.dataFinal || "");
        setObservacoesDados(l.observacoesDados);
        setInvestimentos(l.investimentos);
        setObservacoesInvestimentos(l.observacoesInvestimentos);
        setCreditos(l.creditos);
        if (l.tipo === "missao" && l.missaoId) {
          const m = missoes.find((x) => x.id === l.missaoId) || null;
          setFormMissao(m);
        }
        setFormOpen(true);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Erro ao carregar lançamento.");
      }
    } else if (row.origem === "missao" && row.missaoId) {
      // missão ainda sem lançamento — inicia um novo, pré-preenchendo os
      // investimentos com os itens de compra já cadastrados na missão.
      const m = missoes.find((x) => x.id === row.missaoId) || null;
      setFormMissao(m);
      setFormTipo("missao");
      setFormStatus("Em Andamento");
      if (m) {
        setInvestimentos(m.itensCompra.map((i) => ({ id: uuidv4(), nome: i.nome, quantidade: i.quantidade, valorUnitario: i.valorUnitario })));
      }
      setFormOpen(true);
    }
  }

  function fecharForm() {
    setFormOpen(false);
    resetForm();
  }

  function addInvestimento() {
    setInvestimentos((prev) => [...prev, { id: uuidv4(), nome: "", quantidade: 1, valorUnitario: 0 }]);
  }
  function updateInvestimento(id: string, patch: Partial<ItemInvestimento>) {
    setInvestimentos((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  function removeInvestimento(id: string) {
    setInvestimentos((prev) => prev.filter((i) => i.id !== id));
  }

  function addCredito() {
    setCreditos((prev) => [...prev, { id: uuidv4(), data: "", descricao: "", valor: 0 }]);
  }
  function updateCredito(id: string, patch: Partial<ItemCredito>) {
    setCreditos((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function removeCredito(id: string) {
    setCreditos((prev) => prev.filter((c) => c.id !== id));
  }

  const totalInvest = totalInvestimentos(investimentos.filter((i) => i.nome.trim()));
  const totalCred = totalCreditosItens(creditos.filter((c) => c.valor > 0));
  const saldo = totalCred - totalInvest;

  const editavel = formStatus === "Em Andamento" || formStatus === "Financeiro Pendente";

  async function salvar(action: "save" | "aprovacao") {
    setFormError(null);
    if (formTipo === "projeto") {
      if (!nomeProjeto.trim()) return setFormError("Nome do Projeto é obrigatório.");
      if (!dataInicio) return setFormError("Data Início é obrigatória.");
      if (!dataFinal) return setFormError("Data Final é obrigatória.");
    }
    const investLimpos = investimentos.filter((i) => i.nome.trim());
    const creditLimpos = creditos.filter((c) => c.valor > 0);
    if (action === "aprovacao") {
      if (investLimpos.length === 0) return setFormError("Informe ao menos um item de investimento.");
      if (creditLimpos.length === 0) return setFormError("Informe ao menos uma linha de créditos.");
    }

    setSaving(action);
    try {
      const payload = {
        tipo: formTipo,
        missaoId: formTipo === "missao" ? formMissao?.id : null,
        nomeProjeto: formTipo === "projeto" ? nomeProjeto : null,
        dataInicio: formTipo === "projeto" ? dataInicio : null,
        dataFinal: formTipo === "projeto" ? dataFinal : null,
        observacoesDados,
        investimentos: investLimpos,
        observacoesInvestimentos,
        creditos: creditLimpos,
        action,
      };
      let saved: LancamentoFinanceiro;
      if (formId) {
        saved = await api.put<LancamentoFinanceiro>("/financeiro", { id: formId, ...payload });
      } else {
        saved = await api.post<LancamentoFinanceiro>("/financeiro", payload);
      }
      notify(
        action === "aprovacao"
          ? "Lançamento enviado para Aprovação Financeira com sucesso."
          : "Lançamento salvo com sucesso (Em Andamento)."
      );
      fecharForm();
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Erro ao salvar lançamento.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <PageHeader crumbs="Financeiro" title="Movimentação Financeira" />
      <Banner type="error">{error}</Banner>

      {!formOpen && (
        <div className="card">
          <div className="filters-bar">
            <Field label="Origem">
              <select value={filtros.origem} onChange={(e) => setFiltros({ ...filtros, origem: e.target.value as any })}>
                <option value="">Todas</option>
                <option value="missao">Missão</option>
                <option value="projeto">Projeto</option>
              </select>
            </Field>
            <Field label="Data início">
              <input type="date" value={filtros.dataInicio} onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })} />
            </Field>
            <Field label="Data fim">
              <input type="date" value={filtros.dataFim} onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })} />
            </Field>
            <Field label="Colaborador">
              <select value={filtros.colaborador} onChange={(e) => setFiltros({ ...filtros, colaborador: e.target.value })}>
                <option value="">Todos</option>
                {colaboradoresUnicos.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nome da Missão / Projeto">
              <input type="text" value={filtros.nome} onChange={(e) => setFiltros({ ...filtros, nome: e.target.value })} />
            </Field>
            <Field label="Status">
              <select value={filtros.status} onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}>
                <option value="">Todos</option>
                {STATUS_OPCOES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <button className="btn btn-primary" onClick={pesquisar}>
              Pesquisar
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ marginBottom: 0 }}>Missões e Projetos</h2>
            <button className="btn btn-primary" onClick={abrirNovoProjeto}>
              + Lançamento de Projetos
            </button>
          </div>

          {loading ? (
            <div className="spinner" />
          ) : linhasFiltradas.length === 0 ? (
            <div className="empty-state">Nenhum lançamento encontrado.</div>
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
                  {linhasFiltradas.map((r) => (
                    <tr key={r.key} style={{ cursor: "pointer" }} onClick={() => abrirLinha(r)}>
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
      )}

      {formOpen && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>
              {formTipo === "missao"
                ? formMissao
                  ? `${formMissao.nome} (${formMissao.numero || "—"})`
                  : "Lançamento de missão"
                : formId
                ? nomeProjeto || "Projeto"
                : "Novo Lançamento de Projeto"}
            </h2>
            {formId && <StatusFinanceiroBadge status={formStatus} />}
          </div>
          <Banner type="error">{formError}</Banner>

          <fieldset disabled={!editavel} style={{ border: "none", padding: 0, margin: 0 }}>
            <h3>Dados</h3>
            {formTipo === "projeto" ? (
              <>
                <div className="grid grid-2">
                  <Field label="Nome Projeto" required>
                    <input type="text" value={nomeProjeto} onChange={(e) => setNomeProjeto(e.target.value)} required />
                  </Field>
                </div>
                <div className="grid grid-2">
                  <Field label="Data Início" required>
                    <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required />
                  </Field>
                  <Field label="Data Final" required>
                    <input type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} required />
                  </Field>
                </div>
              </>
            ) : (
              formMissao && (
                <p>
                  <strong>Data da missão:</strong> {formatDate(formMissao.data)} &nbsp;·&nbsp;{" "}
                  <strong>Criado por:</strong> {formMissao.criadoPorNome}
                </p>
              )
            )}
            <Field label="Observações">
              <textarea value={observacoesDados} onChange={(e) => setObservacoesDados(e.target.value)} rows={2} />
            </Field>

            <h3 style={{ marginTop: 20 }}>Investimentos</h3>
            {investimentos.map((i) => (
              <div className="item-row" key={i.id}>
                <Field label="Nome do item">
                  <input type="text" value={i.nome} onChange={(e) => updateInvestimento(i.id, { nome: e.target.value })} />
                </Field>
                <Field label="Quantidade">
                  <input
                    type="number"
                    min={0}
                    value={i.quantidade}
                    onChange={(e) => updateInvestimento(i.id, { quantidade: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Valor unitário">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={i.valorUnitario}
                    onChange={(e) => updateInvestimento(i.id, { valorUnitario: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Total">
                  <input type="text" readOnly value={formatBRL(i.quantidade * i.valorUnitario)} />
                </Field>
                <button type="button" className="btn btn-secondary" onClick={() => removeInvestimento(i.id)}>
                  Remover
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary" onClick={addInvestimento}>
              + Adicionar item
            </button>
            <div className="summary-box">
              <span>Total investimentos</span>
              <span className="value">{formatBRL(totalInvest)}</span>
            </div>
            <Field label="Observações">
              <textarea value={observacoesInvestimentos} onChange={(e) => setObservacoesInvestimentos(e.target.value)} rows={2} />
            </Field>

            <h3 style={{ marginTop: 20 }}>Créditos</h3>
            {creditos.map((c) => (
              <div className="item-row" key={c.id}>
                <Field label="Data do recebimento">
                  <input type="date" value={c.data} onChange={(e) => updateCredito(c.id, { data: e.target.value })} />
                </Field>
                <Field label="Descrição">
                  <input type="text" value={c.descricao} onChange={(e) => updateCredito(c.id, { descricao: e.target.value })} />
                </Field>
                <Field label="Valor recebido">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={c.valor}
                    onChange={(e) => updateCredito(c.id, { valor: Number(e.target.value) })}
                  />
                </Field>
                <button type="button" className="btn btn-secondary" onClick={() => removeCredito(c.id)}>
                  Remover
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary" onClick={addCredito}>
              + Adicionar crédito
            </button>
            <div className="summary-box">
              <span>Total créditos</span>
              <span className="value">{formatBRL(totalCred)}</span>
            </div>

            <h3 style={{ marginTop: 20 }}>Fechamento</h3>
            <div className="summary-box" style={{ borderColor: "var(--gold-dim)" }}>
              <span>Saldo (créditos − investimentos)</span>
              <span className="value">{formatBRL(saldo)}</span>
            </div>

            {editavel && (
              <div className="btn-row">
                <button className="btn btn-secondary" disabled={!!saving} onClick={() => salvar("save")}>
                  {saving === "save" ? "Salvando…" : "Salvar"}
                </button>
                <button className="btn btn-primary" disabled={!!saving} onClick={() => salvar("aprovacao")}>
                  {saving === "aprovacao" ? "Enviando…" : "Aprovação Financeira"}
                </button>
              </div>
            )}
          </fieldset>

          {formObservacaoAprovacao && (
            <>
              <h3 style={{ marginTop: 16 }}>Observação da última análise</h3>
              <div className="readonly-block">{formObservacaoAprovacao}</div>
            </>
          )}
          {!editavel && formStatus === "Financeiro Aprovado" && (
            <p className="hint">Lançamento aprovado — não pode mais ser alterado.</p>
          )}

          <div className="btn-row">
            <button className="btn btn-secondary" onClick={fecharForm}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
