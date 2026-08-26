import { v4 as uuidv4 } from "uuid";
import { json, readJson, handleErrors, HttpError } from "./_lib/http";
import { requireUser, requirePerfil } from "./_lib/session";
import { listAll, getById, upsert, remove, STORES } from "./_lib/store";
import { registrarLog } from "./_lib/log";
import type { LancamentoFinanceiro, ItemInvestimento, ItemCredito, ItemPedido, Missao } from "../../shared/types";

// Rótulos legíveis dos campos comparados entre a versão antiga e a nova de
// um lançamento editado — usado só pra montar o texto do log de auditoria.
const CAMPOS_LANCAMENTO: [string, keyof LancamentoFinanceiro][] = [
  ["Nome do projeto", "nomeProjeto"],
  ["Data início", "dataInicio"],
  ["Data final", "dataFinal"],
  ["Observações (Dados)", "observacoesDados"],
  ["Despesas", "investimentos"],
  ["Observações (Despesas)", "observacoesInvestimentos"],
  ["Créditos", "creditos"],
  ["Vai ter pedido?", "temPedido"],
  ["Pedidos", "pedidos"],
];

function camposLancamentoAlterados(antigo: LancamentoFinanceiro, novo: LancamentoFinanceiro): string[] {
  return CAMPOS_LANCAMENTO.filter(([, key]) => JSON.stringify(antigo[key]) !== JSON.stringify(novo[key])).map(
    ([label]) => label
  );
}

async function nomeLog(l: LancamentoFinanceiro): Promise<string> {
  if (l.tipo === "missao" && l.missaoId) {
    const m = await getById<Missao>(STORES.missoes, l.missaoId);
    if (m) return `${m.nome}${m.numero ? ` (${m.numero})` : ""}`;
  }
  return l.nomeProjeto || "Projeto";
}

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
  temPedido?: boolean;
  pedidos?: ItemPedido[];
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

// Pra enviar pra Aprovação Financeira basta ter UMA despesa OU UM
// crédito/pedido lançado — não é mais obrigatório ter os dois ao mesmo tempo.
function validarAprovacao(
  investimentos: ItemInvestimento[],
  creditos: ItemCredito[],
  temPedido: boolean,
  pedidos: ItemPedido[]
) {
  const temDespesa = investimentos.length > 0;
  const temRecebimento = temPedido ? pedidos.length > 0 : creditos.length > 0;
  if (!temDespesa && !temRecebimento) {
    throw new HttpError(
      400,
      temPedido
        ? "Informe ao menos uma despesa ou um pedido antes de enviar para aprovação."
        : "Informe ao menos uma despesa ou um crédito antes de enviar para aprovação."
    );
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
      data: i.data || "",
      recebido: !!i.recebido,
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
      recebido: !!c.recebido,
    }));
}

function limparPedidos(itens: ItemPedido[] | undefined): ItemPedido[] {
  return (itens || [])
    .filter((p) => p.nomeOperador?.trim() && p.produtoId)
    .map((p) => ({
      id: p.id || uuidv4(),
      nomeOperador: p.nomeOperador.trim(),
      tamanho: p.tamanho || "",
      produtoId: p.produtoId,
      produtoNome: p.produtoNome?.trim() || "",
      quantidade: Math.max(0, Number(p.quantidade) || 0),
      valorUnitario: Math.max(0, Number(p.valorUnitario) || 0),
      recebido: !!p.recebido,
    }));
}

const STATUS_ANTIGO_PARA_NOVO: Record<string, LancamentoFinanceiro["status"]> = {
  Rascunho: "Em Andamento",
  "Enviado Análise Financeira": "Aprovação Pendente",
  Aprovado: "Financeiro Aprovado",
  Reprovado: "Financeiro Pendente",
};

// Registros criados antes da reorganização do Financeiro (Rodada 3) tinham
// outro formato (`gastos`, `creditos: {pix,especie,outros}`, status antigos).
// Sem essa normalização na leitura, o front quebra (ex: `.reduce` num objeto
// que não é mais array) e a tela inteira cai — foi a causa do "site fica
// tudo preto" ao abrir Aprovação Financeira. Normaliza tudo pro formato
// atual assim que sai do banco, sem precisar migrar os dados manualmente.
// Garante `data`/`recebido` em itens de despesa/crédito salvos antes da
// Leva 13 (que não tinham esses campos) — sem isso o front quebraria ao
// tentar ler `.data`/`.recebido` de um item antigo.
function normalizarInvestimento(i: any): ItemInvestimento {
  return {
    id: i.id || uuidv4(),
    nome: i.nome || "",
    quantidade: Number(i.quantidade) || 0,
    valorUnitario: Number(i.valorUnitario) || 0,
    data: i.data || "",
    recebido: !!i.recebido,
  };
}

function normalizarCredito(c: any): ItemCredito {
  return {
    id: c.id || uuidv4(),
    data: c.data || "",
    descricao: c.descricao || "",
    valor: Number(c.valor) || 0,
    recebido: !!c.recebido,
  };
}

// Registros criados antes da Leva 14 não têm `temPedido`/`pedidos` —
// default pra `false`/`[]` (comportamento antigo: bloco Créditos).
function normalizarPedido(p: any): ItemPedido {
  return {
    id: p.id || uuidv4(),
    nomeOperador: p.nomeOperador || "",
    tamanho: p.tamanho || "",
    produtoId: p.produtoId || "",
    produtoNome: p.produtoNome || "",
    quantidade: Number(p.quantidade) || 0,
    valorUnitario: Number(p.valorUnitario) || 0,
    recebido: !!p.recebido,
  };
}

function normalizarLancamento(raw: any): LancamentoFinanceiro {
  const investimentosBase: any[] = Array.isArray(raw.investimentos)
    ? raw.investimentos
    : Array.isArray(raw.gastos)
    ? raw.gastos
    : [];
  const investimentos: ItemInvestimento[] = investimentosBase.map(normalizarInvestimento);

  let creditosBase: any[];
  if (Array.isArray(raw.creditos)) {
    creditosBase = raw.creditos;
  } else if (raw.creditos && typeof raw.creditos === "object") {
    const c = raw.creditos;
    const dataBase = (raw.createdAt || "").slice(0, 10);
    creditosBase = [];
    if (Number(c.pix) > 0) creditosBase.push({ id: uuidv4(), data: dataBase, descricao: "PIX (migrado)", valor: Number(c.pix) });
    if (Number(c.especie) > 0) creditosBase.push({ id: uuidv4(), data: dataBase, descricao: "Espécie (migrado)", valor: Number(c.especie) });
    if (Number(c.outros) > 0) creditosBase.push({ id: uuidv4(), data: dataBase, descricao: "Outros (migrado)", valor: Number(c.outros) });
  } else {
    creditosBase = [];
  }
  const creditos: ItemCredito[] = creditosBase.map(normalizarCredito);
  const pedidos: ItemPedido[] = Array.isArray(raw.pedidos) ? raw.pedidos.map(normalizarPedido) : [];

  const status: LancamentoFinanceiro["status"] = STATUS_ANTIGO_PARA_NOVO[raw.status] || raw.status;

  return {
    id: raw.id,
    tipo: raw.tipo,
    missaoId: raw.missaoId ?? null,
    nomeProjeto: raw.nomeProjeto ?? null,
    dataInicio: raw.dataInicio ?? null,
    dataFinal: raw.dataFinal ?? null,
    observacoesDados: raw.observacoesDados || "",
    investimentos,
    observacoesInvestimentos: raw.observacoesInvestimentos || "",
    creditos,
    temPedido: !!raw.temPedido,
    pedidos,
    status,
    observacaoAprovacao: raw.observacaoAprovacao || "",
    criadoPorId: raw.criadoPorId,
    criadoPorNome: raw.criadoPorNome,
    historicoStatus: raw.historicoStatus || [],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
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
        return json(200, normalizarLancamento(l));
      }
      let all = (await listAll<LancamentoFinanceiro>(STORES.financeiro)).map(normalizarLancamento);

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

      let missaoVinculada: Missao | null = null;
      if (input.tipo === "missao") {
        missaoVinculada = await getById<Missao>(STORES.missoes, input.missaoId!);
        if (!missaoVinculada) throw new HttpError(404, "Missão não encontrada.");
        if (missaoVinculada.status !== "Aprovada" && missaoVinculada.status !== "Finalizada") {
          throw new HttpError(400, "Só é possível lançar financeiro de missões Aprovadas ou Finalizadas.");
        }
        const existentes = await listAll<LancamentoFinanceiro>(STORES.financeiro);
        if (existentes.some((l) => l.tipo === "missao" && l.missaoId === input.missaoId)) {
          throw new HttpError(400, "Já existe um lançamento para esta missão. Edite o lançamento existente.");
        }
      }

      const investimentos = limparInvestimentos(input.investimentos);
      const creditos = limparCreditos(input.creditos);
      const temPedido = input.tipo === "projeto" && !!input.temPedido;
      const pedidos = temPedido ? limparPedidos(input.pedidos) : [];
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
        temPedido,
        pedidos,
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
        validarAprovacao(investimentos, creditos, temPedido, pedidos);
        if (input.tipo === "missao" && missaoVinculada?.status !== "Finalizada") {
          throw new HttpError(
            400,
            "Só é possível enviar um lançamento de Missão para Aprovação Financeira depois que a missão estiver Finalizada."
          );
        }
        record.status = "Aprovação Pendente";
        record.historicoStatus.push({
          status: "Aprovação Pendente",
          data: now,
          colaboradorId: user.colaboradorId,
          colaboradorNome: user.nome,
        });
      }

      await upsert(STORES.financeiro, record);
      await registrarLog({
        entidadeTipo: "financeiro",
        entidadeId: record.id,
        entidadeNome: await nomeLog(record),
        acao:
          record.status === "Aprovação Pendente"
            ? "Lançamento criado e enviado para Aprovação Financeira"
            : "Lançamento criado (Em Andamento)",
        colaboradorId: user.colaboradorId,
        colaboradorNome: user.nome,
      });
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
      const temPedido = existing.tipo === "projeto" && !!input.temPedido;
      const pedidos = temPedido ? limparPedidos(input.pedidos) : [];
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
        temPedido,
        pedidos,
        status: "Em Andamento",
        updatedAt: now,
      };

      if (input.action === "aprovacao") {
        validarAprovacao(investimentos, creditos, temPedido, pedidos);
        if (existing.tipo === "missao" && existing.missaoId) {
          const missaoVinculada = await getById<Missao>(STORES.missoes, existing.missaoId);
          if (!missaoVinculada || missaoVinculada.status !== "Finalizada") {
            throw new HttpError(
              400,
              "Só é possível enviar um lançamento de Missão para Aprovação Financeira depois que a missão estiver Finalizada."
            );
          }
        }
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
      const alterados = camposLancamentoAlterados(existing, updated);
      await registrarLog({
        entidadeTipo: "financeiro",
        entidadeId: updated.id,
        entidadeNome: await nomeLog(updated),
        acao:
          input.action === "aprovacao"
            ? "Lançamento editado e enviado para Aprovação Financeira"
            : "Lançamento editado",
        detalhes: alterados.length > 0 ? `Campos alterados: ${alterados.join(", ")}.` : "Nenhum campo alterado.",
        colaboradorId: user.colaboradorId,
        colaboradorNome: user.nome,
      });
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
      await registrarLog({
        entidadeTipo: "financeiro",
        entidadeId: existing.id,
        entidadeNome: await nomeLog(existing),
        acao: "Lançamento excluído",
        colaboradorId: user.colaboradorId,
        colaboradorNome: user.nome,
      });
      return json(200, { ok: true });
    }

    throw new HttpError(405, "Método não permitido.");
  });
};
