import { json, readJson, handleErrors, HttpError } from "./_lib/http";
import { requireUser, requirePerfil } from "./_lib/session";
import { getById, upsert, STORES } from "./_lib/store";
import type { LancamentoFinanceiro } from "../../shared/types";

interface ActionInput {
  id: string;
  action: "salvar" | "aprovar" | "reprovar";
  observacao?: string;
}

export default async (req: Request): Promise<Response> => {
  return handleErrors(async () => {
    const user = requireUser(req);
    requirePerfil(user, ["Administrador"]);
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido.");

    const input = await readJson<ActionInput>(req);
    if (!input.id || !input.action) throw new HttpError(400, "id e action são obrigatórios.");

    const lancamento = await getById<LancamentoFinanceiro>(STORES.financeiro, input.id);
    if (!lancamento) throw new HttpError(404, "Lançamento não encontrado.");

    if (input.action !== "salvar" && lancamento.status !== "Enviado Análise Financeira") {
      throw new HttpError(400, `Só é possível ${input.action === "aprovar" ? "aprovar" : "reprovar"} lançamentos enviados para análise financeira.`);
    }
    if (lancamento.status === "Aprovado") {
      throw new HttpError(400, "Este lançamento já foi aprovado e não pode mais ser alterado.");
    }

    const now = new Date().toISOString();
    lancamento.observacaoAprovacao = input.observacao?.trim() || lancamento.observacaoAprovacao;
    lancamento.updatedAt = now;

    if (input.action === "aprovar") {
      lancamento.status = "Aprovado";
      lancamento.historicoStatus.push({
        status: "Aprovado",
        data: now,
        colaboradorId: user.colaboradorId,
        colaboradorNome: user.nome,
        observacao: input.observacao?.trim() || undefined,
      });
    } else if (input.action === "reprovar") {
      lancamento.status = "Reprovado";
      lancamento.historicoStatus.push({
        status: "Reprovado",
        data: now,
        colaboradorId: user.colaboradorId,
        colaboradorNome: user.nome,
        observacao: input.observacao?.trim() || undefined,
      });
    }

    await upsert(STORES.financeiro, lancamento);

    return json(200, lancamento);
  });
};
