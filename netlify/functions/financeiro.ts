import { v4 as uuidv4 } from "uuid";
import { json, readJson, handleErrors, HttpError } from "./_lib/http";
import { requireUser, requirePerfil } from "./_lib/session";
import { listAll, getById, upsert, remove, STORES } from "./_lib/store";
import type { LancamentoFinanceiro, ItemGasto, Missao } from "../../shared/types";

const ACESSO: ("Administrador" | "Financeiro" | "Coordenador")[] = ["Administrador", "Financeiro", "Coordenador"];

interface LancamentoInput {
  id?: string;
  tipo?: "missao" | "projeto";
  missaoId?: string | null;
  nomeProjeto?: string | null;
  creditos?: { pix?: number; especie?: number; outros?: number };
  gastos?: ItemGasto[];
  action?: "save" | "submit";
}

function validar(input: LancamentoInput) {
  if (input.tipo !== "missao" && input.tipo !== "projeto") {
    throw new HttpError(400, "Tipo do lançamento é obrigatório (missão ou projeto).");
  }
  if (input.tipo === "missao" && !input.missaoId) {
    throw new HttpError(400, "Selecione a missão do lançamento.");
  }
  if (input.tipo === "projeto" && !input.nomeProjeto?.trim()) {
    throw new HttpError(400, "Informe o nome do projeto.");
  }
}

export default async (req: Request): Promise<Response> => {
  return handleErrors(async () => {
    const user = requireUser(req);
    requirePerfil(user, ACESSO);
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (req.method === "GET") {
      if (id) {
        const l = await getById<LancamentoFinanceiro>(STORES.financeiro, id);
        if (!l) throw new HttpError(404, "Lançamento não encontrado.");
        return json(200, l);
      }
      let all = await listAll<LancamentoFinanceiro>(STORES.financeiro);

      const dataInicio = url.searchParams.get("dataInicio");
      const dataFim = url.searchParams.get("dataFim");
      const missaoId = url.searchParams.get("missaoId");
      const status = url.searchParams.get("status");

      if (dataInicio) all = all.filter((l) => l.createdAt >= dataInicio);
      if (dataFim) all = all.filter((l) => l.createdAt <= dataFim);
      if (missaoId) all = all.filter((l) => l.missaoId === missaoId);
      if (status) all = all.filter((l) => l.status === status);

      all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return json(200, all);
    }

    if (req.method === "POST") {
      const input = await readJson<LancamentoInput>(req);
      validar(input);

      if (input.tipo === "missao") {
        const missao = await getById<Missao>(STORES.missoes, input.missaoId!);
        if (!missao) throw new HttpError(404, "Missão não encontrada.");
        if (missao.status !== "Finalizada") {
          throw new HttpError(400, "Só é possível lançar financeiro de missões já avaliadas (Finalizada).");
        }
      }

      const now = new Date().toISOString();
      const gastos = (input.gastos || []).map((g) => ({ ...g, id: g.id || uuidv4() }));
      const creditos = {
        pix: Number(input.creditos?.pix) || 0,
        especie: Number(input.creditos?.especie) || 0,
        outros: Number(input.creditos?.outros) || 0,
      };

      const record: LancamentoFinanceiro = {
        id: uuidv4(),
        tipo: input.tipo!,
        missaoId: input.tipo === "missao" ? input.missaoId! : null,
        nomeProjeto: input.tipo === "projeto" ? input.nomeProjeto!.trim() : null,
        creditos,
        gastos,
        status: "Rascunho",
        observacaoAprovacao: "",
        criadoPorId: user.colaboradorId,
        criadoPorNome: `${user.nome} ${user.sobrenome}`.trim(),
        historicoStatus: [
          { status: "Rascunho", data: now, colaboradorId: user.colaboradorId, colaboradorNome: user.nome },
        ],
        createdAt: now,
        updatedAt: now,
      };

      if (input.action === "submit") {
        record.status = "Enviado Análise Financeira";
        record.historicoStatus.push({
          status: "Enviado Análise Financeira",
          data: now,
          colaboradorId: user.colaboradorId,
          colaboradorNome: user.nome,
        });
      }

      await upsert(STORES.financeiro, record);
      return json(201, record);
    }

    if (req.method === "PUT") {
      const input = await readJson<LancamentoInput>(req);
      if (!input.id) throw new HttpError(400, "id é obrigatório.");
      const existing = await getById<LancamentoFinanceiro>(STORES.financeiro, input.id);
      if (!existing) throw new HttpError(404, "Lançamento não encontrado.");
      if (existing.status !== "Rascunho" && existing.status !== "Reprovado") {
        throw new HttpError(400, `Lançamentos com status "${existing.status}" não podem mais ser editados.`);
      }
      validar(input);

      const gastos = (input.gastos || existing.gastos).map((g) => ({ ...g, id: g.id || uuidv4() }));
      const creditos = {
        pix: Number(input.creditos?.pix) || 0,
        especie: Number(input.creditos?.especie) || 0,
        outros: Number(input.creditos?.outros) || 0,
      };
      const now = new Date().toISOString();

      const updated: LancamentoFinanceiro = {
        ...existing,
        tipo: input.tipo!,
        missaoId: input.tipo === "missao" ? input.missaoId! : null,
        nomeProjeto: input.tipo === "projeto" ? input.nomeProjeto!.trim() : null,
        creditos,
        gastos,
        updatedAt: now,
      };

      if (input.action === "submit") {
        updated.status = "Enviado Análise Financeira";
        updated.historicoStatus.push({
          status: "Enviado Análise Financeira",
          data: now,
          colaboradorId: user.colaboradorId,
          colaboradorNome: user.nome,
        });
      }

      await upsert(STORES.financeiro, updated);
      return json(200, updated);
    }

    if (req.method === "DELETE") {
      if (!id) throw new HttpError(400, "id é obrigatório.");
      const existing = await getById<LancamentoFinanceiro>(STORES.financeiro, id);
      if (!existing) throw new HttpError(404, "Lançamento não encontrado.");
      if (existing.status !== "Rascunho") throw new HttpError(400, "Só é possível excluir lançamentos em Rascunho.");
      await remove(STORES.financeiro, id);
      return json(200, { ok: true });
    }

    throw new HttpError(405, "Método não permitido.");
  });
};
