// Combina Missões (Aprovada/Finalizada) com Lançamentos Financeiros (tipo
// "projeto", ou "missao" quando já existe um lançamento pra aquela missão)
// numa lista única de "linhas" pra exibir em Movimentação Financeira e nas
// provisões do Caixa Geral. Regra de status derivado (quando a missão ainda
// não tem lançamento): Aprovada -> "Em Andamento" (amarelo), Finalizada ->
// "Financeiro Pendente" (vermelho). Quando já existe lançamento, usa o
// status real dele.
import { resultadoLancamento } from "../../shared/calc";
import type { LancamentoFinanceiro, Missao, StatusFinanceiro } from "../../shared/types";

export interface MovimentacaoRow {
  key: string;
  origem: "missao" | "projeto";
  nome: string;
  data: string; // usada pra ordenar/filtrar por período
  status: StatusFinanceiro;
  colaboradorNome: string;
  missaoId: string | null;
  lancamentoId: string | null; // null = missão ainda sem lançamento iniciado
  investimentoPrevisto: number; // só usado quando lancamentoId é null (soma dos itensCompra da missão)
  quantidadeOperadores: number | null; // planejado, preenchido em Nova Missão — só pra origem "missao"
  operadoresPresentes: number | null; // real, preenchido em Avaliação de Missões — só pra origem "missao"
  fechamento: number; // saldo atual da linha: créditos - despesas do lançamento (ou -investimentoPrevisto se ainda não há lançamento)
}

export function buildMovimentacaoRows(missoes: Missao[], lancamentos: LancamentoFinanceiro[]): MovimentacaoRow[] {
  const rows: MovimentacaoRow[] = [];

  const relevantes = missoes.filter((m) => m.status === "Aprovada" || m.status === "Finalizada");
  for (const m of relevantes) {
    const lanc = lancamentos.find((l) => l.tipo === "missao" && l.missaoId === m.id);
    const base = {
      nome: m.nome,
      data: m.data,
      colaboradorNome: m.criadoPorNome,
      missaoId: m.id,
      quantidadeOperadores: m.quantidadeOperadores ?? null,
      operadoresPresentes: m.avaliacao?.totalOperadoresPresentes ?? null,
    };
    if (lanc) {
      rows.push({
        key: `missao-${m.id}`,
        origem: "missao",
        ...base,
        status: lanc.status,
        lancamentoId: lanc.id,
        investimentoPrevisto: 0,
        fechamento: resultadoLancamento(lanc),
      });
    } else {
      const investimentoPrevisto = m.investimentoTotal || 0;
      rows.push({
        key: `missao-${m.id}`,
        origem: "missao",
        ...base,
        status: m.status === "Aprovada" ? "Em Andamento" : "Financeiro Pendente",
        lancamentoId: null,
        investimentoPrevisto,
        fechamento: -investimentoPrevisto,
      });
    }
  }

  for (const l of lancamentos) {
    if (l.tipo !== "projeto") continue;
    rows.push({
      key: `projeto-${l.id}`,
      origem: "projeto",
      nome: l.nomeProjeto || "Projeto",
      data: l.dataInicio || l.createdAt.slice(0, 10),
      status: l.status,
      colaboradorNome: l.criadoPorNome,
      missaoId: null,
      lancamentoId: l.id,
      investimentoPrevisto: 0,
      quantidadeOperadores: null,
      operadoresPresentes: null,
      fechamento: resultadoLancamento(l),
    });
  }

  rows.sort((a, b) => b.data.localeCompare(a.data));
  return rows;
}
