import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/Layout";
import { Field, Banner } from "../../components/Field";
import { SortableTh } from "../../components/SortableTh";
import { useSort } from "../../lib/useSort";
import { api, ApiError } from "../../lib/api";
import { GRUPOS_WHATSAPP, PATCHES } from "../../../shared/types";
import type { Operador } from "../../../shared/types";

type SortField =
  | "id"
  | "nome"
  | "nomeNaLista"
  | "aniversario"
  | "email"
  | "telefone"
  | "grupoWhatsapp"
  | "patch"
  | "milsim"
  | "status";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const PATCH_COLORS: Record<string, string> = {
  Amarelo: "var(--yellow)",
  Vermelho: "var(--red)",
};

// Cores fixas por posição do número Milsim (formato XXMXX, ex: 01M18):
// 1º e 2º dígito=azul royal, letra M=vermelho, 4º e 5º dígito=azul royal.
const MILSIM_DIGIT_COLORS = ["#4169e1", "#4169e1", "#e33a3a", "#4169e1", "#4169e1"];

function MilsimNumero({ numero }: { numero: string }) {
  return (
    <span>
      {numero.split("").map((ch, idx) => (
        <span key={idx} style={{ color: MILSIM_DIGIT_COLORS[idx] || "inherit", fontWeight: 700 }}>
          {ch}
        </span>
      ))}
    </span>
  );
}

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
  const { sort, toggleSort, ordenar } = useSort<SortField>();

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

  function valorOrdenavel(o: Operador, field: SortField): string | number {
    switch (field) {
      case "id":
        return o.id;
      case "nome":
        return `${o.nome} ${o.sobrenome}`;
      case "nomeNaLista":
        return o.nomeNaLista;
      case "aniversario":
        return o.aniversarioMes != null && o.aniversarioDia != null
          ? o.aniversarioMes * 100 + o.aniversarioDia
          : -1;
      case "email":
        return o.email;
      case "telefone":
        return o.telefone;
      case "grupoWhatsapp":
        return o.grupoWhatsapp || "";
      case "patch":
        return o.patch || "";
      case "milsim":
        return o.numeroMilsim || "";
      case "status":
        return o.status;
    }
  }

  const listaOrdenada = useMemo(() => ordenar(listaFiltrada, valorOrdenavel), [listaFiltrada, sort]);

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
                <option key={p} value={p} style={{ color: PATCH_COLORS[p] }}>
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
                  <SortableTh field="id" sort={sort} onSort={toggleSort}>ID</SortableTh>
                  <SortableTh field="nome" sort={sort} onSort={toggleSort}>Nome</SortableTh>
                  <SortableTh field="nomeNaLista" sort={sort} onSort={toggleSort}>Nome na lista</SortableTh>
                  <SortableTh field="aniversario" sort={sort} onSort={toggleSort}>Aniversário</SortableTh>
                  <SortableTh field="email" sort={sort} onSort={toggleSort}>E-mail</SortableTh>
                  <SortableTh field="telefone" sort={sort} onSort={toggleSort}>Telefone</SortableTh>
                  <SortableTh field="grupoWhatsapp" sort={sort} onSort={toggleSort}>Grupo WhatsApp</SortableTh>
                  <SortableTh field="patch" sort={sort} onSort={toggleSort}>Patch</SortableTh>
                  <SortableTh field="milsim" sort={sort} onSort={toggleSort}>Milsim</SortableTh>
                  <SortableTh field="status" sort={sort} onSort={toggleSort}>Status</SortableTh>
                </tr>
              </thead>
              <tbody>
                {listaOrdenada.map((o) => (
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
                    <td>
                      {o.patch ? (
                        <span className="tag" style={{ color: PATCH_COLORS[o.patch] }}>
                          {o.patch}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{o.operadorMilsim && o.numeroMilsim ? <MilsimNumero numero={o.numeroMilsim} /> : "—"}</td>
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
