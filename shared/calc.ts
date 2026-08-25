import type { ItemCompra, ItemInvestimento, ItemCredito, LancamentoFinanceiro } from "./types";

export function totalItensCompra(itens: ItemCompra[]): number {
  return itens.reduce((sum, i) => sum + (Number(i.quantidade) || 0) * (Number(i.valorUnitario) || 0), 0);
}

export function totalInvestimentos(itens: ItemInvestimento[]): number {
  return itens.reduce((sum, i) => sum + (Number(i.quantidade) || 0) * (Number(i.valorUnitario) || 0), 0);
}

export function totalCreditosItens(itens: ItemCredito[]): number {
  return itens.reduce((sum, c) => sum + (Number(c.valor) || 0), 0);
}

export function resultadoLancamento(l: Pick<LancamentoFinanceiro, "creditos" | "investimentos">): number {
  return totalCreditosItens(l.creditos) - totalInvestimentos(l.investimentos);
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("T")[0].split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
