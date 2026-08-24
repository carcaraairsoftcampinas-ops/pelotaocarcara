import { v4 as uuidv4 } from "uuid";
import { json, readJson, handleErrors, HttpError } from "./_lib/http";
import { requireUser, requirePerfil } from "./_lib/session";
import { listAll, getById, upsert, remove, STORES } from "./_lib/store";
import type { Colaborador, Perfil } from "../../shared/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERFIS_VALIDOS: Perfil[] = ["Administrador", "Colaborador", "Financeiro", "Coordenador"];

function validar(input: Partial<Colaborador>) {
  if (!input.nome || typeof input.nome !== "string" || !input.nome.trim()) {
    throw new HttpError(400, "Nome é obrigatório.");
  }
  if (!input.sobrenome || typeof input.sobrenome !== "string" || !input.sobrenome.trim()) {
    throw new HttpError(400, "Sobrenome é obrigatório.");
  }
  if (!input.email || !EMAIL_RE.test(input.email)) {
    throw new HttpError(400, "E-mail inválido.");
  }
  if (!input.perfis || !Array.isArray(input.perfis) || input.perfis.length === 0) {
    throw new HttpError(400, "Selecione ao menos um perfil.");
  }
  if (input.perfis.some((p) => !PERFIS_VALIDOS.includes(p))) {
    throw new HttpError(400, "Perfil inválido.");
  }
  if (input.status !== "Ativo" && input.status !== "Não Ativo") {
    throw new HttpError(400, "Status é obrigatório (Ativo ou Não Ativo).");
  }
}

export default async (req: Request): Promise<Response> => {
  return handleErrors(async () => {
    const user = requireUser(req);

    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (req.method === "GET") {
      // Leitura: Administrador (tela de Cadastros) e Coordenador (filtro de
      // colaborador na Consulta de Missões). Escrita continua só Administrador.
      requirePerfil(user, ["Administrador", "Coordenador"]);
      if (id) {
        const c = await getById<Colaborador>(STORES.colaboradores, id);
        if (!c) throw new HttpError(404, "Colaborador não encontrado.");
        return json(200, c);
      }
      const all = await listAll<Colaborador>(STORES.colaboradores);
      all.sort((a, b) => a.nome.localeCompare(b.nome));
      return json(200, all);
    }

    requirePerfil(user, ["Administrador"]);

    if (req.method === "POST") {
      const input = await readJson<Partial<Colaborador>>(req);
      validar(input);
      const email = input.email!.toLowerCase().trim();
      const existentes = await listAll<Colaborador>(STORES.colaboradores);
      if (existentes.some((c) => c.email.toLowerCase() === email)) {
        throw new HttpError(409, "Já existe um colaborador com este e-mail.");
      }
      const now = new Date().toISOString();
      const record: Colaborador = {
        id: uuidv4(),
        nome: input.nome!.trim(),
        sobrenome: input.sobrenome!.trim(),
        email,
        perfis: input.perfis!,
        status: input.status!,
        createdAt: now,
        updatedAt: now,
      };
      await upsert(STORES.colaboradores, record);
      return json(201, record);
    }

    if (req.method === "PUT") {
      const input = await readJson<Partial<Colaborador> & { id?: string }>(req);
      if (!input.id) throw new HttpError(400, "id é obrigatório.");
      const existing = await getById<Colaborador>(STORES.colaboradores, input.id);
      if (!existing) throw new HttpError(404, "Colaborador não encontrado.");
      validar(input);
      const email = input.email!.toLowerCase().trim();
      const outros = (await listAll<Colaborador>(STORES.colaboradores)).filter((c) => c.id !== input.id);
      if (outros.some((c) => c.email.toLowerCase() === email)) {
        throw new HttpError(409, "Já existe outro colaborador com este e-mail.");
      }
      const updated: Colaborador = {
        ...existing,
        nome: input.nome!.trim(),
        sobrenome: input.sobrenome!.trim(),
        email,
        perfis: input.perfis!,
        status: input.status!,
        updatedAt: new Date().toISOString(),
      };
      await upsert(STORES.colaboradores, updated);
      return json(200, updated);
    }

    if (req.method === "DELETE") {
      if (!id) throw new HttpError(400, "id é obrigatório.");
      if (id === user.colaboradorId) {
        throw new HttpError(400, "Você não pode excluir seu próprio cadastro.");
      }
      await remove(STORES.colaboradores, id);
      return json(200, { ok: true });
    }

    throw new HttpError(405, "Método não permitido.");
  });
};
