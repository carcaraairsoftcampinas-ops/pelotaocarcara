import { v4 as uuidv4 } from "uuid";
import { json, readJson, handleErrors, HttpError } from "./_lib/http";
import { requireUser, requirePerfil } from "./_lib/session";
import { listAll, getById, upsert, remove, STORES } from "./_lib/store";
import type { LancamentoFinanceiro, ItemInvestimento, ItemCredito, Missao } from "../../shared/types";

// Movimentação Financeira — acesso de quem pode criar/editar lançamentos.
const ACESSO: ("Administrador" | "Financeiro" | "Coordenador")[] = ["Administrador", "Financeiro", "Coordenador"];

interface LancamentoInput {
  id?: string;
  tipo?: "missao" | "projeto";
  missaoId?: string | null;
  nomeProjeto?: string | null;
  dataInicio?: string | null;
  dataFinal?: string | null;
  observacoesDados?: string;
  investimentos?: ItemInvestimento[];
  observacoesInvestimentos?: string;
  creditos?: ItemCredito[];
  action?: "save" | "aprovacao";
}

function validarDados(input: LancamentoInput) {
  if (input.tipo !== "missao" && input.tipo !== "projeto") {
    throw new HttpError(400, "Tipo do lançamento é obrigatório (missão ou projeto).");
  }
  if (input.tipo === "missao" && !input.missaoId) {
    throw new HttpError(400, "Selecione a missão do lançamento.");
  }
  if (input.tipo === "projeto") {
    if (!input.nomeProjeto?.trim()) throw new HttpError(400, "Nome do Projeto é obrigatório.");
    if (!input.dataInicio) throw new HttpError(400, "Data Início é obrigatória.");
    if (!input.dataFinal) throw new HttpError(400, "Data Final é obrigatória.");
  }
}

function validarAprovacao(investimentos: ItemInvestimento[], creditos: ItemCredito[]) {
  if (investimentos.length === 0) {
    throw new HttpError(400, "Informe ao menos um item de investimento antes de enviar para aprovação.");
  }
  if (creditos.length === 0) {
    throw new HttpError(400, "Informe ao menos uma linha de créditos antes de enviar para aprovação.");
  }
}

function limparInvestimentos(itens: ItemInvestimento[] | undefined): ItemInvestimento[] {
  return (itens || [])
    .filter((i) => i.nome?.trim())
    .map((i) => ({
      id: i.id || uuidv4(),
      nome: i.nome.trim(),
      quantidade: Math.max(0, Number(i.quantidade) || 0),
      valorUnitario: Math.max(0, Number(i.valorUnitario) || 0),
    }));
}

function limparCreditos(itens: ItemCredito[] | undefined): ItemCredito[] {
  return (itens || [])
    .filter((c) => Number(c.valor) > 0)
    .map((c) => ({
      id: c.id || uuidv4(),
      data: c.data || "",
      descricao: c.descricao?.trim() || "",
      valor: Math.max(0, Number(c.valor) || 0),
    }));
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

      const tipo = url.searchParams.get("tipo");
      const status = url.searchParams.get("status");
      const missaoId = url.searchParams.get("missaoId");

      if (tipo) all = all.filter((l) => l.tipo === tipo);
      if (status) all = all.filter((l) => l.status === status);
      if (missaoId) all = all.filter((l) => l.missaoId === missaoId);

      all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return json(200, all);
    }

    if (req.method === "POST") {
      const input = await readJson<LancamentoInput>(req);
      validarDados(input);

      if (input.tipo === "missao") {
        const missao = await getById<Missao>(STORES.missoes, input.missaoId!);
        if (!missao) throw new HttpError(404, "Missão não encontrada.");
        if (missao.status !== "Aprovada" && missao.status !== "Finalizada") {
          throw new HttpError(400, "Só é possível lançar financeiro de missões Aprovadas ou Finalizadas.");
        }
        const existentes = await listAll<LancamentoFinanceiro>(STORES.financeiro);
        if (existentes.some((l) => l.tipo === "missao" && l.missaoId === input.missaoId)) {
          throw new HttpError(400, "Já existe um lançamento para esta missão. Edite o lançamento existente.");
        }
      }

      const investimentos = limparInvestimentos(input.investimentos);
      const creditos = limparCreditos(input.creditos);
      const now = new Date().toISOString();

      const record: LancamentoFinanceiro = {
        id: uuidv4(),
        tipo: input.tipo!,
        missaoId: input.tipo === "missao" ? input.missaoId! : null,
        nomeProjeto: input.tipo === "projeto" ? input.nomeProjeto!.trim() : null,
        dataInicio: input.tipo === "projeto" ? input.dataInicio! : null,
        dataFinal: input.tipo === "projeto" ? input.dataFinal! : null,
        observacoesDados: input.observacoesDados?.trim() || "",
        investimentos,
        observacoesInvestimentos: input.observacoesInvestimentos?.trim() || "",
        creditos,
        status: "Em Andamento",
        observacaoAprovacao: "",
        criadoPorId: user.colaboradorId,
        criadoPorNome: `${user.nome} ${user.sobrenome}`.trim(),
        historicoStatus: [
          { status: "Em Andamento", data: now, colaboradorId: user.colaboradorId, colaboradorNome: user.nome },
        ],
        createdAt: now,
        updatedAt: now,
      };

      if (input.action === "aprovacao") {
        validarAprovacao(investimentos, creditos);
        record.status = "Aprovação Pendente";
        record.historicoStatus.push({
          status: "Aprovação Pendente",
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
      if (existing.status !== "Em Andamento" && existing.status !== "Financeiro Pendente") {
        throw new HttpError(400, `Lançamentos com status "${existing.status}" não podem mais ser editados.`);
      }
      validarDados(input);

      const investimentos = limparInvestimentos(input.investimentos);
      const creditos = limparCreditos(input.creditos);
      const now = new Date().toISOString();

      const updated: LancamentoFinanceiro = {
        ...existing,
        nomeProjeto: existing.tipo === "projeto" ? input.nomeProjeto!.trim() : existing.nomeProjeto,
        dataInicio: existing.tipo === "projeto" ? input.dataInicio! : existing.dataInicio,
        dataFinal: existing.tipo === "projeto" ? input.dataFinal! : existing.dataFinal,
        observacoesDados: input.observacoesDados?.trim() || "",
        investimentos,
        observacoesInvestimentos: input.observacoesInvestimentos?.trim() || "",
        creditos,
        status: "Em Andamento",
        updatedAt: now,
      };

      if (input.action === "aprovacao") {
        validarAprovacao(investimentos, creditos);
        updated.status = "Aprovação Pendente";
        updated.historicoStatus.push({
          status: "Aprovação Pendente",
          data: now,
          colaboradorId: user.colaboradorId,
          colaboradorNome: user.nome,
        });
      } else {
        updated.historicoStatus.push({
          status: "Em Andamento",
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
      if (existing.status !== "Em Andamento") {
        throw new HttpError(400, "Só é possível excluir lançamentos em Em Andamento.");
      }
      await remove(STORES.financeiro, id);
      return json(200, { ok: true });
    }

    throw new HttpError(405, "Método não permitido.");
  });
};
