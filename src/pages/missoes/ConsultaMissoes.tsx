import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/Layout";
import { Field, Banner } from "../../components/Field";
import { StatusBadge } from "../../components/StatusBadge";
import { SortableTh } from "../../components/SortableTh";
import { useSort } from "../../lib/useSort";
import { api, ApiError, arquivoUrl } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import { useActionNotice } from "../../lib/ActionNoticeContext";
import { formatBRL, formatDate } from "../../../shared/calc";
import { STATUS_MISSAO_ORDEM } from "../../../shared/types";
import type { Campo, Colaborador, Missao } from "../../../shared/types";

type SortField =
  | "status"
  | "numero"
  | "nome"
  | "data"
  | "campo"
  | "colaborador"
  | "operadores"
  | "dataEnvioAnalise"
  | "analista"
  | "avaliacao";

export default function ConsultaMissoes() {
  const { has, user } = useAuth();
  const navigate = useNavigate();
  const { notify } = useActionNotice();
  const podeVerTudo = has("Administrador", "Coordenador");
  const somenteColaborador = !!user && user.perfis.includes("Colaborador") && !user.perfis.some((p) => p !== "Colaborador");

  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [campos, setCampos] = useState<Campo[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<Missao | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const { sort, toggleSort, ordenar } = useSort<SortField>();

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [campoId, setCampoId] = useState("");
  const [colaboradorId, setColaboradorId] = useState("");
  const [estrelasMin, setEstrelasMin] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");

  useEffect(() => {
    api.get<Campo[]>("/campos").then(setCampos).catch(() => {});
    if (podeVerTudo) {
      api.get<Colaborador[]>("/colaboradores").then(setColaboradores).catch(() => {});
    }
  }, [podeVerTudo]);

  async function buscar() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dataInicio) params.set("dataInicio", dataInicio);
      if (dataFim) params.set("dataFim", dataFim);
      if (campoId) params.set("campoId", campoId);
      if (colaboradorId) params.set("colaboradorId", colaboradorId);
      if (estrelasMin) params.set("estrelasMin", estrelasMin);
      if (statusFiltro) params.set("status", statusFiltro);
      const data = await api.get<Missao[]>(`/missoes?${params.toString()}`);
      setMissoes(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao carregar missões.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function excluirRascunho(m: Missao) {
    if (!confirm(`Excluir o rascunho da missão "${m.nome}"? Essa ação não pode ser desfeita.`)) return;
    setExcluindo(true);
    try {
      await api.del(`/missoes?id=${m.id}`);
      notify("Rascunho excluído com sucesso.");
      setSelecionada(null);
      await buscar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao excluir rascunho.");
    } finally {
      setExcluindo(false);
    }
  }

  const campoNome = useMemo(() => {
    const map = new Map(campos.map((c) => [c.id, c.nome]));
    return (id: string) => map.get(id) || "—";
  }, [campos]);

  function valorOrdenavel(m: Missao, field: SortField): string | number {
    switch (field) {
      case "status":
        return m.status;
      case "numero":
        return m.numero || "";
      case "nome":
        return m.nome;
      case "data":
        return m.data;
      case "campo":
        return campoNome(m.campoId);
      case "colaborador":
        return m.criadoPorNome;
      case "operadores":
        return m.quantidadeOperadores ?? -1;
      case "dataEnvioAnalise":
        return m.dataEnvioAnalise || "";
      case "analista":
        return m.analistaNome || "";
      case "avaliacao":
        return m.avaliacao?.estrelas ?? -1;
    }
  }

  const missoesOrdenadas = ordenar(missoes, valorOrdenavel);

  return (
    <div>
      <PageHeader crumbs="Missões" title="Consulta Missões" />
      <Banner type="error">{error}</Banner>

      <div className="card">
        <div className="filters-bar">
          <Field label="Data início">
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </Field>
          <Field label="Data fim">
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </Field>
          <Field label="Campo">
            <select value={campoId} onChange={(e) => setCampoId(e.target.value)}>
              <option value="">Todos</option>
              {campos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)}>
              <option value="">Todos</option>
              {STATUS_MISSAO_ORDEM.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          {podeVerTudo && (
            <Field label="Colaborador">
              <select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}>
                <option value="">Todos</option>
                {colaboradores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} {c.sobrenome}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {podeVerTudo && !somenteColaborador && (
            <Field label="Avaliação mínima">
              <select value={estrelasMin} onChange={(e) => setEstrelasMin(e.target.value)}>
                <option value="">Todas</option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {"★".repeat(n)} ou mais
                  </option>
                ))}
              </select>
            </Field>
          )}
          <button className="btn btn-primary" onClick={buscar}>
            Filtrar
          </button>
        </div>

        {loading ? (
          <div className="spinner" />
        ) : missoes.length === 0 ? (
          <div className="empty-state">Nenhuma missão encontrada.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <SortableTh field="status" sort={sort} onSort={toggleSort}>Status</SortableTh>
                  <SortableTh field="numero" sort={sort} onSort={toggleSort}>Número</SortableTh>
                  <SortableTh field="nome" sort={sort} onSort={toggleSort}>NOME DA MISSÃO</SortableTh>
                  <SortableTh field="data" sort={sort} onSort={toggleSort}>Data Evento</SortableTh>
                  <SortableTh field="dataEnvioAnalise" sort={sort} onSort={toggleSort}>Data Envio Análise</SortableTh>
                  <SortableTh field="campo" sort={sort} onSort={toggleSort}>Campo</SortableTh>
                  <SortableTh field="colaborador" sort={sort} onSort={toggleSort}>Colaborador</SortableTh>
                  <SortableTh field="analista" sort={sort} onSort={toggleSort}>Analista</SortableTh>
                  <SortableTh field="operadores" sort={sort} onSort={toggleSort}>Qtde Operadores</SortableTh>
                  {!somenteColaborador && (
                    <SortableTh field="avaliacao" sort={sort} onSort={toggleSort}>Avaliação</SortableTh>
                  )}
                </tr>
              </thead>
              <tbody>
                {missoesOrdenadas.map((m) => (
                  <tr key={m.id} style={{ cursor: "pointer" }} onClick={() => setSelecionada(m)}>
                    <td>
                      <StatusBadge status={m.status} />
                    </td>
                    <td>{m.numero || "—"}</td>
                    <td>{m.nome}</td>
                    <td>{formatDate(m.data)}</td>
                    <td>{m.dataEnvioAnalise ? formatDate(m.dataEnvioAnalise) : "—"}</td>
                    <td>{campoNome(m.campoId)}</td>
                    <td>{m.criadoPorNome}</td>
                    <td>{m.analistaNome || "—"}</td>
                    <td>{m.quantidadeOperadores ?? "—"}</td>
                    {!somenteColaborador && <td>{m.avaliacao ? "★".repeat(m.avaliacao.estrelas) : "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selecionada && (
        <div className="modal-overlay" onClick={() => setSelecionada(null)}>
        <div className="modal-box modal-box-lg" onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>
              {selecionada.nome} {selecionada.numero ? `(${selecionada.numero})` : ""}
            </h2>
            <StatusBadge status={selecionada.status} />
          </div>
          <p>
            <strong>Tipo:</strong> {selecionada.tipo || "Evento"} &nbsp;·&nbsp; <strong>Data Evento:</strong>{" "}
            {formatDate(selecionada.data)} &nbsp;·&nbsp; <strong>Campo:</strong> {campoNome(selecionada.campoId)}
            &nbsp;·&nbsp; <strong>Criado por:</strong> {selecionada.criadoPorNome}
            {selecionada.quantidadeOperadores != null && (
              <>
                {" "}
                &nbsp;·&nbsp; <strong>Operadores:</strong> {selecionada.quantidadeOperadores}
              </>
            )}
            {selecionada.analistaNome && (
              <>
                {" "}
                &nbsp;·&nbsp; <strong>Analista:</strong> {selecionada.analistaNome}
              </>
            )}
          </p>

          <h3>Resumo</h3>
          <div className="readonly-block">{selecionada.resumo}</div>
          <h3 style={{ marginTop: 16 }}>Objetivos</h3>
          <div className="readonly-block">{selecionada.objetivos}</div>

          {selecionada.itensNecessarios.length > 0 && (
            <>
              <h3 style={{ marginTop: 16 }}>Itens da missão</h3>
              <div className="tag-list">
                {selecionada.itensNecessarios.map((i: any, idx) => (
                  <span className="tag" key={idx}>
                    {typeof i === "string" ? i : `${i.nome} (x${i.quantidade})`}
                  </span>
                ))}
              </div>
            </>
          )}

          {selecionada.itensCompra.length > 0 && (
            <>
              <h3 style={{ marginTop: 16 }}>Itens de compra</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qtd</th>
                      <th>Valor unit.</th>
                      <th>Total</th>
                      <th>Link de compra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selecionada.itensCompra.map((i) => (
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="summary-box">
                <span>Total do investimento</span>
                <span className="value" style={{ color: "var(--orange)" }}>{formatBRL(selecionada.investimentoTotal)}</span>
              </div>
            </>
          )}

          <h3 style={{ marginTop: 16 }}>Anexos</h3>
          <div className="attach-list">
            {[...selecionada.cartas, ...selecionada.imagens].map((a) => (
              <span className="attach-chip" key={a.blobKey}>
                <a href={arquivoUrl(a.blobKey)} target="_blank" rel="noreferrer">
                  {a.nomeArquivo}
                </a>
              </span>
            ))}
            {selecionada.cartas.length + selecionada.imagens.length === 0 && (
              <span className="hint">Nenhum anexo.</span>
            )}
          </div>

          {selecionada.observacoesAnalise && (
            <>
              <h3 style={{ marginTop: 16 }}>Observações da análise</h3>
              <div className="readonly-block">{selecionada.observacoesAnalise}</div>
            </>
          )}

          {selecionada.avaliacao && (
            <>
              <h3 style={{ marginTop: 16 }}>Avaliação</h3>
              <p>
                <strong>Avaliado por:</strong> {selecionada.avaliacao.avaliadoPor} &nbsp;·&nbsp;{" "}
                <strong>Em:</strong> {formatDate(selecionada.avaliacao.avaliadoEm)}
                {selecionada.avaliacao.totalOperadoresPresentes != null && (
                  <>
                    {" "}
                    &nbsp;·&nbsp; <strong>Operadores presentes:</strong>{" "}
                    {selecionada.avaliacao.totalOperadoresPresentes}
                  </>
                )}
              </p>
              <p className="stars">{"★".repeat(selecionada.avaliacao.estrelas)}</p>
              <div className="readonly-block">{selecionada.avaliacao.comentario}</div>
            </>
          )}

          <div className="btn-row">
            {(selecionada.status === "Rascunho" || selecionada.status === "Pendência") &&
              selecionada.criadoPorId === user?.colaboradorId && (
                <button className="btn btn-primary" onClick={() => navigate(`/missoes/nova/${selecionada.id}`)}>
                  Editar missão
                </button>
              )}
            {selecionada.status === "Rascunho" &&
              (selecionada.criadoPorId === user?.colaboradorId || has("Administrador", "Coordenador")) && (
                <button
                  className="btn btn-danger"
                  disabled={excluindo}
                  onClick={() => excluirRascunho(selecionada)}
                >
                  {excluindo ? "Excluindo…" : "Excluir Rascunho"}
                </button>
              )}
            <button className="btn btn-secondary" onClick={() => setSelecionada(null)}>
              Fechar
            </button>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
