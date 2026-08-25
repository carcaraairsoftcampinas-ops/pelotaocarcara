import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/Layout";
import { Field, Banner } from "../../components/Field";
import { api, ApiError } from "../../lib/api";
import { GRUPOS_WHATSAPP, PATCHES } from "../../../shared/types";
import type { Operador } from "../../../shared/types";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const EMPTY_FILTROS = {
  dataInicio: "",
  dataFim: "",
  aniversarioMes: "",
  grupoWhatsapp: "",
  patch: "",
  operadorMilsim: "",
};

export default function ListaOperadores() {
  const [lista, setLista] = useState<Operador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState(EMPTY_FILTROS);
  const [filtrosAplicados, setFiltrosAplicados] = useState(EMPTY_FILTROS);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setLista(await api.get<Operador[]>("/operadores"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao carregar operadores.");
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
      .filter((o) => (f.dataInicio ? o.createdAt.slice(0, 10) >= f.dataInicio : true))
      .filter((o) => (f.dataFim ? o.createdAt.slice(0, 10) <= f.dataFim : true))
      .filter((o) => (f.aniversarioMes ? o.aniversarioMes === Number(f.aniversarioMes) : true))
      .filter((o) => (f.grupoWhatsapp ? o.grupoWhatsapp === f.grupoWhatsapp : true))
      .filter((o) => (f.patch ? o.patch === f.patch : true))
      .filter((o) => (f.operadorMilsim ? o.operadorMilsim === (f.operadorMilsim === "Sim") : true));
  }, [lista, filtrosAplicados]);

  return (
    <div>
      <PageHeader crumbs="Operadores" title="Lista de Operadores" />
      <Banner type="error">{error}</Banner>

      <div className="card">
        <div className="filters-bar">
          <Field label="Cadastro — data início">
            <input type="date" value={filtros.dataInicio} onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })} />
          </Field>
          <Field label="Cadastro — data fim">
            <input type="date" value={filtros.dataFim} onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })} />
          </Field>
          <Field label="Aniversariante do mês">
            <select value={filtros.aniversarioMes} onChange={(e) => setFiltros({ ...filtros, aniversarioMes: e.target.value })}>
              <option value="">Todos</option>
              {MESES.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Grupo WhatsApp">
            <select value={filtros.grupoWhatsapp} onChange={(e) => setFiltros({ ...filtros, grupoWhatsapp: e.target.value })}>
              <option value="">Todos</option>
              {GRUPOS_WHATSAPP.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Patch">
            <select value={filtros.patch} onChange={(e) => setFiltros({ ...filtros, patch: e.target.value })}>
              <option value="">Todos</option>
              {PATCHES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Operador Milsim">
            <select value={filtros.operadorMilsim} onChange={(e) => setFiltros({ ...filtros, operadorMilsim: e.target.value })}>
              <option value="">Todos</option>
              <option value="Sim">Sim</option>
              <option value="Não">Não</option>
            </select>
          </Field>
          <button className="btn btn-primary" onClick={pesquisar}>
            Pesquisar
          </button>
        </div>

        <h2>Operadores cadastrados</h2>
        {loading ? (
          <div className="spinner" />
        ) : listaFiltrada.length === 0 ? (
          <div className="empty-state">Nenhum operador encontrado.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nome</th>
                  <th>Nome na lista</th>
                  <th>Aniversário</th>
                  <th>E-mail</th>
                  <th>Telefone</th>
                  <th>Grupo WhatsApp</th>
                  <th>Patch</th>
                  <th>Milsim</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((o) => (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>
                      {o.nome} {o.sobrenome}
                    </td>
                    <td>{o.nomeNaLista}</td>
                    <td>{o.aniversarioDia && o.aniversarioMes ? `${o.aniversarioDia}/${MESES[o.aniversarioMes - 1]}` : "—"}</td>
                    <td>{o.email}</td>
                    <td>{o.telefone}</td>
                    <td>{o.grupoWhatsapp || "—"}</td>
                    <td>{o.patch || "—"}</td>
                    <td>{o.operadorMilsim ? o.numeroMilsim : "—"}</td>
                    <td>
                      <span className="tag" style={{ color: o.status === "Ativo" ? "#7be395" : "#ff8080" }}>
                        {o.status === "Ativo" ? "ATIVO" : "INATIVO"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
