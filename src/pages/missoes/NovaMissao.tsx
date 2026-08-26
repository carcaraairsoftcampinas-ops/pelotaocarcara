import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { PageHeader } from "../../components/Layout";
import { Field, Banner } from "../../components/Field";
import { api, ApiError, arquivoUrl, uploadArquivo } from "../../lib/api";
import { useActionNotice } from "../../lib/ActionNoticeContext";
import { StatusBadge } from "../../components/StatusBadge";
import { totalItensCompra, formatBRL } from "../../../shared/calc";
import { TIPOS_MISSAO } from "../../../shared/types";
import type { Campo, ItemCompra, ItemNecessario, Missao, TipoMissao } from "../../../shared/types";

const RESUMO_EXEMPLO =
  "Serviços de inteligência internacionais identificaram que o cartel fictício \"Sombra Vermelha\" está por trás do crime organizado na região, comandado pelo líder conhecido apenas como \"El Cuervo\". Após meses de investigação, uma força-tarefa internacional foi montada para invadir o território controlado pela organização, capturar o líder e desativar os principais laboratórios de drogas e arsenais de armas identificados pela inteligência.";

const OBJETIVOS_EXEMPLO =
  "Time Força-Tarefa precisa capturar o líder e extrair ele COM VIDA, precisa sabotar 2 laboratórios de drogas e também 2 armazéns de armas do cartel.\n\nTime Sombra Vermelha precisa defender seu líder, defender seus laboratórios e seus armazéns.";

interface Anexo {
  blobKey: string;
  nomeArquivo: string;
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NovaMissao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useActionNotice();

  const [campos, setCampos] = useState<Campo[]>([]);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState<"save" | "submit" | null>(null);
  const [uploadingLabel, setUploadingLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [numero, setNumero] = useState<string | null>(null);
  const [status, setStatus] = useState<Missao["status"]>("Rascunho");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoMissao>("Evento");
  const [data, setData] = useState(hojeISO());
  const [campoId, setCampoId] = useState("");
  const [resumo, setResumo] = useState("");
  const [objetivos, setObjetivos] = useState("");
  const [quantidadeOperadores, setQuantidadeOperadores] = useState("");
  const [itensNecessarios, setItensNecessarios] = useState<ItemNecessario[]>([]);
  const [novoItemNome, setNovoItemNome] = useState("");
  const [novoItemQtd, setNovoItemQtd] = useState("1");
  const [itensCompra, setItensCompra] = useState<ItemCompra[]>([]);
  const [cartasExistentes, setCartasExistentes] = useState<Anexo[]>([]);
  const [imagensExistentes, setImagensExistentes] = useState<Anexo[]>([]);
  const [novasCartas, setNovasCartas] = useState<Anexo[]>([]);
  const [novasImagens, setNovasImagens] = useState<Anexo[]>([]);
  const [removerCartas, setRemoverCartas] = useState<string[]>([]);
  const [removerImagens, setRemoverImagens] = useState<string[]>([]);

  const editavel = !id || status === "Rascunho" || status === "Pendência";

  useEffect(() => {
    api.get<Campo[]>("/campos?apenasAtivos=1").then(setCampos).catch(() => {});
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
        setTipo(m.tipo || "Evento");
        setData(m.data);
        setCampoId(m.campoId);
        setResumo(m.resumo);
        setObjetivos(m.objetivos);
        setQuantidadeOperadores(m.quantidadeOperadores != null ? String(m.quantidadeOperadores) : "");
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
    if (!novoItemNome.trim()) return;
    setItensNecessarios((prev) => [
      ...prev,
      { nome: novoItemNome.trim(), quantidade: Math.max(1, Number(novoItemQtd) || 1) },
    ]);
    setNovoItemNome("");
    setNovoItemQtd("1");
  }

  function addItemCompra() {
    setItensCompra((prev) => [...prev, { id: uuidv4(), nome: "", quantidade: 1, valorUnitario: 0 }]);
  }

  function updateItemCompra(itemId: string, patch: Partial<ItemCompra>) {
    setItensCompra((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...patch } : i)));
  }

  async function selecionarArquivos(
    files: FileList | null,
    label: string,
    setDestino: React.Dispatch<React.SetStateAction<Anexo[]>>
  ) {
    if (!files || files.length === 0) return;
    setUploadingLabel(label);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const up = await uploadArquivo(file);
        setDestino((prev) => [...prev, up]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Erro ao enviar arquivo (${label}).`);
    } finally {
      setUploadingLabel(null);
    }
  }

  const totalCompra = totalItensCompra(itensCompra);

  function limparFormulario() {
    setNumero(null);
    setStatus("Rascunho");
    setNome("");
    setTipo("Evento");
    setData(hojeISO());
    setCampoId("");
    setResumo("");
    setObjetivos("");
    setQuantidadeOperadores("");
    setItensNecessarios([]);
    setNovoItemNome("");
    setNovoItemQtd("1");
    setItensCompra([]);
    setCartasExistentes([]);
    setImagensExistentes([]);
    setNovasCartas([]);
    setNovasImagens([]);
    setRemoverCartas([]);
    setRemoverImagens([]);
    setError(null);
  }

  function camposFaltando(): string[] {
    const faltando: string[] = [];
    if (!nome.trim()) faltando.push("Nome da Missão");
    if (!data) faltando.push("Data da Missão");
    else if (data < hojeISO()) faltando.push("Data da Missão (não pode ser anterior a hoje)");
    if (!campoId) faltando.push("Campo da missão");
    if (!resumo.trim()) faltando.push("Resumo Missão");
    if (!objetivos.trim()) faltando.push("Objetivos da missão");
    const cartasTotal = cartasExistentes.filter((c) => !removerCartas.includes(c.blobKey)).length + novasCartas.length;
    if (cartasTotal === 0) faltando.push("Cartas da Missão (anexo)");
    // Imagens deixaram de ser obrigatórias pra enviar pra análise.
    if (!quantidadeOperadores || Number(quantidadeOperadores) < 1) faltando.push("Quantidade de operadores");
    if (itensNecessarios.filter((i) => i.nome?.trim()).length === 0) faltando.push("Itens da missão");
    return faltando;
  }

  async function salvar(action: "save" | "submit") {
    if (data && data < hojeISO()) {
      notify("A Data da Missão não pode ser anterior a hoje. Corrija a data antes de salvar.");
      return;
    }
    if (action === "submit") {
      const faltando = camposFaltando();
      if (faltando.length > 0) {
        notify(`Preencha os campos obrigatórios antes de enviar para análise:\n\n${faltando.map((f) => `• ${f}`).join("\n")}`);
        return;
      }
    }
    setSaving(action);
    setError(null);
    try {
      const payload = {
        nome,
        tipo,
        data,
        campoId,
        resumo,
        objetivos,
        quantidadeOperadores: quantidadeOperadores ? Number(quantidadeOperadores) : null,
        itensNecessarios,
        itensCompra,
        novasCartas,
        novasImagens,
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

      if (action === "submit") {
        // Depois que o usuário fecha o aviso, volta pra uma Nova Missão em
        // branco (em vez de continuar na missão recém-enviada), já pronta
        // pra preencher a próxima.
        notify(`Missão enviada para análise com sucesso (nº ${saved.numero}).`, () => {
          limparFormulario();
          navigate("/missoes/nova", { replace: true });
        });
      } else {
        notify("Rascunho salvo com sucesso.");
        navigate(`/missoes/nova/${saved.id}`, { replace: true });
      }
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
            <Field label="Semanal ou Evento" required>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoMissao)}>
                {TIPOS_MISSAO.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-2">
            <Field
              label="Data da Missão"
              required
              hint="Não pode ser anterior a hoje, nem coincidir com outra missão já Aprovada."
            >
              <input type="date" value={data} min={hojeISO()} onChange={(e) => setData(e.target.value)} required />
            </Field>
            <Field label="Campo da missão" required hint="Só aparecem campos Ativos (Cadastros → Campos).">
              <select value={campoId} onChange={(e) => setCampoId(e.target.value)} required>
                <option value="">Selecione…</option>
                {campos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Quantidade de operadores" required hint="Obrigatório para enviar para análise.">
            <input
              type="number"
              min={1}
              value={quantidadeOperadores}
              onChange={(e) => setQuantidadeOperadores(e.target.value)}
            />
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
          <p>Liste todos os itens necessários e a quantidade de cada um. Obrigatório para enviar para análise.</p>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <input
              type="text"
              value={novoItemNome}
              onChange={(e) => setNovoItemNome(e.target.value)}
              placeholder="Ex: Rádio comunicador"
              style={{ flex: 1 }}
            />
            <input
              type="number"
              min={1}
              value={novoItemQtd}
              onChange={(e) => setNovoItemQtd(e.target.value)}
              style={{ width: 90 }}
              title="Quantidade"
            />
            <button type="button" className="btn btn-secondary" onClick={addItemNecessario}>
              + Adicionar
            </button>
          </div>
          {itensNecessarios.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Quantidade</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {itensNecessarios.map((item, idx) => (
                    <tr key={`${item.nome}-${idx}`}>
                      <td>{item.nome}</td>
                      <td>{item.quantidade}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ color: "#ff8080" }}
                          onClick={() => setItensNecessarios((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2>Itens de compra (opcional)</h2>
          <p>Se houver necessidade de comprar material para a missão, adicione os itens abaixo.</p>
          {itensCompra.map((item) => (
            <div key={item.id} style={{ marginBottom: 14 }}>
              <div className="item-row">
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
              <Field label="Link de compra (opcional)">
                <input
                  type="url"
                  value={item.link || ""}
                  onChange={(e) => updateItemCompra(item.id, { link: e.target.value })}
                  placeholder="https://..."
                />
              </Field>
            </div>
          ))}
          <button type="button" className="btn btn-secondary" onClick={addItemCompra}>
            + Adicionar item
          </button>
          <div className="summary-box">
            <span>Total do investimento</span>
            <span className="value" style={{ color: "var(--orange)" }}>{formatBRL(totalCompra)}</span>
          </div>
        </div>

        <div className="card">
          <h2>Anexos</h2>
          {uploadingLabel && <div className="hint">Enviando {uploadingLabel}…</div>}
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
              {novasCartas.map((f) => (
                <span className="attach-chip" key={f.blobKey}>
                  {f.nomeArquivo}
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ color: "#ff8080" }}
                    onClick={() => setNovasCartas((prev) => prev.filter((x) => x.blobKey !== f.blobKey))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => selecionarArquivos(e.target.files, "carta", setNovasCartas)}
            />
          </Field>

          <Field label="Imagens" hint="Opcional — não é mais obrigatório para enviar para análise.">
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
              {novasImagens.map((f) => (
                <span className="attach-chip" key={f.blobKey}>
                  {f.nomeArquivo}
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ color: "#ff8080" }}
                    onClick={() => setNovasImagens((prev) => prev.filter((x) => x.blobKey !== f.blobKey))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              onChange={(e) => selecionarArquivos(e.target.files, "imagem", setNovasImagens)}
            />
          </Field>
        </div>

        <div className="btn-row">
          <button className="btn btn-secondary" disabled={!!saving || !!uploadingLabel} onClick={() => salvar("save")}>
            {saving === "save" ? "Salvando…" : "Salvar como Rascunho"}
          </button>
          <button
            className="btn btn-primary"
            disabled={!!saving || !!uploadingLabel}
            onClick={() => salvar("submit")}
          >
            {saving === "submit" ? "Enviando…" : "Enviar para Análise"}
          </button>
        </div>
      </fieldset>
    </div>
  );
}
