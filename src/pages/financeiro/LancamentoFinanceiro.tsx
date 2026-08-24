import React, { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { PageHeader } from "../../components/Layout";
import { Field, Banner } from "../../components/Field";
import { StatusFinanceiroBadge } from "../../components/StatusBadge";
import { api, ApiError } from "../../lib/api";
import { totalCreditos, totalGastos, resultadoLancamento, formatBRL, formatDate } from "../../../shared/calc";
import type { ItemGasto, LancamentoFinanceiro as Lancamento, Missao } from "../../../shared/types";

const EMPTY_CREDITOS = { pix: 0, especie: 0, outros: 0 };

export default function LancamentoFinanceiroPage() {
  const [lista, setLista] = useState<Lancamento[]>([]);
  const [missoesFinalizadas, setMissoesFinalizadas] = useState<Missao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [novo, setNovo] = useState(false);
  const [tipo, setTipo] = useState<"missao" | "projeto">("missao");
  const [missaoId, setMissaoId] = useState("");
  const [nomeProjeto, setNomeProjeto] = useState("");
  const [creditos, setCreditos] = useState(EMPTY_CREDITOS);
  const [gastos, setGastos] = useState<ItemGasto[]>([]);
  const [saving, setSaving] = useState<"save" | "submit" | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [l, m] = await Promise.all([
        api.get<Lancamento[]>("/financeiro"),
        api.get<Missao[]>("/missoes"),
      ]);
      setLista(l);
      setMissoesFinalizadas(m.filter((x) => x.status === "Finalizada"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao carregar lançamentos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function iniciarNovo() {
    setNovo(true);
    setEditando(null);
    setTipo("missao");
    setMissaoId("");
    setNomeProjeto("");
    setCreditos(EMPTY_CREDITOS);
    setGastos([]);
    setError(null);
    setSuccess(null);
  }

  function abrirExistente(l: Lancamento) {
    setNovo(false);
    setEditando(l);
    setTipo(l.tipo);
    setMissaoId(l.missaoId || "");
    setNomeProjeto(l.nomeProjeto || "");
    setCreditos(l.creditos);
    setGastos(l.gastos);
    setError(null);
    setSuccess(null);
  }

  function fechar() {
    setNovo(false);
    setEditando(null);
  }

  const editavel = novo || (editando && (editando.status === "Rascunho" || editando.status === "Reprovado"));

  function addGasto() {
    setGastos((prev) => [...prev, { id: uuidv4(), nome: "", quantidade: 1, valorUnitario: 0 }]);
  }

  function updateGasto(id: string, patch: Partial<ItemGasto>) {
    setGastos((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  async function salvar(action: "save" | "submit") {
    setSaving(action);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        tipo,
        missaoId: tipo === "missao" ? missaoId : null,
        nomeProjeto: tipo === "projeto" ? nomeProjeto : null,
        creditos,
        gastos,
        action,
      };
      let saved: Lancamento;
      if (editando) {
        saved = await api.put<Lancamento>("/financeiro", { id: editando.id, ...payload });
      } else {
        saved = await api.post<Lancamento>("/financeiro", payload);
      }
      setSuccess(action === "submit" ? "Lançamento enviado para análise financeira." : "Lançamento salvo.");
      setEditando(saved);
      setNovo(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao salvar lançamento.");
    } finally {
      setSaving(null);
    }
  }

  const somaCreditos = totalCreditos(creditos);
  const somaGastos = totalGastos(gastos);
  const resultado = somaCreditos - somaGastos;

  function tituloLancamento(l: Lancamento): string {
    if (l.tipo === "missao") {
      const m = missoesFinalizadas.find((x) => x.id === l.missaoId);
      return m ? `${m.nome} (${m.numero})` : "Missão";
    }
    return l.nomeProjeto || "Projeto";
  }

  return (
    <div>
      <PageHeader crumbs="Financeiro" title="Lançamento Financeiro" />
      <Banner type="error">{error}</Banner>

      {!novo && !editando && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ marginBottom: 0 }}>Lançamentos</h2>
            <button className="btn btn-primary" onClick={iniciarNovo}>
              + Novo lançamento
            </button>
          </div>
          {loading ? (
            <div className="spinner" />
          ) : lista.length === 0 ? (
            <div className="empty-state">Nenhum lançamento ainda.</div>
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
                    <tr key={l.id} style={{ cursor: "pointer" }} onClick={() => abrirExistente(l)}>
                      <td>
                        <StatusFinanceiroBadge status={l.status} />
                      </td>
                      <td>{tituloLancamento(l)}</td>
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
      )}

      {(novo || editando) && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>{novo ? "Novo lançamento" : tituloLancamento(editando!)}</h2>
            {editando && <StatusFinanceiroBadge status={editando.status} />}
          </div>
          <Banner type="success">{success}</Banner>

          <fieldset disabled={!editavel} style={{ border: "none", padding: 0, margin: 0 }}>
            <div className="grid grid-2">
              <Field label="Tipo" required>
                <select value={tipo} onChange={(e) => setTipo(e.target.value as "missao" | "projeto")}>
                  <option value="missao">Missão (já avaliada)</option>
                  <option value="projeto">Projeto avulso</option>
                </select>
              </Field>
              {tipo === "missao" ? (
                <Field label="Missão" required>
                  <select value={missaoId} onChange={(e) => setMissaoId(e.target.value)}>
                    <option value="">Selecione…</option>
                    {missoesFinalizadas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome} ({m.numero})
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="Nome do projeto" required>
                  <input type="text" value={nomeProjeto} onChange={(e) => setNomeProjeto(e.target.value)} />
                </Field>
              )}
            </div>

            <h3>Valores recebidos</h3>
            <div className="grid grid-3">
              <Field label="PIX">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={creditos.pix}
                  onChange={(e) => setCreditos({ ...creditos, pix: Number(e.target.value) })}
                />
              </Field>
              <Field label="Espécie">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={creditos.especie}
                  onChange={(e) => setCreditos({ ...creditos, especie: Number(e.target.value) })}
                />
              </Field>
              <Field label="Outros">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={creditos.outros}
                  onChange={(e) => setCreditos({ ...creditos, outros: Number(e.target.value) })}
                />
              </Field>
            </div>
            <div className="summary-box">
              <span>Total recebido</span>
              <span className="value">{formatBRL(somaCreditos)}</span>
            </div>

            <h3 style={{ marginTop: 20 }}>Valores gastos</h3>
            {gastos.map((g) => (
              <div className="item-row" key={g.id}>
                <Field label="Nome do item">
                  <input type="text" value={g.nome} onChange={(e) => updateGasto(g.id, { nome: e.target.value })} />
                </Field>
                <Field label="Quantidade">
                  <input
                    type="number"
                    min={0}
                    value={g.quantidade}
                    onChange={(e) => updateGasto(g.id, { quantidade: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Valor unitário">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={g.valorUnitario}
                    onChange={(e) => updateGasto(g.id, { valorUnitario: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Total">
                  <input type="text" readOnly value={formatBRL(g.quantidade * g.valorUnitario)} />
                </Field>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setGastos((prev) => prev.filter((x) => x.id !== g.id))}
                >
                  Remover
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary" onClick={addGasto}>
              + Adicionar item
            </button>
            <div className="summary-box">
              <span>Total gasto</span>
              <span className="value">{formatBRL(somaGastos)}</span>
            </div>

            <div className="summary-box" style={{ borderColor: "var(--gold-dim)" }}>
              <span>Resultado (crédito − gasto)</span>
              <span className="value">{formatBRL(resultado)}</span>
            </div>

            {editavel && (
              <div className="btn-row">
                <button className="btn btn-secondary" disabled={!!saving} onClick={() => salvar("save")}>
                  {saving === "save" ? "Salvando…" : "Salvar"}
                </button>
                <button className="btn btn-primary" disabled={!!saving} onClick={() => salvar("submit")}>
                  {saving === "submit" ? "Enviando…" : "Enviar para Análise Financeira"}
                </button>
              </div>
            )}
          </fieldset>

          {editando?.observacaoAprovacao && (
            <>
              <h3 style={{ marginTop: 16 }}>Observação da aprovação</h3>
              <div className="readonly-block">{editando.observacaoAprovacao}</div>
            </>
          )}

          <div className="btn-row">
            <button className="btn btn-secondary" onClick={fechar}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
