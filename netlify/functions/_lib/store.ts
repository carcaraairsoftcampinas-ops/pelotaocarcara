import { getStore } from "@netlify/blobs";

// Um "store" nomeado do Netlify Blobs por entidade. Dentro do runtime do
// Netlify (produção ou `netlify dev`), getStore() já resolve site/token
// automaticamente — não precisa de configuração manual.

export const STORES = {
  colaboradores: "colaboradores",
  campos: "campos",
  missoes: "missoes",
  financeiro: "financeiro",
  counters: "counters",
  arquivos: "arquivos",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

export function store(name: StoreName) {
  return getStore(name);
}

// Converte base64 -> ArrayBuffer "puro" (não um Uint8Array/Buffer), que é o
// que o tipo BlobInput do @netlify/blobs aceita para gravar binários.
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const buf = Buffer.from(base64, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

export async function listAll<T>(name: StoreName): Promise<T[]> {
  const s = store(name);
  const { blobs } = await s.list();
  const items = await Promise.all(
    blobs.map((b) => s.get(b.key, { type: "json" }).catch(() => null))
  );
  return items.filter((i): i is T => i !== null && i !== undefined);
}

export async function getById<T>(name: StoreName, id: string): Promise<T | null> {
  const s = store(name);
  const value = await s.get(id, { type: "json" });
  return (value as T) ?? null;
}

export async function upsert<T extends { id: string }>(name: StoreName, record: T): Promise<T> {
  const s = store(name);
  await s.setJSON(record.id, record);
  return record;
}

export async function remove(name: StoreName, id: string): Promise<void> {
  const s = store(name);
  await s.delete(id);
}

// Numeração sequencial anual (ex: 001-2026), atribuída só ao enviar p/ análise.
// Netlify Blobs não expõe um contador atômico nativo, então usamos leitura +
// escrita + reverificação com poucas tentativas — suficiente para o volume de
// uso de um time (baixíssima chance de duas pessoas enviarem no mesmo instante).
export async function nextMissionNumber(year: number): Promise<string> {
  const s = store(STORES.counters);
  const key = `missoes-${year}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = ((await s.get(key, { type: "json" })) as number | null) ?? 0;
    const next = current + 1;
    await s.setJSON(key, next);
    const verify = (await s.get(key, { type: "json" })) as number | null;
    if (verify === next) {
      return `${String(next).padStart(3, "0")}-${year}`;
    }
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 120));
  }
  throw new Error("Não foi possível gerar o número da missão. Tente novamente.");
}
