import React, { useEffect, useState } from "react";
import { PageHeader } from "../../components/Layout";
import { Field, Banner } from "../../components/Field";
import { api, ApiError } from "../../lib/api";
import { PERFIS } from "../../../shared/types";
import type { Colaborador, Perfil } from "../../../shared/types";

const EMPTY = {
  nome: "",
  sobrenome: "",
  email: "",
  perfis: [] as Perfil[],
  status: "Ativo" as "Ativo" | "Não Ativo",
};

export default function Colaboradores() {
  const [lista, setLista] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Colaborador[]>("/colaboradores");
      setLista(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao carregar colaboradores.");
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
    setSuccess(null);
  }

  function editar(c: Colaborador) {
    setForm({
      nome: c.nome,
      sobrenome: c.sobrenome,
      email: c.email,
      perfis: c.perfis,
      status: c.status,
    });
    setEditingId(c.id);
    setFormOpen(true);
    setError(null);
    setSuccess(null);
  }

  function togglePerfil(p: Perfil) {
    setForm((f) => ({
      ...f,
      perfis: f.perfis.includes(p) ? f.perfis.filter((x) => x !== p) : [...f.perfis, p],
    }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await api.put(`/colaboradores`, { id: editingId, ...form });
        setSuccess("Colaborador atualizado.");
      } else {
        await api.post(`/colaboradores`, form);
        setSuccess("Colaborador cadastrado.");
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function excluir(c: Colaborador) {
    if (!confirm(`Excluir o colaborador ${c.nome} ${c.sobrenome}?`)) return;
    try {
      await api.del(`/colaboradores?id=${c.id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao excluir.");
    }
  }

  return (
    <div>
      <PageHeader crumbs="Cadastros" title="Cadastro de Colaboradores" />
      <Banner type="error">{error}</Banner>
      <Banner type="success">{success}</Banner>

      {formOpen && (
        <div className="card">
          <h2>{editingId ? "Editar colaborador" : "Novo colaborador"}</h2>
          <form onSubmit={salvar}>
            <div className="grid grid-2">
              <Field label="Nome" required>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
                />
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
            <Field label="E-mail" required hint="É esse e-mail que a pessoa usa para entrar no sistema com login do Google.">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </Field>
            <Field label="Perfil" required hint="Pode selecionar mais de um perfil por usuário.">
              <div className="checkbox-group">
                {PERFIS.map((p) => (
                  <label className="checkbox-row" key={p}>
                    <input type="checkbox" checked={form.perfis.includes(p)} onChange={() => togglePerfil(p)} />
                    {p}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Status" required>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as "Ativo" | "Não Ativo" })}
              >
                <option value="Ativo">Ativo (acessa o sistema normalmente)</option>
                <option value="Não Ativo">Não Ativo (bloqueia imediatamente o acesso)</option>
              </select>
            </Field>
            <div className="btn-row">
              <button className="btn btn-primary" type="submit" disabled={saving || form.perfis.length === 0}>
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
          <h2 style={{ marginBottom: 0 }}>Colaboradores cadastrados</h2>
          {!formOpen && (
            <button className="btn btn-primary" onClick={novo}>
              + Novo colaborador
            </button>
          )}
        </div>
        {loading ? (
          <div className="spinner" />
        ) : lista.length === 0 ? (
          <div className="empty-state">Nenhum colaborador cadastrado ainda.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfis</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.nome} {c.sobrenome}
                    </td>
                    <td>{c.email}</td>
                    <td>
                      <div className="tag-list">
                        {c.perfis.map((p) => (
                          <span className="tag" key={p}>
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className="tag" style={{ color: c.status === "Ativo" ? "#7be395" : "#ff8080" }}>
                        {c.status}
                      </span>
                    </td>
                    <td>
                      <button className="link-btn" onClick={() => editar(c)}>
                        Editar
                      </button>{" "}
                      &nbsp;
                      <button className="link-btn" style={{ color: "#ff8080" }} onClick={() => excluir(c)}>
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
