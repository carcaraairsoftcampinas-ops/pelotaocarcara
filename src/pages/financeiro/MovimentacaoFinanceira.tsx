import React, { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { PageHeader } from "../../components/Layout";
import { Field, Banner } from "../../components/Field";
import { StatusFinanceiroBadge } from "../../components/StatusBadge";
import { SortableTh } from "../../components/SortableTh";
import { useSort } from "../../lib/useSort";
import { api, ApiError } from "../../lib/api";
import { useActionNotice } from "../../lib/ActionNoticeContext";
import { buildMovimentacaoRows } from "../../lib/financeiroRows";
import type { MovimentacaoRow } from "../../lib/financeiroRows";

type LinhaSortField = "status" | "origem" | "nome" | "data" | "colaborador" | "operadores" | "presentes" | "fechamento";
import { totalInvestimentos, totalCreditosItens, totalPedidos, formatBRL, formatDate } from "../../../shared/calc";
import { TAMANHOS_PEDIDO } from "../../../shared/types";
import type {
  ItemInvestimento,
  ItemCredito,
  ItemPedido,
  TamanhoPedido,
  Produto,
  LancamentoFinanceiro,
  Missao,
  StatusFinanceiro,
} from "../../../shared/types";

type PedidoSortField = "nomeOperador" | "tamanho" | "produtoNome" | "quantidade" | "valorUnitario";

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
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filtros, setFiltros] = useState(EMPTY_FILTROS);
  const [filtrosAplicados, setFiltrosAplicados] = useState(EMPTY_FILTROS);
  const { sort: linhaSort, toggleSort: toggleLinhaSort, ordenar: ordenarLinhas } = useSort<LinhaSortField>();

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
  const [temPedido, setTemPedido] = useState(false);
  const [pedidos, setPedidos] = useState<ItemPedido[]>([]);
  const [pedidoSort, setPedidoSort] = useState<{ field: PedidoSortField; dir: "asc" | "desc" } | null>(null);
  const [saving, setSaving] = useState<"save" | "aprovacao" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [marcandoComprado, setMarcandoComprado] = useState<string | null>(null);

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
    api.get<Produto[]>("/produtos?apenasAtivos=1").then(setProdutos).catch(() => {});
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

  function valorOrdenavelLinha(r: MovimentacaoRow, field: LinhaSortField): string | number {
    switch (field) {
      case "status":
        return r.status;
      case "origem":
        return r.origem;
      case "nome":
        return r.nome;
      case "data":
        return r.data;
      case "colaborador":
        return r.colaboradorNome;
      case "operadores":
        return r.quantidadeOperadores ?? -1;
      case "presentes":
        return r.operadoresPresentes ?? -1;
      case "fechamento":
        return r.fechamento;
    }
  }

  const linhasOrdenadas = useMemo(
    () => ordenarLinhas(linhasFiltradas, valorOrdenavelLinha),
    [linhasFiltradas, linhaSort]
  );

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
    setTemPedido(false);
    setPedidos([]);
    setPedidoSort(null);
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
        setTemPedido(l.temPedido);
        setPedidos(l.pedidos);
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
    setInvestimentos((prev) => [
      ...prev,
      { id: uuidv4(), nome: "", quantidade: 1, valorUnitario: 0, data: "", recebido: false },
    ]);
  }
  function updateInvestimento(id: string, patch: Partial<ItemInvestimento>) {
    setInvestimentos((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  function removeInvestimento(id: string) {
    setInvestimentos((prev) => prev.filter((i) => i.id !== id));
  }

  function addCredito() {
    setCreditos((prev) => [...prev, { id: uuidv4(), data: "", descricao: "", valor: 0, recebido: false }]);
  }
  function updateCredito(id: string, patch: Partial<ItemCredito>) {
    setCreditos((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function removeCredito(id: string) {
    setCreditos((prev) => prev.filter((c) => c.id !== id));
  }

  function addPedido() {
    setPedidos((prev) => [
      ...prev,
      {
        id: uuidv4(),
        nomeOperador: "",
        tamanho: "",
        produtoId: "",
        produtoNome: "",
        quantidade: 1,
        valorUnitario: 0,
        recebido: false,
      },
    ]);
  }
  function updatePedido(id: string, patch: Partial<ItemPedido>) {
    setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function removePedido(id: string) {
    setPedidos((prev) => prev.filter((p) => p.id !== id));
  }
  function togglePedidoSort(field: PedidoSortField) {
    setPedidoSort((prev) => (prev?.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "asc" }));
  }
  function pedidoArrow(field: PedidoSortField) {
    return pedidoSort?.field === field ? (pedidoSort.dir === "asc" ? " ▲" : " ▼") : "";
  }

  const pedidosOrdenados = useMemo(() => {
    if (!pedidoSort) return pedidos;
    const { field, dir } = pedidoSort;
    const copy = [...pedidos];
    copy.sort((a, b) => {
      const va = a[field];
      const vb = b[field];
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [pedidos, pedidoSort]);

  const totalInvest = totalInvestimentos(investimentos.filter((i) => i.nome.trim()));
  const totalCred = totalCreditosItens(creditos.filter((c) => c.valor > 0));
  const totalPedidosValor = totalPedidos(pedidos.filter((p) => p.nomeOperador.trim() && p.produtoId));
  const totalRecebido = temPedido ? totalPedidosValor : totalCred;
  const saldo = totalRecebido - totalInvest;

  const editavel = formStatus === "Em Andamento" || formStatus === "Financeiro Pendente";

  async function marcarComprado(itemId: string, comprado: boolean) {
    if (!formMissao) return;
    setMarcandoComprado(itemId);
    try {
      const atualizada = await api.put<Missao>("/missoes", {
        id: formMissao.id,
        action: "marcarComprado",
        itemCompraId: itemId,
        comprado,
      });
      setFormMissao(atualizada);
      setMissoes((prev) => prev.map((m) => (m.id === atualizada.id ? atualizada : m)));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Erro ao marcar item como comprado.");
    } finally {
      setMarcandoComprado(null);
    }
  }

  function camposFaltando(action: "save" | "aprovacao"): string[] {
    const faltando: string[] = [];
    if (formTipo === "projeto") {
      if (!nomeProjeto.trim()) faltando.push("Nome do Projeto");
      if (!dataInicio) faltando.push("Data Início");
      if (!dataFinal) faltando.push("Data Final");
    }
    if (action === "aprovacao") {
      const investLimpos = investimentos.filter((i) => i.nome.trim());
      const creditLimpos = creditos.filter((c) => c.valor > 0);
      const pedidosLimpos = pedidos.filter((p) => p.nomeOperador.trim() && p.produtoId);
      const usaPedido = formTipo === "projeto" && temPedido;
      const temDespesa = investLimpos.length > 0;
      const temRecebimento = usaPedido ? pedidosLimpos.length > 0 : creditLimpos.length > 0;
      // Só precisa ter UMA despesa OU UM crédito/pedido — não é obrigatório ter os dois.
      if (!temDespesa && !temRecebimento) {
        faltando.push(usaPedido ? "Ao menos uma Despesa ou um Pedido" : "Ao menos uma Despesa ou um Crédito");
      }
    }
    return faltando;
  }

  async function salvar(action: "save" | "aprovacao") {
    setFormError(null);
    const faltando = camposFaltando(action);
    if (faltando.length > 0) {
      notify(
        `Preencha os campos obrigatórios antes de ${
          action === "aprovacao" ? "enviar para Aprovação Financeira" : "salvar"
        }:\n\n${faltando.map((f) => `• ${f}`).join("\n")}`
      );
      return;
    }
    const investLimpos = investimentos.filter((i) => i.nome.trim());
    const creditLimpos = creditos.filter((c) => c.valor > 0);
    const pedidosLimpos = pedidos.filter((p) => p.nomeOperador.trim() && p.produtoId);
    const usaPedido = formTipo === "projeto" && temPedido;

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
        temPedido: usaPedido,
        pedidos: usaPedido ? pedidosLimpos : [],
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
                    <SortableTh field="status" sort={linhaSort} onSort={toggleLinhaSort}>Status</SortableTh>
                    <SortableTh field="origem" sort={linhaSort} onSort={toggleLinhaSort}>Origem</SortableTh>
                    <SortableTh field="nome" sort={linhaSort} onSort={toggleLinhaSort}>Nome</SortableTh>
                    <SortableTh field="data" sort={linhaSort} onSort={toggleLinhaSort}>Data</SortableTh>
                    <SortableTh field="colaborador" sort={linhaSort} onSort={toggleLinhaSort}>Colaborador</SortableTh>
                    <SortableTh field="operadores" sort={linhaSort} onSort={toggleLinhaSort}>Qtde Operadores</SortableTh>
                    <SortableTh field="presentes" sort={linhaSort} onSort={toggleLinhaSort}>Operadores Presentes</SortableTh>
                    <SortableTh field="fechamento" sort={linhaSort} onSort={toggleLinhaSort}>Fechamento</SortableTh>
                  </tr>
                </thead>
                <tbody>
                  {linhasOrdenadas.map((r) => (
                    <tr key={r.key} style={{ cursor: "pointer" }} onClick={() => abrirLinha(r)}>
                      <td>
                        <StatusFinanceiroBadge status={r.status} />
                      </td>
                      <td>{r.origem === "missao" ? "Missão" : "Projeto"}</td>
                      <td>{r.nome}</td>
                      <td>{formatDate(r.data)}</td>
                      <td>{r.colaboradorNome}</td>
                      <td>{r.quantidadeOperadores ?? "—"}</td>
                      <td>{r.operadoresPresentes ?? "—"}</td>
                      <td style={{ color: r.fechamento >= 0 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
                        {formatBRL(r.fechamento)}
                      </td>
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
                <Field label="Vai ter pedido?">
                  <label style={{ display: "flex", alignItems: "center", gap: 8, height: 38 }}>
                    <input type="checkbox" checked={temPedido} onChange={(e) => setTemPedido(e.target.checked)} />
                    Substitui o bloco Créditos por um bloco de Pedidos
                  </label>
                </Field>
              </>
            ) : (
              formMissao && (
                <p>
                  <strong>Data da missão:</strong> {formatDate(formMissao.data)} &nbsp;·&nbsp;{" "}
                  <strong>Criado por:</strong> {formMissao.criadoPorNome} &nbsp;·&nbsp;{" "}
                  <strong>Qtde Operadores:</strong> {formMissao.quantidadeOperadores ?? "—"} &nbsp;·&nbsp;{" "}
                  <strong>Operadores Presentes:</strong> {formMissao.avaliacao?.totalOperadoresPresentes ?? "—"}
                </p>
              )
            )}
            <Field label="Observações">
              <textarea value={observacoesDados} onChange={(e) => setObservacoesDados(e.target.value)} rows={2} />
            </Field>

            <h3 style={{ marginTop: 20 }}>Despesas</h3>
            {investimentos.map((i) => (
              <div key={i.id} style={{ marginBottom: 14 }}>
                <div className="item-row">
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
                <div className="grid grid-2">
                  <Field label="Data da despesa">
                    <input type="date" value={i.data || ""} onChange={(e) => updateInvestimento(i.id, { data: e.target.value })} />
                  </Field>
                  <Field label="Recebido">
                    <label style={{ display: "flex", alignItems: "center", gap: 8, height: 38 }}>
                      <input
                        type="checkbox"
                        checked={!!i.recebido}
                        onChange={(e) => updateInvestimento(i.id, { recebido: e.target.checked })}
                      />
                      Já recebido/pago
                    </label>
                  </Field>
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-secondary" onClick={addInvestimento}>
              + Adicionar item
            </button>
            <div className="summary-box">
              <span>Total despesas</span>
              <span className="value" style={{ color: "var(--orange)" }}>{formatBRL(totalInvest)}</span>
            </div>
            <Field label="Observações">
              <textarea value={observacoesInvestimentos} onChange={(e) => setObservacoesInvestimentos(e.target.value)} rows={2} />
            </Field>

            {formTipo === "projeto" && temPedido ? (
              <>
                <h3 style={{ marginTop: 20 }}>Pedidos</h3>
                {pedidos.length === 0 ? (
                  <p className="hint">Nenhum pedido adicionado ainda.</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => togglePedidoSort("nomeOperador")}>
                            Nome do Operador{pedidoArrow("nomeOperador")}
                          </th>
                          <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => togglePedidoSort("tamanho")}>
                            Tamanho{pedidoArrow("tamanho")}
                          </th>
                          <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => togglePedidoSort("produtoNome")}>
                            Produto{pedidoArrow("produtoNome")}
                          </th>
                          <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => togglePedidoSort("quantidade")}>
                            Quantidade{pedidoArrow("quantidade")}
                          </th>
                          <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => togglePedidoSort("valorUnitario")}>
                            Valor unit.{pedidoArrow("valorUnitario")}
                          </th>
                          <th>Total</th>
                          <th>Recebido</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pedidosOrdenados.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <input
                                type="text"
                                value={p.nomeOperador}
                                onChange={(e) => updatePedido(p.id, { nomeOperador: e.target.value })}
                              />
                            </td>
                            <td>
                              <select
                                value={p.tamanho}
                                onChange={(e) => updatePedido(p.id, { tamanho: e.target.value as TamanhoPedido | "" })}
                              >
                                <option value="">—</option>
                                {TAMANHOS_PEDIDO.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <select
                                value={p.produtoId}
                                onChange={(e) => {
                                  const prod = produtos.find((x) => x.id === e.target.value);
                                  updatePedido(p.id, { produtoId: e.target.value, produtoNome: prod?.nome || "" });
                                }}
                              >
                                <option value="">Selecione</option>
                                {produtos.map((prod) => (
                                  <option key={prod.id} value={prod.id}>
                                    {prod.nome}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                min={0}
                                value={p.quantidade}
                                onChange={(e) => updatePedido(p.id, { quantidade: Number(e.target.value) })}
                                style={{ width: 70 }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={p.valorUnitario}
                                onChange={(e) => updatePedido(p.id, { valorUnitario: Number(e.target.value) })}
                                style={{ width: 90 }}
                              />
                            </td>
                            <td>{formatBRL(p.quantidade * p.valorUnitario)}</td>
                            <td style={{ textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={!!p.recebido}
                                onChange={(e) => updatePedido(p.id, { recebido: e.target.checked })}
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="link-btn"
                                style={{ color: "#ff8080" }}
                                onClick={() => removePedido(p.id)}
                              >
                                Remover
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <button type="button" className="btn btn-secondary" onClick={addPedido} style={{ marginTop: 10 }}>
                  + Adicionar pedido
                </button>
                <div className="summary-box" style={{ marginTop: 10 }}>
                  <span>Total de pedidos</span>
                  <span className="value" style={{ color: "var(--blue)" }}>{formatBRL(totalPedidosValor)}</span>
                </div>
              </>
            ) : (
              <>
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
                    <Field label="Recebido">
                      <label style={{ display: "flex", alignItems: "center", gap: 8, height: 38 }}>
                        <input
                          type="checkbox"
                          checked={!!c.recebido}
                          onChange={(e) => updateCredito(c.id, { recebido: e.target.checked })}
                        />
                        Confirmado
                      </label>
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
                  <span className="value" style={{ color: "var(--blue)" }}>{formatBRL(totalCred)}</span>
                </div>
              </>
            )}

            <h3 style={{ marginTop: 20 }}>Fechamento</h3>
            <div className="summary-box" style={{ borderColor: "var(--gold-dim)" }}>
              <span>Saldo ({formTipo === "projeto" && temPedido ? "pedidos" : "créditos"} − despesas)</span>
              <span className="value" style={{ color: saldo >= 0 ? "var(--green)" : "var(--red)" }}>
                {formatBRL(saldo)}
              </span>
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

          {formTipo === "missao" && formMissao && formMissao.itensCompra.length > 0 && (
            <>
              <h3 style={{ marginTop: 20 }}>Itens de compra da missão</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qtd</th>
                      <th>Valor unit.</th>
                      <th>Total</th>
                      <th>Link de compra</th>
                      <th>Comprado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formMissao.itensCompra.map((i) => (
                      <tr key={i.id}>
                        <td>{i.nome}</td>
                        <td>{i.quantidade}</td>
                        <td>{formatBRL(i.valorUnitario)}</td>
                        <td>{formatBRL(i.quantidade * i.valorUnitario)}</td>
                        <td>
                          {i.link ? (
                            <a href={i.link} target="_blank" rel="noreferrer">
                              Abrir link
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!i.comprado}
                            disabled={marcandoComprado === i.id || formMissao.status === "Finalizada"}
                            onChange={(e) => marcarComprado(i.id, e.target.checked)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="hint">
                {formMissao.status === "Finalizada"
                  ? "Missão Finalizada — os itens de compra não podem mais ser alterados."
                  : "Marque os itens conforme forem comprados. Isso não depende do status do lançamento."}
              </p>
            </>
          )}

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
