import { store, listAll, upsert, remove, STORES } from "./store";
import type { StoreName } from "./store";

// Stores incluídos no backup de dados (registros JSON/cadastros). `arquivos`
// (anexos binários — cartas, imagens, mapas) fica de fora de propósito: o
// conteúdo desses arquivos não cabe com segurança dentro dos limites de
// tempo/tamanho de uma Netlify Function num único snapshot, e o que mais
// importa proteger é o histórico de missões/financeiro/cadastros — os
// próprios arquivos continuam no Netlify Blobs normalmente (só um Reset do
// Sistema os apaga). `backups` fica de fora por razão óbvia.
const NOMES_BACKUP = [
  "colaboradores",
  "campos",
  "operadores",
  "produtos",
  "missoes",
  "financeiro",
  "logs",
] as const;

type NomeBackup = (typeof NOMES_BACKUP)[number];

// Quantos backups ficam guardados ao mesmo tempo (automáticos + manuais
// somados) — ao criar um novo além desse limite, o(s) mais antigo(s) são
// apagados automaticamente.
const RETENCAO_MAXIMA = 30;

export interface BackupSnapshot {
  versao: 1;
  criadoEm: string;
  dados: Record<NomeBackup, any[]>;
  counters: Record<string, number>;
}

export interface BackupResumo {
  id: string;
  criadoEm: string;
  tamanhoBytes: number;
  contagens: Record<string, number>;
}

function idParaChave(criadoEm: string): string {
  return `backup-${criadoEm.replace(/[:.]/g, "-")}`;
}

async function snapshotCounters(): Promise<Record<string, number>> {
  const s = store(STORES.counters);
  const { blobs } = await s.list();
  const out: Record<string, number> = {};
  for (const b of blobs) {
    const v = (await s.get(b.key, { type: "json" }).catch(() => null)) as number | null;
    if (v != null) out[b.key] = v;
  }
  return out;
}

export async function criarBackup(): Promise<BackupResumo> {
  const dados = {} as Record<NomeBackup, any[]>;
  const contagens: Record<string, number> = {};
  for (const nome of NOMES_BACKUP) {
    const itens = await listAll<any>(STORES[nome]);
    dados[nome] = itens;
    contagens[nome] = itens.length;
  }
  const counters = await snapshotCounters();

  const criadoEm = new Date().toISOString();
  const snapshot: BackupSnapshot = { versao: 1, criadoEm, dados, counters };
  const id = idParaChave(criadoEm);
  const tamanhoBytes = JSON.stringify(snapshot).length;

  const s = store(STORES.backups);
  await s.setJSON(id, snapshot, {
    metadata: { criadoEm, tamanhoBytes, contagens: JSON.stringify(contagens) },
  });

  await podarBackupsAntigos();

  return { id, criadoEm, tamanhoBytes, contagens };
}

export async function listarBackups(): Promise<BackupResumo[]> {
  const s = store(STORES.backups);
  const { blobs } = await s.list();
  const resumos = await Promise.all(
    blobs.map(async (b): Promise<BackupResumo | null> => {
      const meta = await s.getMetadata(b.key).catch(() => null);
      const m = meta?.metadata as Record<string, any> | undefined;
      if (m?.criadoEm) {
        let contagens: Record<string, number> = {};
        try {
          contagens = JSON.parse(m.contagens || "{}");
        } catch {
          contagens = {};
        }
        return {
          id: b.key,
          criadoEm: String(m.criadoEm),
          tamanhoBytes: Number(m.tamanhoBytes) || 0,
          contagens,
        };
      }
      // Fallback pra backups sem metadata (não deveria acontecer, mas evita
      // sumir da lista silenciosamente) — lê o snapshot inteiro pra montar o resumo.
      const snap = (await s.get(b.key, { type: "json" }).catch(() => null)) as BackupSnapshot | null;
      if (!snap) return null;
      const contagens: Record<string, number> = {};
      for (const nome of NOMES_BACKUP) contagens[nome] = snap.dados?.[nome]?.length || 0;
      return { id: b.key, criadoEm: snap.criadoEm, tamanhoBytes: JSON.stringify(snap).length, contagens };
    })
  );
  return resumos
    .filter((r): r is BackupResumo => r !== null)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export async function podarBackupsAntigos(): Promise<void> {
  const lista = await listarBackups();
  const excedentes = lista.slice(RETENCAO_MAXIMA);
  for (const b of excedentes) {
    await remove(STORES.backups, b.id);
  }
}

export async function obterBackup(id: string): Promise<BackupSnapshot | null> {
  const s = store(STORES.backups);
  return (await s.get(id, { type: "json" }).catch(() => null)) as BackupSnapshot | null;
}

export async function excluirBackup(id: string): Promise<void> {
  await remove(STORES.backups, id);
}

// Restauração TOTAL — apaga tudo que está nos stores de dados hoje e
// substitui pelo conteúdo do backup. Não mexe em `arquivos` (fora do escopo
// do backup, ver comentário no topo) nem em `backups` (óbvio). Sem volta —
// quem chama essa função já deve ter confirmado com o usuário antes.
export async function restaurarBackup(id: string): Promise<Record<string, number>> {
  const snapshot = await obterBackup(id);
  if (!snapshot) throw new Error("Backup não encontrado.");

  const restaurados: Record<string, number> = {};

  for (const nome of NOMES_BACKUP) {
    const s = store(STORES[nome]);
    const { blobs } = await s.list();
    await Promise.all(blobs.map((b) => s.delete(b.key)));
    const itens = snapshot.dados?.[nome] || [];
    for (const item of itens) {
      await upsert(STORES[nome as StoreName], item);
    }
    restaurados[nome] = itens.length;
  }

  const sCounters = store(STORES.counters);
  const { blobs: counterBlobs } = await sCounters.list();
  await Promise.all(counterBlobs.map((b) => sCounters.delete(b.key)));
  for (const [chave, valor] of Object.entries(snapshot.counters || {})) {
    await sCounters.setJSON(chave, valor);
  }

  return restaurados;
}
