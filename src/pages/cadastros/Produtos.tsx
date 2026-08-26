import React, { useEffect, useState } from "react";
import { PageHeader } from "../../components/Layout";
import { Field, Banner } from "../../components/Field";
import { api, ApiError } from "../../lib/api";
import { useActionNotice } from "../../lib/ActionNoticeContext";
import type { Produto } from "../../../shared/types";

const EMPTY = { nome: "", status: "Ativo" as "Ativo" | "Inativo" };

export default function Produtos() {
  const { notify } = useActionNotice();
  const [lista, setLista] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setLista(await api.get<Produto[]>("/produtos"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao carregar produtos.");
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

  function editar(p: Produto) {
    setForm({ nome: p.nome, status: p.ativo ? "Ativo" : "Inativo" });
    setEditingId(p.id);
    setFormOpen(true);
    setError(null);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { nome: form.nome, ativo: form.status === "Ativo" };
      if (editingId) {
        await api.put(`/produtos`, { id: editingId, ...payload });
        notify("Produto atualizado com sucesso.");
      } else {
        await api.post(`/produtos`, payload);
        notify("Produto cadastrado com sucesso.");
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function excluir(p: Produto) {
    if (!confirm(`Excluir o produto "${p.nome}"?`)) return;
    try {
      await api.del(`/produtos?id=${p.id}`);
      notify("Produto excluído com sucesso.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao excluir.");
    }
  }

  return (
    <div>
      <PageHeader crumbs="Cadastros" title="Cadastro de Produtos" />
      <Banner type="error">{error}</Banner>

      {formOpen && (
        <div className="card">
          <h2>{editingId ? "Editar produto" : "Novo produto"}</h2>
          <form onSubmit={salvar}>
            <div className="grid grid-2">
              <Field label="Nome do produto" required>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
                />
              </Field>
              <Field label="Status" required>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as "Ativo" | "Inativo" })}
                >
                  <option value="Ativo">ATIVO</option>
                  <option value="Inativo">INATIVO</option>
                </select>
              </Field>
            </div>

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
          <h2 style={{ marginBottom: 0 }}>Produtos cadastrados</h2>
          {!formOpen && (
            <button className="btn btn-primary" onClick={novo}>
              + Novo produto
            </button>
          )}
        </div>
        {loading ? (
          <div className="spinner" />
        ) : lista.length === 0 ? (
          <div className="empty-state">Nenhum produto cadastrado ainda.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nome}</td>
                    <td>
                      <span className="tag" style={{ color: p.ativo ? "#7be395" : "#ff8080" }}>
                        {p.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      <button className="link-btn" onClick={() => editar(p)}>
                        Editar
                      </button>{" "}
                      &nbsp;
                      <button className="link-btn" style={{ color: "#ff8080" }} onClick={() => excluir(p)}>
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
