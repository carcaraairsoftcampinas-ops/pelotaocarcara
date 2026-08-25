// Combina Missões (Aprovada/Finalizada) com Lançamentos Financeiros (tipo
// "projeto", ou "missao" quando já existe um lançamento pra aquela missão)
// numa lista única de "linhas" pra exibir em Movimentação Financeira e nas
// provisões do Caixa Geral. Regra de status derivado (quando a missão ainda
// não tem lançamento): Aprovada -> "Em Andamento" (amarelo), Finalizada ->
// "Financeiro Pendente" (vermelho). Quando já existe lançamento, usa o
// status real dele.
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
}

export function buildMovimentacaoRows(missoes: Missao[], lancamentos: LancamentoFinanceiro[]): MovimentacaoRow[] {
  const rows: MovimentacaoRow[] = [];

  const relevantes = missoes.filter((m) => m.status === "Aprovada" || m.status === "Finalizada");
  for (const m of relevantes) {
    const lanc = lancamentos.find((l) => l.tipo === "missao" && l.missaoId === m.id);
    if (lanc) {
      rows.push({
        key: `missao-${m.id}`,
        origem: "missao",
        nome: m.nome,
        data: m.data,
        status: lanc.status,
        colaboradorNome: m.criadoPorNome,
        missaoId: m.id,
        lancamentoId: lanc.id,
        investimentoPrevisto: 0,
      });
    } else {
      rows.push({
        key: `missao-${m.id}`,
        origem: "missao",
        nome: m.nome,
        data: m.data,
        status: m.status === "Aprovada" ? "Em Andamento" : "Financeiro Pendente",
        colaboradorNome: m.criadoPorNome,
        missaoId: m.id,
        lancamentoId: null,
        investimentoPrevisto: m.investimentoTotal || 0,
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
    });
  }

  rows.sort((a, b) => b.data.localeCompare(a.data));
  return rows;
}
