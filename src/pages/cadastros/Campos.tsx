import React, { useEffect, useState } from "react";
import { PageHeader } from "../../components/Layout";
import { Field, Banner } from "../../components/Field";
import { api, ApiError, arquivoUrl, uploadArquivo } from "../../lib/api";
import { useActionNotice } from "../../lib/ActionNoticeContext";
import type { Campo } from "../../../shared/types";

const EMPTY = {
  nome: "",
  tamanhoM2: "",
  endereco: { rua: "", numero: "", bairro: "", cidade: "", cep: "" },
  localizacaoGoogle: "",
  localizacaoGps: "",
  status: "Ativo" as "Ativo" | "Inativo",
};

export default function Campos() {
  const { notify } = useActionNotice();
  const [lista, setLista] = useState<Campo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [mapaFile, setMapaFile] = useState<File | null>(null);
  const [removerMapa, setRemoverMapa] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingMapaAtual, setEditingMapaAtual] = useState<{ key: string; nome: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setLista(await api.get<Campo[]>("/campos"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao carregar campos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function novo() {
    setForm(EMPTY);
    setMapaFile(null);
    setRemoverMapa(false);
    setEditingId(null);
    setEditingMapaAtual(null);
    setFormOpen(true);
    setError(null);
  }

  function editar(c: Campo) {
    setForm({
      nome: c.nome,
      tamanhoM2: c.tamanhoM2 != null ? String(c.tamanhoM2) : "",
      endereco: c.endereco,
      localizacaoGoogle: c.localizacaoGoogle,
      localizacaoGps: c.localizacaoGps,
      status: c.ativo ? "Ativo" : "Inativo",
    });
    setMapaFile(null);
    setRemoverMapa(false);
    setEditingId(c.id);
    setEditingMapaAtual(c.mapaBlobKey ? { key: c.mapaBlobKey, nome: c.mapaNomeArquivo || "mapa" } : null);
    setFormOpen(true);
    setError(null);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        nome: form.nome,
        tamanhoM2: form.tamanhoM2 ? Number(form.tamanhoM2) : null,
        endereco: form.endereco,
        localizacaoGoogle: form.localizacaoGoogle,
        localizacaoGps: form.localizacaoGps,
        ativo: form.status === "Ativo",
      };
      if (mapaFile) {
        // Envia o arquivo primeiro (chamada própria) e só manda a referência
        // no salvamento do campo — evita payload grande demais numa só vez.
        const up = await uploadArquivo(mapaFile);
        payload.mapaBlobKey = up.blobKey;
        payload.mapaNomeArquivo = up.nomeArquivo;
      } else if (removerMapa) {
        payload.removerMapa = true;
      }
      if (editingId) {
        await api.put(`/campos`, { id: editingId, ...payload });
        notify("Campo atualizado com sucesso.");
      } else {
        await api.post(`/campos`, payload);
        notify("Campo cadastrado com sucesso.");
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function excluir(c: Campo) {
    if (!confirm(`Excluir o campo "${c.nome}"?`)) return;
    try {
      await api.del(`/campos?id=${c.id}`);
      notify("Campo excluído com sucesso.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao excluir.");
    }
  }

  return (
    <div>
      <PageHeader crumbs="Cadastros" title="Cadastro de Campos" />
      <Banner type="error">{error}</Banner>

      {formOpen && (
        <div className="card">
          <h2>{editingId ? "Editar campo" : "Novo campo"}</h2>
          <form onSubmit={salvar}>
            <div className="grid grid-2">
              <Field label="Nome do campo" required>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
                />
              </Field>
              <Field label="Tamanho (m²)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.tamanhoM2}
                  onChange={(e) => setForm({ ...form, tamanhoM2: e.target.value })}
                />
              </Field>
            </div>

            <h3 style={{ marginTop: 18 }}>Endereço</h3>
            <div className="grid grid-3">
              <Field label="Rua" required>
                <input
                  type="text"
                  value={form.endereco.rua}
                  onChange={(e) => setForm({ ...form, endereco: { ...form.endereco, rua: e.target.value } })}
                  required
                />
              </Field>
              <Field label="Número" required>
                <input
                  type="text"
                  value={form.endereco.numero}
                  onChange={(e) => setForm({ ...form, endereco: { ...form.endereco, numero: e.target.value } })}
                  required
                />
              </Field>
              <Field label="CEP" required>
                <input
                  type="text"
                  value={form.endereco.cep}
                  onChange={(e) => setForm({ ...form, endereco: { ...form.endereco, cep: e.target.value } })}
                  required
                />
              </Field>
              <Field label="Bairro" required>
                <input
                  type="text"
                  value={form.endereco.bairro}
                  onChange={(e) => setForm({ ...form, endereco: { ...form.endereco, bairro: e.target.value } })}
                  required
                />
              </Field>
              <Field label="Cidade" required>
                <input
                  type="text"
                  value={form.endereco.cidade}
                  onChange={(e) => setForm({ ...form, endereco: { ...form.endereco, cidade: e.target.value } })}
                  required
                />
              </Field>
            </div>

            <div className="grid grid-2">
              <Field label="Localização Google (link do Google Maps)">
                <input
                  type="text"
                  value={form.localizacaoGoogle}
                  onChange={(e) => setForm({ ...form, localizacaoGoogle: e.target.value })}
                  placeholder="https://maps.google.com/..."
                />
              </Field>
              <Field label="Localização GPS (lat, long)">
                <input
                  type="text"
                  value={form.localizacaoGps}
                  onChange={(e) => setForm({ ...form, localizacaoGps: e.target.value })}
                  placeholder="-23.5505, -46.6333"
                />
              </Field>
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

            <Field label="Anexar mapa do local" hint="Imagem ou PDF do mapa do campo (máx. 8MB).">
              {editingMapaAtual && !mapaFile && !removerMapa && (
                <div className="attach-chip" style={{ marginBottom: 8 }}>
                  <a href={arquivoUrl(editingMapaAtual.key)} target="_blank" rel="noreferrer">
                    {editingMapaAtual.nome}
                  </a>
                  <button type="button" className="btn-ghost" style={{ color: "#ff8080" }} onClick={() => setRemoverMapa(true)}>
                    × remover
                  </button>
                </div>
              )}
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  setMapaFile(e.target.files?.[0] || null);
                  setRemoverMapa(false);
                }}
              />
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
          <h2 style={{ marginBottom: 0 }}>Campos cadastrados</h2>
          {!formOpen && (
            <button className="btn btn-primary" onClick={novo}>
              + Novo campo
            </button>
          )}
        </div>
        {loading ? (
          <div className="spinner" />
        ) : lista.length === 0 ? (
          <div className="empty-state">Nenhum campo cadastrado ainda.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tamanho</th>
                  <th>Cidade</th>
                  <th>Mapa</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.id}>
                    <td>{c.nome}</td>
                    <td>{c.tamanhoM2 ? `${c.tamanhoM2} m²` : "—"}</td>
                    <td>{c.endereco.cidade}</td>
                    <td>
                      {c.mapaBlobKey ? (
                        <a href={arquivoUrl(c.mapaBlobKey)} target="_blank" rel="noreferrer" style={{ color: "var(--gold)" }}>
                          Ver mapa
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span className="tag" style={{ color: c.ativo ? "#7be395" : "#ff8080" }}>
                        {c.ativo ? "Ativo" : "Inativo"}
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
