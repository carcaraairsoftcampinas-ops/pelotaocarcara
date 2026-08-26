import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/Layout";
import { Field, Banner } from "../components/Field";
import { SortableTh } from "../components/SortableTh";
import { useSort } from "../lib/useSort";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { useActionNotice } from "../lib/ActionNoticeContext";
import { formatDate } from "../../shared/calc";
import type { LogEntry } from "../../shared/types";

type SortField = "data" | "tipo" | "referencia" | "acao" | "detalhes" | "responsavel";

const EMPTY_FILTROS = {
  entidadeTipo: "" as "" | "missao" | "financeiro",
  dataInicio: "",
  dataFim: "",
  busca: "",
};

function formatDataHora(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return formatDate(iso);
  return `${formatDate(iso)} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function Logs() {
  const { has } = useAuth();
  const { notify } = useActionNotice();
  const podeEditar = has("Administrador");

  const [lista, setLista] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filtros, setFiltros] = useState(EMPTY_FILTROS);
  const [filtrosAplicados, setFiltrosAplicados] = useState(EMPTY_FILTROS);

  const [editando, setEditando] = useState<LogEntry | null>(null);
  const [detalhesEdit, setDetalhesEdit] = useState("");
  const [saving, setSaving] = useState(false);
  const { sort, toggleSort, ordenar } = useSort<SortField>();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setLista(await api.get<LogEntry[]>("/logs"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao carregar logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function pesquisar() {
    setFiltrosAplicados(filtros);
  }

  const listaFiltrada = useMemo(() => {
    const f = filtrosAplicados;
    return lista
      .filter((l) => (f.entidadeTipo ? l.entidadeTipo === f.entidadeTipo : true))
      .filter((l) => (f.dataInicio ? l.data.slice(0, 10) >= f.dataInicio : true))
      .filter((l) => (f.dataFim ? l.data.slice(0, 10) <= f.dataFim : true))
      .filter((l) => (f.busca ? l.entidadeNome.toLowerCase().includes(f.busca.toLowerCase()) : true));
  }, [lista, filtrosAplicados]);

  function valorOrdenavel(l: LogEntry, field: SortField): string | number {
    switch (field) {
      case "data":
        return l.data;
      case "tipo":
        return l.entidadeTipo;
      case "referencia":
        return l.entidadeNome;
      case "acao":
        return l.acao;
      case "detalhes":
        return l.detalhes || "";
      case "responsavel":
        return l.colaboradorNome;
    }
  }

  const listaOrdenada = useMemo(() => ordenar(listaFiltrada, valorOrdenavel), [listaFiltrada, sort]);

  function abrirEdicao(l: LogEntry) {
    setEditando(l);
    setDetalhesEdit(l.detalhes);
  }

  async function salvarEdicao() {
    if (!editando) return;
    setSaving(true);
    try {
      await api.put<LogEntry>("/logs", { id: editando.id, detalhes: detalhesEdit });
      notify("Registro de log atualizado com sucesso.");
      setEditando(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao atualizar o log.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader crumbs="Auditoria" title="Logs" />
      <Banner type="error">{error}</Banner>
      <p className="hint" style={{ marginTop: -10 }}>
        Registro de auditoria de todas as alterações em Missões e Financeiro (missões e projetos). Todos os
        perfis podem visualizar; só o Administrador pode corrigir o texto de um registro já existente.
      </p>

      <div className="card">
        <div className="filters-bar">
          <Field label="Tipo">
            <select
              value={filtros.entidadeTipo}
              onChange={(e) => setFiltros({ ...filtros, entidadeTipo: e.target.value as any })}
            >
              <option value="">Todos</option>
              <option value="missao">Missão</option>
              <option value="financeiro">Financeiro</option>
            </select>
          </Field>
          <Field label="Data início">
            <input type="date" value={filtros.dataInicio} onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })} />
          </Field>
          <Field label="Data fim">
            <input type="date" value={filtros.dataFim} onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })} />
          </Field>
          <Field label="Nome / Número">
            <input
              type="text"
              value={filtros.busca}
              onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
              placeholder="Ex: 003 ou nome da missão/projeto"
            />
          </Field>
          <button className="btn btn-primary" onClick={pesquisar}>
            Pesquisar
          </button>
        </div>

        {loading ? (
          <div className="spinner" />
        ) : listaFiltrada.length === 0 ? (
          <div className="empty-state">Nenhum registro de log encontrado.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <SortableTh field="data" sort={sort} onSort={toggleSort}>Data/Hora</SortableTh>
                  <SortableTh field="tipo" sort={sort} onSort={toggleSort}>Tipo</SortableTh>
                  <SortableTh field="referencia" sort={sort} onSort={toggleSort}>Referência</SortableTh>
                  <SortableTh field="acao" sort={sort} onSort={toggleSort}>Ação</SortableTh>
                  <SortableTh field="detalhes" sort={sort} onSort={toggleSort}>Detalhes</SortableTh>
                  <SortableTh field="responsavel" sort={sort} onSort={toggleSort}>Responsável</SortableTh>
                  {podeEditar && <th></th>}
                </tr>
              </thead>
              <tbody>
                {listaOrdenada.map((l) => (
                  <tr key={l.id}>
                    <td>{formatDataHora(l.data)}</td>
                    <td>{l.entidadeTipo === "missao" ? "Missão" : "Financeiro"}</td>
                    <td>{l.entidadeNome}</td>
                    <td>{l.acao}</td>
                    <td>{l.detalhes || "—"}</td>
                    <td>{l.colaboradorNome}</td>
                    {podeEditar && (
                      <td>
                        <button className="link-btn" onClick={() => abrirEdicao(l)}>
                          Editar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2>Corrigir registro de log</h2>
            <p className="hint" style={{ marginTop: -6 }}>
              {editando.acao} — {editando.entidadeNome} — {formatDataHora(editando.data)} — {editando.colaboradorNome}
            </p>
            <Field label="Detalhes">
              <textarea value={detalhesEdit} onChange={(e) => setDetalhesEdit(e.target.value)} rows={4} />
            </Field>
            <div className="btn-row" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setEditando(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" disabled={saving} onClick={salvarEdicao}>
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
