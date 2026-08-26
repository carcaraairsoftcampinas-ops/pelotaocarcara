import { json, readJson, handleErrors, HttpError } from "./_lib/http";
import { requireUser, requirePerfil } from "./_lib/session";
import { getById, upsert, STORES } from "./_lib/store";
import { registrarLog } from "./_lib/log";
import type { Missao } from "../../shared/types";

const ACAO_LOG: Record<Action, string> = {
  iniciar: "Análise iniciada",
  aprovar: "Missão aprovada",
  reprovar: "Missão reprovada",
  pendencia: "Pendência enviada",
  avaliar: "Missão avaliada e finalizada",
};

type Action = "iniciar" | "aprovar" | "reprovar" | "pendencia" | "avaliar";

interface ActionInput {
  id: string;
  action: Action;
  observacao?: string;
  estrelas?: number;
  comentario?: string;
  totalOperadoresPresentes?: number;
}

const TRANSICOES: Record<Action, { de: Missao["status"][]; para: Missao["status"] }> = {
  iniciar: { de: ["Enviado Análise"], para: "Em Análise" },
  aprovar: { de: ["Em Análise"], para: "Aprovada" },
  reprovar: { de: ["Em Análise"], para: "Reprovada" },
  pendencia: { de: ["Em Análise"], para: "Pendência" },
  avaliar: { de: ["Aprovada", "Aguardando Avaliação"], para: "Finalizada" },
};

export default async (req: Request): Promise<Response> => {
  return handleErrors(async () => {
    const user = requireUser(req);
    requirePerfil(user, ["Administrador", "Coordenador"]);
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido.");

    const input = await readJson<ActionInput>(req);
    if (!input.id || !input.action) throw new HttpError(400, "id e action são obrigatórios.");

    const missao = await getById<Missao>(STORES.missoes, input.id);
    if (!missao) throw new HttpError(404, "Missão não encontrada.");

    const transicao = TRANSICOES[input.action];
    if (!transicao) throw new HttpError(400, "Ação inválida.");
    if (!transicao.de.includes(missao.status)) {
      throw new HttpError(400, `Não é possível "${input.action}" a partir do status "${missao.status}".`);
    }

    if (input.action === "pendencia" && !input.observacao?.trim()) {
      throw new HttpError(400, "Informe uma observação explicando a pendência.");
    }
    if (input.action === "avaliar") {
      if (!input.estrelas || input.estrelas < 1 || input.estrelas > 5) {
        throw new HttpError(400, "Selecione uma avaliação de 1 a 5 estrelas.");
      }
      if (!input.totalOperadoresPresentes || input.totalOperadoresPresentes < 1) {
        throw new HttpError(400, "Informe o total de operadores presentes.");
      }
    }

    const now = new Date().toISOString();
    missao.status = transicao.para;
    missao.updatedAt = now;
    missao.historicoStatus.push({
      status: transicao.para,
      data: now,
      colaboradorId: user.colaboradorId,
      colaboradorNome: user.nome,
      observacao: input.observacao?.trim() || undefined,
    });

    if (input.action === "aprovar" || input.action === "reprovar" || input.action === "pendencia") {
      missao.observacoesAnalise = input.observacao?.trim() || "";
    }

    if (input.action === "iniciar") {
      missao.analistaId = user.colaboradorId;
      missao.analistaNome = `${user.nome} ${user.sobrenome}`.trim();
    }

    if (input.action === "avaliar") {
      missao.avaliacao = {
        estrelas: input.estrelas!,
        comentario: input.comentario?.trim() || "",
        totalOperadoresPresentes: input.totalOperadoresPresentes!,
        avaliadoPor: `${user.nome} ${user.sobrenome}`.trim(),
        avaliadoEm: now,
      };
    }

    await upsert(STORES.missoes, missao);

    const detalhesLog =
      input.action === "avaliar"
        ? `${input.estrelas} estrela(s)${input.comentario ? ` — ${input.comentario.trim()}` : ""}`
        : input.observacao?.trim() || undefined;
    await registrarLog({
      entidadeTipo: "missao",
      entidadeId: missao.id,
      entidadeNome: `${missao.nome}${missao.numero ? ` (${missao.numero})` : ""}`,
      acao: ACAO_LOG[input.action],
      detalhes: detalhesLog,
      colaboradorId: user.colaboradorId,
      colaboradorNome: user.nome,
    });

    return json(200, missao);
  });
};
