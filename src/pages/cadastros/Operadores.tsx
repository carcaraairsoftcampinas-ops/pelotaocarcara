import React, { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { PageHeader } from "../../components/Layout";
import { Field, Banner } from "../../components/Field";
import { api, ApiError } from "../../lib/api";
import { useActionNotice } from "../../lib/ActionNoticeContext";
import { formatDate } from "../../../shared/calc";
import { GRUPOS_WHATSAPP, PATCHES } from "../../../shared/types";
import type { GrupoWhatsapp, Patch, Operador, HistoricoOperadorEntry } from "../../../shared/types";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const DIAS = Array.from({ length: 31 }, (_, i) => i + 1);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PATCH_COLORS: Record<string, string> = {
  Amarelo: "var(--yellow)",
  Vermelho: "var(--red)",
};

function maskTelefone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function maskMilsim(value: string) {
  const raw = value.toUpperCase().replace(/[^0-9M]/g, "");
  const digitsOnly = raw.replace(/M/g, "");
  const d1 = digitsOnly.slice(0, 2);
  const d2 = digitsOnly.slice(2, 4);
  if (d1.length < 2) return d1;
  return d2.length ? `${d1}M${d2}` : `${d1}M`;
}

const EMPTY = {
  nome: "",
  sobrenome: "",
  nomeNaLista: "",
  aniversarioDia: "",
  aniversarioMes: "",
  email: "",
  telefone: "",
  grupoWhatsapp: "" as GrupoWhatsapp | "",
  patch: "" as Patch | "",
  operadorMilsim: false,
  numeroMilsim: "",
  historico: [] as HistoricoOperadorEntry[],
  status: "Ativo" as "Ativo" | "Inativo",
};

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function Operadores() {
  const { notify } = useActionNotice();
  const [lista, setLista] = useState<Operador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [novoHistoricoData, setNovoHistoricoData] = useState(hojeISO());
  const [novoHistoricoTexto, setNovoHistoricoTexto] = useState("");

  async function load() {
    setLoading(true);
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

  function novo() {
    setForm(EMPTY);
    setEditingId(null);
    setFormOpen(true);
    setError(null);
    setNovoHistoricoData(hojeISO());
    setNovoHistoricoTexto("");
  }

  function adicionarHistorico() {
    if (!novoHistoricoTexto.trim() || !novoHistoricoData) return;
    const entrada: HistoricoOperadorEntry = {
      id: uuidv4(),
      data: novoHistoricoData,
      texto: novoHistoricoTexto.trim(),
      registradoPorNome: "",
      criadoEm: "",
    };
    setForm((f) => ({ ...f, historico: [entrada, ...f.historico] }));
    setNovoHistoricoTexto("");
    setNovoHistoricoData(hojeISO());
  }

  function editar(o: Operador) {
    setForm({
      nome: o.nome,
      sobrenome: o.sobrenome,
      nomeNaLista: o.nomeNaLista,
      aniversarioDia: o.aniversarioDia != null ? String(o.aniversarioDia) : "",
      aniversarioMes: o.aniversarioMes != null ? String(o.aniversarioMes) : "",
      email: o.email,
      telefone: o.telefone,
      grupoWhatsapp: o.grupoWhatsapp || "",
      patch: o.patch || "",
      operadorMilsim: o.operadorMilsim,
      numeroMilsim: o.numeroMilsim || "",
      historico: o.historico || [],
      status: o.status,
    });
    setEditingId(o.id);
    setFormOpen(true);
    setError(null);
    setNovoHistoricoData(hojeISO());
    setNovoHistoricoTexto("");
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!EMAIL_RE.test(form.email.trim())) {
      setError("E-mail inválido.");
      return;
    }
    if (!/^\(\d{2}\) \d{5}-\d{4}$/.test(form.telefone.trim())) {
      setError("Telefone inválido. Use o formato (XX) XXXXX-XXXX.");
      return;
    }
    if (form.operadorMilsim && !/^\d{2}M\d{2}$/.test(form.numeroMilsim.trim())) {
      setError("Número Milsim inválido. Use o formato XXMXX.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nome: form.nome,
        sobrenome: form.sobrenome,
        nomeNaLista: form.nomeNaLista,
        aniversarioDia: form.aniversarioDia ? Number(form.aniversarioDia) : null,
        aniversarioMes: form.aniversarioMes ? Number(form.aniversarioMes) : null,
        email: form.email,
        telefone: form.telefone,
        grupoWhatsapp: form.grupoWhatsapp || null,
        patch: form.patch || null,
        operadorMilsim: form.operadorMilsim,
        numeroMilsim: form.operadorMilsim ? form.numeroMilsim : null,
        historico: form.historico,
        status: form.status,
      };
      if (editingId) {
        await api.put(`/operadores`, { id: editingId, ...payload });
        notify("Operador atualizado com sucesso.");
      } else {
        await api.post(`/operadores`, payload);
        notify("Operador cadastrado com sucesso.");
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function excluir(o: Operador) {
    if (!confirm(`Excluir o operador ${o.nome} ${o.sobrenome}?`)) return;
    try {
      await api.del(`/operadores?id=${o.id}`);
      notify("Operador excluído com sucesso.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao excluir.");
    }
  }

  return (
    <div>
      <PageHeader crumbs="Cadastros" title="Cadastro de Operadores" />
      <Banner type="error">{error}</Banner>

      {formOpen && (
        <div className="card">
          <h2>{editingId ? "Editar operador" : "Novo operador"}</h2>
          <form onSubmit={salvar}>
            <div className="grid grid-2">
              <Field label="Nome" required>
                <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
              </Field>
              <Field label="Sobrenome" required>
                <input
                  type="text"
                  value={form.sobrenome}
                  onChange={(e) => setForm({ ...form, sobrenome: e.target.value })}
                  required
                />
              </Field>
            </div>
            <Field label="Nome na lista" required hint="Como o operador é chamado nas listas/chamadas do time.">
              <input
                type="text"
                value={form.nomeNaLista}
                onChange={(e) => setForm({ ...form, nomeNaLista: e.target.value })}
                required
              />
            </Field>
            <div className="grid grid-2">
              <Field label="Aniversário — dia">
                <select
                  value={form.aniversarioDia}
                  onChange={(e) => setForm({ ...form, aniversarioDia: e.target.value })}
                >
                  <option value="">—</option>
                  {DIAS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Aniversário — mês">
                <select
                  value={form.aniversarioMes}
                  onChange={(e) => setForm({ ...form, aniversarioMes: e.target.value })}
                >
                  <option value="">—</option>
                  {MESES.map((m, idx) => (
                    <option key={m} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-2">
              <Field label="E-mail" required hint="Formato: email@email.com">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@email.com"
                  required
                />
              </Field>
              <Field label="Número de telefone" required hint="Formato: (XX) XXXXX-XXXX">
                <input
                  type="tel"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: maskTelefone(e.target.value) })}
                  placeholder="(11) 91234-5678"
                  required
                />
              </Field>
            </div>
            <div className="grid grid-2">
              <Field label="Grupo WhatsApp">
                <select
                  value={form.grupoWhatsapp}
                  onChange={(e) => setForm({ ...form, grupoWhatsapp: e.target.value as GrupoWhatsapp | "" })}
                >
                  <option value="">—</option>
                  {GRUPOS_WHATSAPP.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Patch">
                <select
                  value={form.patch}
                  onChange={(e) => setForm({ ...form, patch: e.target.value as Patch | "" })}
                >
                  <option value="">—</option>
                  {PATCHES.map((p) => (
                    <option key={p} value={p} style={{ color: PATCH_COLORS[p] }}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-2">
              <Field label="Operador Milsim Squad">
                <select
                  value={form.operadorMilsim ? "Sim" : "Não"}
                  onChange={(e) =>
                    setForm({ ...form, operadorMilsim: e.target.value === "Sim", numeroMilsim: e.target.value === "Sim" ? form.numeroMilsim : "" })
                  }
                >
                  <option value="Não">Não</option>
                  <option value="Sim">Sim</option>
                </select>
              </Field>
              {form.operadorMilsim && (
                <Field label="Número Milsim" required hint="Formato: XXMXX">
                  <input
                    type="text"
                    value={form.numeroMilsim}
                    onChange={(e) => setForm({ ...form, numeroMilsim: maskMilsim(e.target.value) })}
                    placeholder="12M34"
                    maxLength={5}
                    required
                  />
                </Field>
              )}
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Histórico do operador</label>
              <div className="grid grid-2">
                <Field label="Data">
                  <input
                    type="date"
                    value={novoHistoricoData}
                    onChange={(e) => setNovoHistoricoData(e.target.value)}
                  />
                </Field>
                <Field label="Histórico">
                  <input
                    type="text"
                    value={novoHistoricoTexto}
                    onChange={(e) => setNovoHistoricoTexto(e.target.value)}
                    placeholder="Ex.: advertência, elogio, ocorrência…"
                  />
                </Field>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={adicionarHistorico}
                disabled={!novoHistoricoTexto.trim() || !novoHistoricoData}
              >
                + Adicionar ao histórico
              </button>
              {form.historico.length > 0 && (
                <div className="table-wrap" style={{ marginTop: 12 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Histórico</th>
                        <th>Registrado por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.historico.map((h) => (
                        <tr key={h.id}>
                          <td>{formatDate(h.data)}</td>
                          <td>{h.texto}</td>
                          <td>{h.registradoPorNome || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p style={{ marginTop: 6, fontSize: 11, color: "var(--text-faint)" }}>
                Cada entrada fica salva pra sempre no cadastro deste operador — não é possível editar ou apagar um
                registro já adicionado, só incluir novos.
              </p>
            </div>
            <Field label="Status" required>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as "Ativo" | "Inativo" })}
              >
                <option value="Ativo">ATIVO</option>
                <option value="Inativo">INATIVO</option>
              </select>
            </Field>
            <div className="btn-row">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Salvando…" : "Salvar"}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setFormOpen(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ marginBottom: 0 }}>Operadores cadastrados</h2>
          {!formOpen && (
            <button className="btn btn-primary" onClick={novo}>
              + Novo operador
            </button>
          )}
        </div>
        {loading ? (
          <div className="spinner" />
        ) : lista.length === 0 ? (
          <div className="empty-state">Nenhum operador cadastrado ainda.</div>
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((o) => (
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
                    <td>{o.operadorMilsim ? o.numeroMilsim : "—"}</td>
                    <td>
                      <span className="tag" style={{ color: o.status === "Ativo" ? "#7be395" : "#ff8080" }}>
                        {o.status === "Ativo" ? "ATIVO" : "INATIVO"}
                      </span>
                    </td>
                    <td>
                      <button className="link-btn" onClick={() => editar(o)}>
                        Editar
                      </button>{" "}
                      &nbsp;
                      <button className="link-btn" style={{ color: "#ff8080" }} onClick={() => excluir(o)}>
                        Excluir
                      </button>
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
