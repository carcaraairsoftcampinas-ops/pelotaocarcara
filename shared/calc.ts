import type { ItemCompra, ItemInvestimento, ItemCredito, ItemPedido, LancamentoFinanceiro } from "./types";

export function totalItensCompra(itens: ItemCompra[]): number {
  return itens.reduce((sum, i) => sum + (Number(i.quantidade) || 0) * (Number(i.valorUnitario) || 0), 0);
}

export function totalInvestimentos(itens: ItemInvestimento[]): number {
  return itens.reduce((sum, i) => sum + (Number(i.quantidade) || 0) * (Number(i.valorUnitario) || 0), 0);
}

export function totalCreditosItens(itens: ItemCredito[]): number {
  return itens.reduce((sum, c) => sum + (Number(c.valor) || 0), 0);
}

export function totalPedidos(itens: ItemPedido[]): number {
  return itens.reduce((sum, p) => sum + (Number(p.quantidade) || 0) * (Number(p.valorUnitario) || 0), 0);
}

// Quando o lançamento tem Pedidos habilitado, o "recebido" do lançamento
// vem do total de pedidos em vez do bloco Créditos (que fica vazio/oculto).
export function totalRecebidoLancamento(
  l: Pick<LancamentoFinanceiro, "temPedido" | "creditos" | "pedidos">
): number {
  return l.temPedido ? totalPedidos(l.pedidos || []) : totalCreditosItens(l.creditos || []);
}

export function resultadoLancamento(
  l: Pick<LancamentoFinanceiro, "creditos" | "investimentos" | "temPedido" | "pedidos">
): number {
  return totalRecebidoLancamento(l) - totalInvestimentos(l.investimentos);
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
