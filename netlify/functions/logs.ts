import { json, readJson, handleErrors, HttpError } from "./_lib/http";
import { requireUser, requirePerfil } from "./_lib/session";
import { listAll, getById, upsert, STORES } from "./_lib/store";
import type { LogEntry } from "../../shared/types";

interface LogUpdateInput {
  id?: string;
  detalhes?: string;
}

export default async (req: Request): Promise<Response> => {
  return handleErrors(async () => {
    const user = requireUser(req);

    if (req.method === "GET") {
      // Auditoria: qualquer perfil autenticado pode visualizar todos os logs.
      let all = await listAll<LogEntry>(STORES.logs);

      const url = new URL(req.url);
      const entidadeTipo = url.searchParams.get("entidadeTipo");
      const entidadeId = url.searchParams.get("entidadeId");
      const dataInicio = url.searchParams.get("dataInicio");
      const dataFim = url.searchParams.get("dataFim");
      const busca = url.searchParams.get("busca");

      if (entidadeTipo) all = all.filter((l) => l.entidadeTipo === entidadeTipo);
      if (entidadeId) all = all.filter((l) => l.entidadeId === entidadeId);
      if (dataInicio) all = all.filter((l) => l.data.slice(0, 10) >= dataInicio);
      if (dataFim) all = all.filter((l) => l.data.slice(0, 10) <= dataFim);
      if (busca) all = all.filter((l) => l.entidadeNome.toLowerCase().includes(busca.toLowerCase()));

      all.sort((a, b) => b.data.localeCompare(a.data));
      return json(200, all);
    }

    if (req.method === "PUT") {
      // Só Administrador pode corrigir o texto de um registro já existente
      // (ex.: um erro de digitação numa observação) — o registro em si nunca
      // muda de autor/data/ação original, só o campo `detalhes`.
      requirePerfil(user, ["Administrador"]);
      const input = await readJson<LogUpdateInput>(req);
      if (!input.id) throw new HttpError(400, "id é obrigatório.");
      const existing = await getById<LogEntry>(STORES.logs, input.id);
      if (!existing) throw new HttpError(404, "Registro de log não encontrado.");
      const updated: LogEntry = { ...existing, detalhes: input.detalhes?.trim() ?? existing.detalhes };
      await upsert(STORES.logs, updated);
      return json(200, updated);
    }

    throw new HttpError(405, "Método não permitido.");
  });
};
