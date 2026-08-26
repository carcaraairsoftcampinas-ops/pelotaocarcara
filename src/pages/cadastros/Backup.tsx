import React, { useEffect, useState } from "react";
import { PageHeader } from "../../components/Layout";
import { Field, Banner } from "../../components/Field";
import { api, ApiError, backupDownloadUrl } from "../../lib/api";
import { useActionNotice } from "../../lib/ActionNoticeContext";

interface BackupResumo {
  id: string;
  criadoEm: string;
  tamanhoBytes: number;
  contagens: Record<string, number>;
}

const FRASE_CONFIRMACAO = "RESTAURAR BACKUP";

const NOMES_AREA: Record<string, string> = {
  colaboradores: "Colaboradores",
  campos: "Campos",
  operadores: "Operadores",
  produtos: "Produtos",
  missoes: "Missões",
  financeiro: "Lançamentos financeiros",
  logs: "Logs de auditoria",
};

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function totalRegistros(contagens: Record<string, number>): number {
  return Object.values(contagens).reduce((s, n) => s + n, 0);
}

function detalheContagens(contagens: Record<string, number>): string {
  return Object.entries(contagens)
    .map(([k, v]) => `${NOMES_AREA[k] || k}: ${v}`)
    .join("\n");
}

export default function Backup() {
  const { notify } = useActionNotice();
  const [lista, setLista] = useState<BackupResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  const [restaurandoId, setRestaurandoId] = useState<string | null>(null);
  const [fraseRestaurar, setFraseRestaurar] = useState("");
  const [restaurando, setRestaurando] = useState(false);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<BackupResumo[]>("/backup");
      setLista(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao carregar backups.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function criarAgora() {
    setCriando(true);
    setError(null);
    try {
      await api.post("/backup", { acao: "criar" });
      notify("Backup criado com sucesso.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao criar backup.");
    } finally {
      setCriando(false);
    }
  }

  function abrirRestaurar(id: string) {
    setRestaurandoId(id);
    setFraseRestaurar("");
    setError(null);
  }

  async function confirmarRestaurar() {
    if (!restaurandoId || fraseRestaurar !== FRASE_CONFIRMACAO) return;
    if (
      !confirm(
        "Isso vai APAGAR os dados atuais de Colaboradores, Campos, Operadores, Produtos, Missões, Financeiro e Logs, substituindo tudo pelo conteúdo deste backup. Não pode ser desfeito. Confirma?"
      )
    ) {
      return;
    }
    setRestaurando(true);
    setError(null);
    try {
      await api.post("/backup", { acao: "restaurar", id: restaurandoId, confirmacao: fraseRestaurar });
      setRestaurandoId(null);
      notify("Backup restaurado com sucesso. Recarregue as telas do sistema para ver os dados restaurados.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao restaurar backup.");
    } finally {
      setRestaurando(false);
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este backup? Não pode ser desfeito.")) return;
    setExcluindoId(id);
    try {
      await api.del(`/backup?id=${encodeURIComponent(id)}`);
      notify("Backup excluído com sucesso.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao excluir backup.");
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <div>
      <PageHeader crumbs="Cadastros" title="Backup" />
      <Banner type="error">{error}</Banner>

      <div className="card">
        <h2>O que o backup guarda</h2>
        <p>
          Um backup guarda uma cópia de todos os registros de Colaboradores, Campos, Operadores, Produtos,
          Missões, Financeiro e Logs de auditoria, além dos contadores de numeração (número da próxima missão e
          do próximo operador).
        </p>
        <p className="hint">
          Os arquivos anexados (cartas, imagens e mapas de campo) <strong>não</strong> entram no backup — eles
          continuam guardados normalmente no sistema e só são apagados por um Reset do Sistema. Isso evita que o
          backup fique grande demais e falhe.
        </p>
        <p className="hint">
          Todos os dias às 03:00 (horário de Brasília) o sistema cria um backup automático. Os 30 backups mais
          recentes (automáticos e manuais somados) ficam guardados — os mais antigos são apagados
          automaticamente ao passar desse limite.
        </p>
        <div className="btn-row">
          <button className="btn btn-primary" disabled={criando} onClick={criarAgora}>
            {criando ? "Criando…" : "Criar backup agora"}
          </button>
        </div>
      </div>

      {restaurandoId && (
        <div className="card">
          <h2>Restaurar backup de {formatarData(lista.find((b) => b.id === restaurandoId)?.criadoEm || "")}</h2>
          <p>
            <strong>Isso vai apagar os dados atuais</strong> de Colaboradores, Campos, Operadores, Produtos,
            Missões, Financeiro e Logs, substituindo tudo pelo conteúdo deste backup. Não pode ser desfeito.
          </p>
          <Field label={`Digite "${FRASE_CONFIRMACAO}" para habilitar o botão`} required>
            <input
              type="text"
              value={fraseRestaurar}
              onChange={(e) => setFraseRestaurar(e.target.value)}
              placeholder={FRASE_CONFIRMACAO}
            />
          </Field>
          <div className="btn-row">
            <button
              className="btn btn-danger"
              disabled={fraseRestaurar !== FRASE_CONFIRMACAO || restaurando}
              onClick={confirmarRestaurar}
            >
              {restaurando ? "Restaurando…" : "Restaurar este backup"}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setRestaurandoId(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Backups disponíveis</h2>
        {loading ? (
          <div className="spinner" />
        ) : lista.length === 0 ? (
          <div className="empty-state">Nenhum backup criado ainda.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Tamanho</th>
                  <th>Registros</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((b) => (
                  <tr key={b.id}>
                    <td>{formatarData(b.criadoEm)}</td>
                    <td>{formatarTamanho(b.tamanhoBytes)}</td>
                    <td title={detalheContagens(b.contagens)}>{totalRegistros(b.contagens)}</td>
                    <td>
                      <a className="link-btn" href={backupDownloadUrl(b.id)} target="_blank" rel="noreferrer">
                        Baixar
                      </a>{" "}
                      &nbsp;
                      <button className="link-btn" onClick={() => abrirRestaurar(b.id)}>
                        Restaurar
                      </button>{" "}
                      &nbsp;
                      <button
                        className="link-btn"
                        style={{ color: "#ff8080" }}
                        disabled={excluindoId === b.id}
                        onClick={() => excluir(b.id)}
                      >
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
