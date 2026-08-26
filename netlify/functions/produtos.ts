import { v4 as uuidv4 } from "uuid";
import { json, readJson, handleErrors, HttpError } from "./_lib/http";
import { requireUser, requirePerfil } from "./_lib/session";
import { listAll, getById, upsert, remove, STORES } from "./_lib/store";
import type { Produto } from "../../shared/types";

interface ProdutoInput {
  id?: string;
  nome?: string;
  ativo?: boolean;
}

export default async (req: Request): Promise<Response> => {
  return handleErrors(async () => {
    const user = requireUser(req);
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (req.method === "GET") {
      if (id) {
        const p = await getById<Produto>(STORES.produtos, id);
        if (!p) throw new HttpError(404, "Produto não encontrado.");
        return json(200, p);
      }
      let all = await listAll<Produto>(STORES.produtos);
      if (url.searchParams.get("apenasAtivos") === "1") {
        all = all.filter((p) => p.ativo);
      }
      all.sort((a, b) => a.nome.localeCompare(b.nome));
      return json(200, all);
    }

    // Escrita é restrita a Administrador.
    requirePerfil(user, ["Administrador"]);

    if (req.method === "POST") {
      const input = await readJson<ProdutoInput>(req);
      if (!input.nome?.trim()) throw new HttpError(400, "Nome do produto é obrigatório.");
      const now = new Date().toISOString();
      const record: Produto = {
        id: uuidv4(),
        nome: input.nome.trim(),
        ativo: input.ativo ?? true,
        createdAt: now,
        updatedAt: now,
      };
      await upsert(STORES.produtos, record);
      return json(201, record);
    }

    if (req.method === "PUT") {
      const input = await readJson<ProdutoInput>(req);
      if (!input.id) throw new HttpError(400, "id é obrigatório.");
      const existing = await getById<Produto>(STORES.produtos, input.id);
      if (!existing) throw new HttpError(404, "Produto não encontrado.");

      // Alternar só o status ativo/inativo (sem reenviar o formulário todo).
      if (typeof input.ativo === "boolean" && Object.keys(input).length <= 3) {
        const updated: Produto = { ...existing, ativo: input.ativo, updatedAt: new Date().toISOString() };
        await upsert(STORES.produtos, updated);
        return json(200, updated);
      }

      if (!input.nome?.trim()) throw new HttpError(400, "Nome do produto é obrigatório.");
      const updated: Produto = {
        ...existing,
        nome: input.nome.trim(),
        ativo: input.ativo ?? existing.ativo,
        updatedAt: new Date().toISOString(),
      };
      await upsert(STORES.produtos, updated);
      return json(200, updated);
    }

    if (req.method === "DELETE") {
      if (!id) throw new HttpError(400, "id é obrigatório.");
      await remove(STORES.produtos, id);
      return json(200, { ok: true });
    }

    throw new HttpError(405, "Método não permitido.");
  });
};
