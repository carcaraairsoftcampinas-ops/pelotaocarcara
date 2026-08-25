import { v4 as uuidv4 } from "uuid";
import { json, readJson, handleErrors, HttpError } from "./_lib/http";
import { requireUser, requirePerfil } from "./_lib/session";
import { listAll, getById, upsert, remove, store, STORES } from "./_lib/store";
import type { Campo, EnderecoCampo } from "../../shared/types";

interface CampoInput {
  id?: string;
  nome?: string;
  tamanhoM2?: number | null;
  endereco?: Partial<EnderecoCampo>;
  localizacaoGoogle?: string;
  localizacaoGps?: string;
  // Mapa já enviado antes via POST /arquivo — aqui só chega a referência.
  mapaBlobKey?: string | null;
  mapaNomeArquivo?: string | null;
  removerMapa?: boolean;
  ativo?: boolean;
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
      let all = await listAll<Campo>(STORES.campos);
      if (url.searchParams.get("apenasAtivos") === "1") {
        all = all.filter((c) => c.ativo);
      }
      all.sort((a, b) => a.nome.localeCompare(b.nome));
      return json(200, all);
    }

    // Escrita é restrita a Administrador.
    requirePerfil(user, ["Administrador"]);

    if (req.method === "POST") {
      const input = await readJson<CampoInput>(req);
      if (!input.nome?.trim()) throw new HttpError(400, "Nome do campo é obrigatório.");
      const endereco = validarEndereco(input.endereco);
      const now = new Date().toISOString();
      const record: Campo = {
        id: uuidv4(),
        nome: input.nome.trim(),
        tamanhoM2: input.tamanhoM2 ?? null,
        endereco,
        localizacaoGoogle: input.localizacaoGoogle?.trim() || "",
        localizacaoGps: input.localizacaoGps?.trim() || "",
        mapaBlobKey: input.mapaBlobKey ?? null,
        mapaNomeArquivo: input.mapaNomeArquivo ?? null,
        ativo: input.ativo ?? true,
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

      // Alternar só o status ativo/inativo (sem reenviar o formulário todo).
      if (typeof input.ativo === "boolean" && Object.keys(input).length <= 3) {
        const updated: Campo = { ...existing, ativo: input.ativo, updatedAt: new Date().toISOString() };
        await upsert(STORES.campos, updated);
        return json(200, updated);
      }

      if (!input.nome?.trim()) throw new HttpError(400, "Nome do campo é obrigatório.");
      const endereco = validarEndereco(input.endereco);

      if ((input.removerMapa || input.mapaBlobKey) && existing.mapaBlobKey && existing.mapaBlobKey !== input.mapaBlobKey) {
        await store(STORES.arquivos).delete(existing.mapaBlobKey).catch(() => {});
      }

      const updated: Campo = {
        ...existing,
        nome: input.nome.trim(),
        tamanhoM2: input.tamanhoM2 ?? null,
        endereco,
        localizacaoGoogle: input.localizacaoGoogle?.trim() || "",
        localizacaoGps: input.localizacaoGps?.trim() || "",
        mapaBlobKey: input.removerMapa ? null : (input.mapaBlobKey ?? existing.mapaBlobKey),
        mapaNomeArquivo: input.removerMapa ? null : (input.mapaNomeArquivo ?? existing.mapaNomeArquivo),
        ativo: input.ativo ?? existing.ativo,
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
