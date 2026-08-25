import React, { useEffect, useState } from "react";
import { PageHeader } from "../../components/Layout";
import { Field, Banner } from "../../components/Field";
import { StatusBadge } from "../../components/StatusBadge";
import { api, ApiError, arquivoUrl } from "../../lib/api";
import { useActionNotice } from "../../lib/ActionNoticeContext";
import { formatBRL, formatDate } from "../../../shared/calc";
import type { Campo, Missao, StatusMissao } from "../../../shared/types";

const STATUS_RELEVANTES: StatusMissao[] = ["Enviado Análise", "Em Análise", "Pendência", "Aprovada", "Reprovada"];

export default function AnaliseMissoes() {
  const { notify } = useActionNotice();
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [campos, setCampos] = useState<Campo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<Missao | null>(null);
  const [observacao, setObservacao] = useState("");
  const [acting, setActing] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>("");
  const [filtroNumero, setFiltroNumero] = useState("");
  const [filtroCampoId, setFiltroCampoId] = useState("");
  const [filtroColaborador, setFiltroColaborador] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [m, c] = await Promise.all([api.get<Missao[]>("/missoes"), api.get<Campo[]>("/campos")]);
      setMissoes(m);
      setCampos(c);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao carregar missões.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function abrir(m: Missao) {
    setSelecionada(m);
    setObservacao(m.observacoesAnalise || "");
    setError(null);
    setSuccess(null);
  }

  const ROTULOS: Record<string, string> = {
    iniciar: "iniciar a análise",
    aprovar: "aprovar",
    reprovar: "reprovar",
    pendencia: "enviar pendência",
  };

  async function agir(action: "iniciar" | "aprovar" | "reprovar" | "pendencia") {
    if (!selecionada) return;
    if (action !== "iniciar" && !observacao.trim()) {
      setError("Preencha o campo Observações antes de continuar.");
      return;
    }
    if (!confirm(`Confirma a ação "${ROTULOS[action]}" para a missão ${selecionada.numero}?`)) return;
    setActing(action);
    setError(null);
    try {
      const atualizada = await api.post<Missao>("/missoes-analise", {
        id: selecionada.id,
        action,
        observacao,
      });
      setSelecionada(atualizada);
      notify(`Ação "${ROTULOS[action]}" concluída com sucesso.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao atualizar status.");
    } finally {
      setActing(null);
    }
  }

  const campoNome = (id: string) => campos.find((c) => c.id === id)?.nome || "—";
  const colaboradoresUnicos = Array.from(new Set(missoes.map((m) => m.criadoPorNome))).sort();
  const listaFiltrada = missoes
    .filter((m) => (filtroStatus ? m.status === filtroStatus : STATUS_RELEVANTES.includes(m.status)))
    .filter((m) => (filtroNumero ? (m.numero || "").toLowerCase().includes(filtroNumero.toLowerCase()) : true))
    .filter((m) => (filtroCampoId ? m.campoId === filtroCampoId : true))
    .filter((m) => (filtroColaborador ? m.criadoPorNome === filtroColaborador : true))
    .filter((m) => (filtroDataInicio ? m.data >= filtroDataInicio : true))
    .filter((m) => (filtroDataFim ? m.data <= filtroDataFim : true));

  return (
    <div>
      <PageHeader crumbs="Análise de Missões" title="Análise de Missões" />
      <Banner type="error">{error}</Banner>

      <div className="card">
        <div className="filters-bar">
          <Field label="Número">
            <input
              type="text"
              value={filtroNumero}
              onChange={(e) => setFiltroNumero(e.target.value)}
              placeholder="Ex: 003"
            />
          </Field>
          <Field label="Colaborador">
            <select value={filtroColaborador} onChange={(e) => setFiltroColaborador(e.target.value)}>
              <option value="">Todos</option>
              {colaboradoresUnicos.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Relevantes (enviadas, em análise, pendência, aprovadas, reprovadas)</option>
              {STATUS_RELEVANTES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Campo">
            <select value={filtroCampoId} onChange={(e) => setFiltroCampoId(e.target.value)}>
              <option value="">Todos</option>
              {campos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Data início">
            <input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} />
          </Field>
          <Field label="Data fim">
            <input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} />
          </Field>
        </div>

        {loading ? (
          <div className="spinner" />
        ) : listaFiltrada.length === 0 ? (
          <div className="empty-state">Nenhuma missão neste status.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Número</th>
                  <th>Nome</th>
                  <th>Data</th>
                  <th>Data de criação</th>
                  <th>Campo</th>
                  <th>Colaborador</th>
                  <th>Qtde Operadores</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((m) => (
                  <tr key={m.id} style={{ cursor: "pointer" }} onClick={() => abrir(m)}>
                    <td>
                      <StatusBadge status={m.status} />
                    </td>
                    <td>{m.numero || "—"}</td>
                    <td>{m.nome}</td>
                    <td>{formatDate(m.data)}</td>
                    <td>{m.dataEnvioAnalise ? formatDate(m.dataEnvioAnalise) : "—"}</td>
                    <td>{campoNome(m.campoId)}</td>
                    <td>{m.criadoPorNome}</td>
                    <td>{m.quantidadeOperadores ?? "—"}</td>
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
              {selecionada.nome} ({selecionada.numero})
            </h2>
            <StatusBadge status={selecionada.status} />
          </div>
          <Banner type="success">{success}</Banner>
          <p>
            <strong>Data:</strong> {formatDate(selecionada.data)} &nbsp;·&nbsp; <strong>Campo:</strong>{" "}
            {campoNome(selecionada.campoId)} &nbsp;·&nbsp; <strong>Criado por:</strong> {selecionada.criadoPorNome}
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
              <div className="summary-box">
                <span>Total do investimento</span>
                <span className="value">{formatBRL(selecionada.investimentoTotal)}</span>
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
          </div>

          <Field label="Observações" required hint="Obrigatório para iniciar, aprovar, reprovar ou enviar pendência.">
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} />
          </Field>

          {selecionada.historicoStatus.some((h) => h.observacao) && (
            <>
              <h3 style={{ marginTop: 16 }}>Histórico de observações</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Data</th>
                      <th>Responsável</th>
                      <th>Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selecionada.historicoStatus
                      .filter((h) => h.observacao)
                      .map((h, idx) => (
                        <tr key={idx}>
                          <td>{h.status}</td>
                          <td>{formatDate(h.data)}</td>
                          <td>{h.colaboradorNome}</td>
                          <td>{h.observacao}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="btn-row">
            {selecionada.status === "Enviado Análise" && (
              <button className="btn btn-orange" disabled={!!acting} onClick={() => agir("iniciar")}>
                {acting === "iniciar" ? "Iniciando…" : "Iniciar Análise"}
              </button>
            )}
            {selecionada.status === "Em Análise" && (
              <>
                <button className="btn btn-success" disabled={!!acting} onClick={() => agir("aprovar")}>
                  {acting === "aprovar" ? "Aprovando…" : "Aprovado"}
                </button>
                <button className="btn btn-black" disabled={!!acting} onClick={() => agir("reprovar")}>
                  {acting === "reprovar" ? "Reprovando…" : "Reprovado"}
                </button>
                <button className="btn btn-danger" disabled={!!acting} onClick={() => agir("pendencia")}>
                  {acting === "pendencia" ? "Enviando…" : "Enviar Pendência"}
                </button>
              </>
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
