import { v4 as uuidv4 } from "uuid";
import { upsert, STORES } from "./store";
import type { LogEntidadeTipo, LogEntry } from "../../../shared/types";

interface RegistrarLogInput {
  entidadeTipo: LogEntidadeTipo;
  entidadeId: string;
  entidadeNome: string;
  acao: string;
  detalhes?: string;
  colaboradorId: string;
  colaboradorNome: string;
}

// Registra uma entrada no log de auditoria — chamado pelas funções de
// Missões e Financeiro a cada criação/edição/mudança de status. Nunca deve
// derrubar a operação principal se falhar por algum motivo (ex.: store
// indisponível), então erros aqui são só logados no console, não propagados.
export async function registrarLog(input: RegistrarLogInput): Promise<void> {
  try {
    const entry: LogEntry = {
      id: uuidv4(),
      entidadeTipo: input.entidadeTipo,
      entidadeId: input.entidadeId,
      entidadeNome: input.entidadeNome,
      acao: input.acao,
      detalhes: input.detalhes?.trim() || "",
      colaboradorId: input.colaboradorId,
      colaboradorNome: input.colaboradorNome,
      data: new Date().toISOString(),
    };
    await upsert(STORES.logs, entry);
  } catch (err) {
    console.error("Falha ao registrar log de auditoria:", err);
  }
}
