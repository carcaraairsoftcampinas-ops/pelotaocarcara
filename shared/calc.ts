import type { ItemCompra, ItemGasto, LancamentoFinanceiro } from "./types";

export function totalItensCompra(itens: ItemCompra[]): number {
  return itens.reduce((sum, i) => sum + (Number(i.quantidade) || 0) * (Number(i.valorUnitario) || 0), 0);
}

export function totalGastos(gastos: ItemGasto[]): number {
  return gastos.reduce((sum, g) => sum + (Number(g.quantidade) || 0) * (Number(g.valorUnitario) || 0), 0);
}

export function totalCreditos(creditos: LancamentoFinanceiro["creditos"]): number {
  return (Number(creditos.pix) || 0) + (Number(creditos.especie) || 0) + (Number(creditos.outros) || 0);
}

export function resultadoLancamento(l: Pick<LancamentoFinanceiro, "creditos" | "gastos">): number {
  return totalCreditos(l.creditos) - totalGastos(l.gastos);
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
