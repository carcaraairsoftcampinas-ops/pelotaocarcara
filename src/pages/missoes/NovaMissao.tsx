import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { PageHeader } from "../../components/Layout";
import { Field, Banner } from "../../components/Field";
import { api, ApiError, arquivoUrl, fileToBase64 } from "../../lib/api";
import { StatusBadge } from "../../components/StatusBadge";
import { totalItensCompra, formatBRL } from "../../../shared/calc";
import type { Campo, ItemCompra, Missao } from "../../../shared/types";

const RESUMO_EXEMPLO =
  "Serviços de inteligência internacionais identificaram que o cartel fictício \"Sombra Vermelha\" está por trás do crime organizado na região, comandado pelo líder conhecido apenas como \"El Cuervo\". Após meses de investigação, uma força-tarefa internacional foi montada para invadir o território controlado pela organização, capturar o líder e desativar os principais laboratórios de drogas e arsenais de armas identificados pela inteligência.";

const OBJETIVOS_EXEMPLO =
  "Time Força-Tarefa precisa capturar o líder e extrair ele COM VIDA, precisa sabotar 2 laboratórios de drogas e também 2 armazéns de armas do cartel.\n\nTime Sombra Vermelha precisa defender seu líder, defender seus laboratórios e seus armazéns.";

interface Anexo {
  blobKey: string;
  nomeArquivo: string;
}

export default function NovaMissao() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [campos, setCampos] = useState<Campo[]>([]);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState<"save" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [numero, setNumero] = useState<string | null>(null);
  const [status, setStatus] = useState<Missao["status"]>("Rascunho");
  const [nome, setNome] = useState("");
  const [data, setData] = useState("");
  const [campoId, setCampoId] = useState("");
  const [resumo, setResumo] = useState("");
  const [objetivos, setObjetivos] = useState("");
  const [itensNecessarios, setItensNecessarios] = useState<string[]>([]);
  const [novoItem, setNovoItem] = useState("");
  const [itensCompra, setItensCompra] = useState<ItemCompra[]>([]);
  const [cartasExistentes, setCartasExistentes] = useState<Anexo[]>([]);
  const [imagensExistentes, setImagensExistentes] = useState<Anexo[]>([]);
  const [novasCartas, setNovasCartas] = useState<File[]>([]);
  const [novasImagens, setNovasImagens] = useState<File[]>([]);
  const [removerCartas, setRemoverCartas] = useState<string[]>([]);
  const [removerImagens, setRemoverImagens] = useState<string[]>([]);

  const editavel = !id || status === "Rascunho" || status === "Pendência";

  useEffect(() => {
    api.get<Campo[]>("/campos").then(setCampos).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const m = await api.get<Missao>(`/missoes?id=${id}`);
        setNumero(m.numero);
        setStatus(m.status);
        setNome(m.nome);
        setData(m.data);
        setCampoId(m.campoId);
        setResumo(m.resumo);
        setObjetivos(m.objetivos);
        setItensNecessarios(m.itensNecessarios);
        setItensCompra(m.itensCompra);
        setCartasExistentes(m.cartas);
        setImagensExistentes(m.imagens);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Erro ao carregar missão.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  function addItemNecessario() {
    if (!novoItem.trim()) return;
    setItensNecessarios((prev) => [...prev, novoItem.trim()]);
    setNovoItem("");
  }

  function addItemCompra() {
    setItensCompra((prev) => [...prev, { id: uuidv4(), nome: "", quantidade: 1, valorUnitario: 0 }]);
  }

  function updateItemCompra(itemId: string, patch: Partial<ItemCompra>) {
    setItensCompra((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...patch } : i)));
  }

  const totalCompra = totalItensCompra(itensCompra);

  async function salvar(action: "save" | "submit") {
    setSaving(action);
    setError(null);
    setSuccess(null);
    try {
      const novasCartasB64 = await Promise.all(
        novasCartas.map(async (f) => ({ base64: await fileToBase64(f), nomeArquivo: f.name, contentType: f.type }))
      );
      const novasImagensB64 = await Promise.all(
        novasImagens.map(async (f) => ({ base64: await fileToBase64(f), nomeArquivo: f.name, contentType: f.type }))
      );

      const payload = {
        nome,
        data,
        campoId,
        resumo,
        objetivos,
        itensNecessarios,
        itensCompra,
        novasCartas: novasCartasB64,
        novasImagens: novasImagensB64,
        removerCartasKeys: removerCartas,
        removerImagensKeys: removerImagens,
        action,
      };

      let saved: Missao;
      if (id) {
        saved = await api.put<Missao>("/missoes", { id, ...payload });
      } else {
        saved = await api.post<Missao>("/missoes", payload);
      }

      setSuccess(action === "submit" ? `Missão enviada para análise (nº ${saved.numero}).` : "Rascunho salvo.");
      setTimeout(() => navigate(`/missoes/nova/${saved.id}`, { replace: true }), 600);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao salvar missão.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <PageHeader crumbs="Missões" title={id ? "Editar Missão" : "Nova Missão"} />
      <Banner type="error">{error}</Banner>
      <Banner type="success">{success}</Banner>

      {numero && (
        <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>Missão {numero}</strong>
          </div>
          <StatusBadge status={status} />
        </div>
      )}
      {!editavel && (
        <div className="banner banner-error">
          Esta missão está com status "{status}" e não pode mais ser editada.
        </div>
      )}

      <fieldset disabled={!editavel} style={{ border: "none", padding: 0, margin: 0 }}>
        <div className="card">
          <h2>Dados da missão</h2>
          <div className="grid grid-2">
            <Field label="Nome da Missão" required>
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </Field>
            <Field label="Data da Missão" required>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
            </Field>
          </div>
          <Field label="Campo da missão" required>
            <select value={campoId} onChange={(e) => setCampoId(e.target.value)} required>
              <option value="">Selecione…</option>
              {campos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Resumo Missão" required>
            <textarea
              className="placeholder-style"
              value={resumo}
              onChange={(e) => setResumo(e.target.value)}
              placeholder={RESUMO_EXEMPLO}
              rows={5}
              required
            />
          </Field>
          <Field label="Objetivos da missão" required>
            <textarea
              className="placeholder-style"
              value={objetivos}
              onChange={(e) => setObjetivos(e.target.value)}
              placeholder={OBJETIVOS_EXEMPLO}
              rows={5}
              required
            />
          </Field>
        </div>

        <div className="card">
          <h2>Itens da missão</h2>
          <p>Liste todos os itens necessários para a missão. Obrigatório para enviar para análise.</p>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <input
              type="text"
              value={novoItem}
              onChange={(e) => setNovoItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItemNecessario();
                }
              }}
              placeholder="Ex: Rádio comunicador"
            />
            <button type="button" className="btn btn-secondary" onClick={addItemNecessario}>
              + Adicionar
            </button>
          </div>
          <div className="tag-list">
            {itensNecessarios.map((item, idx) => (
              <span className="tag" key={`${item}-${idx}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {item}
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ padding: 0, color: "#ff8080" }}
                  onClick={() => setItensNecessarios((prev) => prev.filter((_, i) => i !== idx))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Itens de compra (opcional)</h2>
          <p>Se houver necessidade de comprar material para a missão, adicione os itens abaixo.</p>
          {itensCompra.map((item) => (
            <div className="item-row" key={item.id}>
              <Field label="Nome do item">
                <input
                  type="text"
                  value={item.nome}
                  onChange={(e) => updateItemCompra(item.id, { nome: e.target.value })}
                />
              </Field>
              <Field label="Quantidade">
                <input
                  type="number"
                  min={0}
                  value={item.quantidade}
                  onChange={(e) => updateItemCompra(item.id, { quantidade: Number(e.target.value) })}
                />
              </Field>
              <Field label="Valor unitário">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.valorUnitario}
                  onChange={(e) => updateItemCompra(item.id, { valorUnitario: Number(e.target.value) })}
                />
              </Field>
              <Field label="Total">
                <input type="text" readOnly value={formatBRL(item.quantidade * item.valorUnitario)} />
              </Field>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setItensCompra((prev) => prev.filter((i) => i.id !== item.id))}
              >
                Remover
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary" onClick={addItemCompra}>
            + Adicionar item
          </button>
          <div className="summary-box">
            <span>Total do investimento</span>
            <span className="value">{formatBRL(totalCompra)}</span>
          </div>
        </div>

        <div className="card">
          <h2>Anexos</h2>
          <Field label="Cartas da Missão" required hint="Obrigatório para enviar para análise.">
            <div className="attach-list">
              {cartasExistentes
                .filter((c) => !removerCartas.includes(c.blobKey))
                .map((c) => (
                  <span className="attach-chip" key={c.blobKey}>
                    <a href={arquivoUrl(c.blobKey)} target="_blank" rel="noreferrer">
                      {c.nomeArquivo}
                    </a>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ color: "#ff8080" }}
                      onClick={() => setRemoverCartas((prev) => [...prev, c.blobKey])}
                    >
                      ×
                    </button>
                  </span>
                ))}
              {novasCartas.map((f, idx) => (
                <span className="attach-chip" key={`${f.name}-${idx}`}>
                  {f.name}
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ color: "#ff8080" }}
                    onClick={() => setNovasCartas((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={(e) => setNovasCartas((prev) => [...prev, ...Array.from(e.target.files || [])])}
            />
          </Field>

          <Field label="Imagens" required hint="Obrigatório para enviar para análise.">
            <div className="attach-list">
              {imagensExistentes
                .filter((c) => !removerImagens.includes(c.blobKey))
                .map((c) => (
                  <span className="attach-chip" key={c.blobKey}>
                    <a href={arquivoUrl(c.blobKey)} target="_blank" rel="noreferrer">
                      {c.nomeArquivo}
                    </a>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ color: "#ff8080" }}
                      onClick={() => setRemoverImagens((prev) => [...prev, c.blobKey])}
                    >
                      ×
                    </button>
                  </span>
                ))}
              {novasImagens.map((f, idx) => (
                <span className="attach-chip" key={`${f.name}-${idx}`}>
                  {f.name}
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ color: "#ff8080" }}
                    onClick={() => setNovasImagens((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setNovasImagens((prev) => [...prev, ...Array.from(e.target.files || [])])}
            />
          </Field>
        </div>

        <div className="btn-row">
          <button className="btn btn-secondary" disabled={!!saving} onClick={() => salvar("save")}>
            {saving === "save" ? "Salvando…" : "Salvar como Rascunho"}
          </button>
          <button className="btn btn-primary" disabled={!!saving} onClick={() => salvar("submit")}>
            {saving === "submit" ? "Enviando…" : "Enviar para Análise"}
          </button>
        </div>
      </fieldset>
    </div>
  );
}
