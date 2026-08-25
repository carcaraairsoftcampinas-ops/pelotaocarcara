import { json, readJson, handleErrors, HttpError } from "./_lib/http";
import { requireUser, requirePerfil } from "./_lib/session";
import { listAll, getById, upsert, remove, nextOperadorId, STORES } from "./_lib/store";
import { GRUPOS_OPERADOR } from "../../shared/types";
import type { Operador, GrupoOperador } from "../../shared/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface OperadorInput {
  id?: string;
  nome?: string;
  sobrenome?: string;
  nomeNaLista?: string;
  aniversarioMes?: number | null;
  aniversarioAno?: number | null;
  email?: string;
  telefone?: string;
  grupos?: GrupoOperador[];
}

function validar(input: OperadorInput) {
  if (!input.nome?.trim()) throw new HttpError(400, "Nome é obrigatório.");
  if (!input.sobrenome?.trim()) throw new HttpError(400, "Sobrenome é obrigatório.");
  if (!input.nomeNaLista?.trim()) throw new HttpError(400, "Nome na lista é obrigatório.");
  if (!input.email || !EMAIL_RE.test(input.email)) throw new HttpError(400, "E-mail inválido.");
  if (!input.telefone?.trim()) throw new HttpError(400, "Número de telefone é obrigatório.");
  if (!input.grupos || input.grupos.length === 0) throw new HttpError(400, "Selecione ao menos um grupo.");
  if (input.grupos.some((g) => !GRUPOS_OPERADOR.includes(g))) throw new HttpError(400, "Grupo inválido.");
  if (input.aniversarioMes != null && (input.aniversarioMes < 1 || input.aniversarioMes > 12)) {
    throw new HttpError(400, "Mês de aniversário inválido.");
  }
}

export default async (req: Request): Promise<Response> => {
  return handleErrors(async () => {
    const user = requireUser(req);
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (req.method === "GET") {
      requirePerfil(user, ["Administrador", "Coordenador"]);
      if (id) {
        const o = await getById<Operador>(STORES.operadores, id);
        if (!o) throw new HttpError(404, "Operador não encontrado.");
        return json(200, o);
      }
      const all = await listAll<Operador>(STORES.operadores);
      all.sort((a, b) => a.nome.localeCompare(b.nome));
      return json(200, all);
    }

    requirePerfil(user, ["Administrador"]);

    if (req.method === "POST") {
      const input = await readJson<OperadorInput>(req);
      validar(input);
      const now = new Date().toISOString();
      const record: Operador = {
        id: await nextOperadorId(new Date().getFullYear()),
        nome: input.nome!.trim(),
        sobrenome: input.sobrenome!.trim(),
        nomeNaLista: input.nomeNaLista!.trim(),
        aniversarioMes: input.aniversarioMes ?? null,
        aniversarioAno: input.aniversarioAno ?? null,
        email: input.email!.trim().toLowerCase(),
        telefone: input.telefone!.trim(),
        grupos: input.grupos!,
        createdAt: now,
        updatedAt: now,
      };
      await upsert(STORES.operadores, record);
      return json(201, record);
    }

    if (req.method === "PUT") {
      const input = await readJson<OperadorInput>(req);
      if (!input.id) throw new HttpError(400, "id é obrigatório.");
      const existing = await getById<Operador>(STORES.operadores, input.id);
      if (!existing) throw new HttpError(404, "Operador não encontrado.");
      validar(input);
      const updated: Operador = {
        ...existing,
        nome: input.nome!.trim(),
        sobrenome: input.sobrenome!.trim(),
        nomeNaLista: input.nomeNaLista!.trim(),
        aniversarioMes: input.aniversarioMes ?? null,
        aniversarioAno: input.aniversarioAno ?? null,
        email: input.email!.trim().toLowerCase(),
        telefone: input.telefone!.trim(),
        grupos: input.grupos!,
        updatedAt: new Date().toISOString(),
      };
      await upsert(STORES.operadores, updated);
      return json(200, updated);
    }

    if (req.method === "DELETE") {
      if (!id) throw new HttpError(400, "id é obrigatório.");
      await remove(STORES.operadores, id);
      return json(200, { ok: true });
    }

    throw new HttpError(405, "Método não permitido.");
  });
};
