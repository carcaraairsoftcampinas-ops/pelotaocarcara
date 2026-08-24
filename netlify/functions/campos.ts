import { v4 as uuidv4 } from "uuid";
import { json, readJson, handleErrors, HttpError } from "./_lib/http";
import { requireUser, requirePerfil } from "./_lib/session";
import { listAll, getById, upsert, remove, store, base64ToArrayBuffer, STORES } from "./_lib/store";
import type { Campo, EnderecoCampo } from "../../shared/types";

interface CampoInput {
  id?: string;
  nome?: string;
  tamanhoM2?: number | null;
  endereco?: Partial<EnderecoCampo>;
  localizacaoGoogle?: string;
  localizacaoGps?: string;
  mapaBase64?: string | null;
  mapaNomeArquivo?: string | null;
  mapaContentType?: string | null;
}

function validarEndereco(e?: Partial<EnderecoCampo>): EnderecoCampo {
  if (!e || !e.rua?.trim() || !e.numero?.trim() || !e.bairro?.trim() || !e.cidade?.trim() || !e.cep?.trim()) {
    throw new HttpError(400, "Endereço completo (rua, número, bairro, cidade, CEP) é obrigatório.");
  }
  return {
    rua: e.rua.trim(),
    numero: e.numero.trim(),
    bairro: e.bairro.trim(),
    cidade: e.cidade.trim(),
    cep: e.cep.trim(),
  };
}

async function salvarMapa(input: CampoInput): Promise<{ mapaBlobKey: string; mapaNomeArquivo: string } | null> {
  if (!input.mapaBase64) return null;
  const bytes = base64ToArrayBuffer(input.mapaBase64);
  if (bytes.byteLength > 8 * 1024 * 1024) {
    throw new HttpError(400, "O arquivo do mapa deve ter no máximo 8MB.");
  }
  const key = uuidv4();
  const s = store(STORES.arquivos);
  await s.set(key, bytes, {
    metadata: {
      filename: input.mapaNomeArquivo || "mapa",
      contentType: input.mapaContentType || "application/octet-stream",
    },
  });
  return { mapaBlobKey: key, mapaNomeArquivo: input.mapaNomeArquivo || "mapa" };
}

export default async (req: Request): Promise<Response> => {
  return handleErrors(async () => {
    const user = requireUser(req);
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (req.method === "GET") {
      if (id) {
        const c = await getById<Campo>(STORES.campos, id);
        if (!c) throw new HttpError(404, "Campo não encontrado.");
        return json(200, c);
      }
      const all = await listAll<Campo>(STORES.campos);
      all.sort((a, b) => a.nome.localeCompare(b.nome));
      return json(200, all);
    }

    // Escrita é restrita a Administrador.
    requirePerfil(user, ["Administrador"]);

    if (req.method === "POST") {
      const input = await readJson<CampoInput>(req);
      if (!input.nome?.trim()) throw new HttpError(400, "Nome do campo é obrigatório.");
      const endereco = validarEndereco(input.endereco);
      const mapa = await salvarMapa(input);
      const now = new Date().toISOString();
      const record: Campo = {
        id: uuidv4(),
        nome: input.nome.trim(),
        tamanhoM2: input.tamanhoM2 ?? null,
        endereco,
        localizacaoGoogle: input.localizacaoGoogle?.trim() || "",
        localizacaoGps: input.localizacaoGps?.trim() || "",
        mapaBlobKey: mapa?.mapaBlobKey ?? null,
        mapaNomeArquivo: mapa?.mapaNomeArquivo ?? null,
        createdAt: now,
        updatedAt: now,
      };
      await upsert(STORES.campos, record);
      return json(201, record);
    }

    if (req.method === "PUT") {
      const input = await readJson<CampoInput>(req);
      if (!input.id) throw new HttpError(400, "id é obrigatório.");
      const existing = await getById<Campo>(STORES.campos, input.id);
      if (!existing) throw new HttpError(404, "Campo não encontrado.");
      if (!input.nome?.trim()) throw new HttpError(400, "Nome do campo é obrigatório.");
      const endereco = validarEndereco(input.endereco);
      const novoMapa = await salvarMapa(input);
      if (novoMapa && existing.mapaBlobKey) {
        await store(STORES.arquivos).delete(existing.mapaBlobKey).catch(() => {});
      }
      const updated: Campo = {
        ...existing,
        nome: input.nome.trim(),
        tamanhoM2: input.tamanhoM2 ?? null,
        endereco,
        localizacaoGoogle: input.localizacaoGoogle?.trim() || "",
        localizacaoGps: input.localizacaoGps?.trim() || "",
        mapaBlobKey: novoMapa?.mapaBlobKey ?? existing.mapaBlobKey,
        mapaNomeArquivo: novoMapa?.mapaNomeArquivo ?? existing.mapaNomeArquivo,
        updatedAt: new Date().toISOString(),
      };
      await upsert(STORES.campos, updated);
      return json(200, updated);
    }

    if (req.method === "DELETE") {
      if (!id) throw new HttpError(400, "id é obrigatório.");
      const existing = await getById<Campo>(STORES.campos, id);
      if (existing?.mapaBlobKey) {
        await store(STORES.arquivos).delete(existing.mapaBlobKey).catch(() => {});
      }
      await remove(STORES.campos, id);
      return json(200, { ok: true });
    }

    throw new HttpError(405, "Método não permitido.");
  });
};
