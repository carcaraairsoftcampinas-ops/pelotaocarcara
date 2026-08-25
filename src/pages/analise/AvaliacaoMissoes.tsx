import React, { useEffect, useState } from "react";
import { PageHeader } from "../../components/Layout";
import { Field, Banner } from "../../components/Field";
import { StatusBadge } from "../../components/StatusBadge";
import { api, ApiError } from "../../lib/api";
import { useActionNotice } from "../../lib/ActionNoticeContext";
import { formatDate } from "../../../shared/calc";
import type { Campo, Missao } from "../../../shared/types";

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="stars" style={{ fontSize: 26, cursor: "pointer" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} onClick={() => onChange(n)}>
          {n <= value ? "★" : "☆"}
        </span>
      ))}
    </div>
  );
}

export default function AvaliacaoMissoes() {
  const { notify } = useActionNotice();
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [campos, setCampos] = useState<Campo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<Missao | null>(null);
  const [estrelas, setEstrelas] = useState(0);
  const [comentario, setComentario] = useState("");
  const [totalOperadoresPresentes, setTotalOperadoresPresentes] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [m, c] = await Promise.all([api.get<Missao[]>("/missoes"), api.get<Campo[]>("/campos")]);
      setMissoes(m.filter((x) => x.status === "Aprovada" || x.status === "Aguardando Avaliação" || x.status === "Finalizada"));
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
    setEstrelas(m.avaliacao?.estrelas || 0);
    setComentario(m.avaliacao?.comentario || "");
    setTotalOperadoresPresentes(m.avaliacao?.totalOperadoresPresentes ? String(m.avaliacao.totalOperadoresPresentes) : "");
    setError(null);
  }

  async function avaliar() {
    if (!selecionada) return;
    if (estrelas < 1) {
      setError("Selecione de 1 a 5 estrelas.");
      return;
    }
    if (!totalOperadoresPresentes || Number(totalOperadoresPresentes) < 1) {
      setError("Informe o total de operadores presentes.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const atualizada = await api.post<Missao>("/missoes-analise", {
        id: selecionada.id,
        action: "avaliar",
        estrelas,
        comentario,
        totalOperadoresPresentes: Number(totalOperadoresPresentes),
      });
      setSelecionada(atualizada);
      notify("Missão avaliada e finalizada com sucesso.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao avaliar.");
    } finally {
      setSaving(false);
    }
  }

  const campoNome = (id: string) => campos.find((c) => c.id === id)?.nome || "—";

  return (
    <div>
      <PageHeader crumbs="Análise de Missões" title="Avaliação de Missões" />
      <Banner type="error">{error}</Banner>

      <div className="card">
        {loading ? (
          <div className="spinner" />
        ) : missoes.length === 0 ? (
          <div className="empty-state">Nenhuma missão aprovada ou finalizada ainda.</div>
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
                  <th>Avaliação</th>
                </tr>
              </thead>
              <tbody>
                {missoes.map((m) => (
                  <tr key={m.id} style={{ cursor: "pointer" }} onClick={() => abrir(m)}>
                    <td>
                      <StatusBadge status={m.status} />
                    </td>
                    <td>{m.numero || "—"}</td>
                    <td>{m.nome}</td>
                    <td>{formatDate(m.data)}</td>
                    <td>{m.dataEnvioAnalise ? formatDate(m.dataEnvioAnalise) : "—"}</td>
                    <td>{campoNome(m.campoId)}</td>
                    <td>{m.avaliacao ? "★".repeat(m.avaliacao.estrelas) : "Pendente"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selecionada && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>
              {selecionada.nome} ({selecionada.numero})
            </h2>
            <StatusBadge status={selecionada.status} />
          </div>

          {selecionada.status === "Finalizada" && selecionada.avaliacao ? (
            <>
              <p className="stars" style={{ fontSize: 22 }}>
                {"★".repeat(selecionada.avaliacao.estrelas)}
                {"☆".repeat(5 - selecionada.avaliacao.estrelas)}
              </p>
              <div className="readonly-block">{selecionada.avaliacao.comentario}</div>
              <p className="hint">
                Total de operadores presentes: {selecionada.avaliacao.totalOperadoresPresentes ?? "—"}
              </p>
              <p className="hint">
                Avaliado por {selecionada.avaliacao.avaliadoPor} em {formatDate(selecionada.avaliacao.avaliadoEm)}
              </p>
            </>
          ) : (
            <>
              <Field label="Avaliação (1 a 5 estrelas)" required>
                <StarPicker value={estrelas} onChange={setEstrelas} />
              </Field>
              <Field label="Qtde Operadores Presentes" required>
                <input
                  type="number"
                  min={1}
                  value={totalOperadoresPresentes}
                  onChange={(e) => setTotalOperadoresPresentes(e.target.value)}
                />
              </Field>
              <Field label="Comentários" hint="Como foi a missão, o que pode melhorar da próxima vez.">
                <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={4} />
              </Field>
              <div className="btn-row">
                <button className="btn btn-primary" disabled={saving} onClick={avaliar}>
                  {saving ? "Salvando…" : "Avaliar e Finalizar"}
                </button>
              </div>
            </>
          )}

          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => setSelecionada(null)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
