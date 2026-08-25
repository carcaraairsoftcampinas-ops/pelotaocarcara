import React, { useEffect, useState } from "react";
import { PageHeader } from "../../components/Layout";
import { Field, Banner } from "../../components/Field";
import { api, ApiError } from "../../lib/api";
import { useActionNotice } from "../../lib/ActionNoticeContext";
import { GRUPOS_OPERADOR } from "../../../shared/types";
import type { GrupoOperador, Operador } from "../../../shared/types";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const EMPTY = {
  nome: "",
  sobrenome: "",
  nomeNaLista: "",
  aniversarioMes: "",
  aniversarioAno: "",
  email: "",
  telefone: "",
  grupos: [] as GrupoOperador[],
};

export default function Operadores() {
  const { notify } = useActionNotice();
  const [lista, setLista] = useState<Operador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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
  }

  function editar(o: Operador) {
    setForm({
      nome: o.nome,
      sobrenome: o.sobrenome,
      nomeNaLista: o.nomeNaLista,
      aniversarioMes: o.aniversarioMes != null ? String(o.aniversarioMes) : "",
      aniversarioAno: o.aniversarioAno != null ? String(o.aniversarioAno) : "",
      email: o.email,
      telefone: o.telefone,
      grupos: o.grupos,
    });
    setEditingId(o.id);
    setFormOpen(true);
    setError(null);
  }

  function toggleGrupo(g: GrupoOperador) {
    setForm((f) => ({
      ...f,
      grupos: f.grupos.includes(g) ? f.grupos.filter((x) => x !== g) : [...f.grupos, g],
    }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        nome: form.nome,
        sobrenome: form.sobrenome,
        nomeNaLista: form.nomeNaLista,
        aniversarioMes: form.aniversarioMes ? Number(form.aniversarioMes) : null,
        aniversarioAno: form.aniversarioAno ? Number(form.aniversarioAno) : null,
        email: form.email,
        telefone: form.telefone,
        grupos: form.grupos,
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
              <Field label="Aniversário — ano">
                <input
                  type="number"
                  min={1900}
                  max={2100}
                  value={form.aniversarioAno}
                  onChange={(e) => setForm({ ...form, aniversarioAno: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid grid-2">
              <Field label="E-mail" required>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </Field>
              <Field label="Número de telefone" required>
                <input
                  type="tel"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  required
                />
              </Field>
            </div>
            <Field label="Grupos" required hint="Pode selecionar mais de um.">
              <div className="checkbox-group">
                {GRUPOS_OPERADOR.map((g) => (
                  <label className="checkbox-row" key={g}>
                    <input type="checkbox" checked={form.grupos.includes(g)} onChange={() => toggleGrupo(g)} />
                    {g}
                  </label>
                ))}
              </div>
            </Field>
            <div className="btn-row">
              <button className="btn btn-primary" type="submit" disabled={saving || form.grupos.length === 0}>
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
                  <th>Grupos</th>
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
                    <td>{o.aniversarioMes ? `${MESES[o.aniversarioMes - 1]}${o.aniversarioAno ? "/" + o.aniversarioAno : ""}` : "—"}</td>
                    <td>{o.email}</td>
                    <td>{o.telefone}</td>
                    <td>
                      <div className="tag-list">
                        {o.grupos.map((g) => (
                          <span className="tag" key={g}>
                            {g}
                          </span>
                        ))}
                      </div>
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
