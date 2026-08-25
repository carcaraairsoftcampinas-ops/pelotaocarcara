import { json, readJson, handleErrors, HttpError } from "./_lib/http";
import { requireUser, requirePerfil } from "./_lib/session";
import { getById, upsert, STORES } from "./_lib/store";
import { registrarLog } from "./_lib/log";
import type { LancamentoFinanceiro, Missao } from "../../shared/types";

async function nomeLog(l: LancamentoFinanceiro): Promise<string> {
  if (l.tipo === "missao" && l.missaoId) {
    const m = await getById<Missao>(STORES.missoes, l.missaoId);
    if (m) return `${m.nome}${m.numero ? ` (${m.numero})` : ""}`;
  }
  return l.nomeProjeto || "Projeto";
}

interface ActionInput {
  id: string;
  action: "aprovar" | "reprovar";
  observacao?: string;
}

export default async (req: Request): Promise<Response> => {
  return handleErrors(async () => {
    const user = requireUser(req);
    requirePerfil(user, ["Administrador", "Coordenador"]);
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido.");

    const input = await readJson<ActionInput>(req);
    if (!input.id || !input.action) throw new HttpError(400, "id e action são obrigatórios.");
    if (!input.observacao?.trim()) {
      throw new HttpError(400, "Observações são obrigatórias para aprovar ou reprovar.");
    }

    const lancamento = await getById<LancamentoFinanceiro>(STORES.financeiro, input.id);
    if (!lancamento) throw new HttpError(404, "Lançamento não encontrado.");

    if (lancamento.status === "Financeiro Aprovado") {
      throw new HttpError(400, "Este lançamento já foi aprovado e não pode mais ser alterado.");
    }
    if (lancamento.status !== "Aprovação Pendente") {
      throw new HttpError(400, "Só é possível aprovar ou reprovar lançamentos com status Aprovação Pendente.");
    }

    const now = new Date().toISOString();
    lancamento.observacaoAprovacao = input.observacao.trim();
    lancamento.updatedAt = now;

    if (input.action === "aprovar") {
      lancamento.status = "Financeiro Aprovado";
      lancamento.historicoStatus.push({
        status: "Financeiro Aprovado",
        data: now,
        colaboradorId: user.colaboradorId,
        colaboradorNome: user.nome,
        observacao: input.observacao.trim(),
      });
    } else {
      lancamento.status = "Financeiro Pendente";
      lancamento.historicoStatus.push({
        status: "Financeiro Pendente",
        data: now,
        colaboradorId: user.colaboradorId,
        colaboradorNome: user.nome,
        observacao: input.observacao.trim(),
      });
    }

    await upsert(STORES.financeiro, lancamento);

    await registrarLog({
      entidadeTipo: "financeiro",
      entidadeId: lancamento.id,
      entidadeNome: await nomeLog(lancamento),
      acao: input.action === "aprovar" ? "Lançamento aprovado (Financeiro Aprovado)" : "Lançamento reprovado (Financeiro Pendente)",
      detalhes: input.observacao.trim(),
      colaboradorId: user.colaboradorId,
      colaboradorNome: user.nome,
    });

    return json(200, lancamento);
  });
};
