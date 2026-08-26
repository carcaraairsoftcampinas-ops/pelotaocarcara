import React from "react";
import type { SortState } from "../lib/useSort";

// Cabeçalho de coluna clicável — alterna asc/desc a cada clique e mostra
// ▲/▼ na coluna ativa. Usado junto com o hook useSort em toda tela com grid.
export function SortableTh<F extends string>({
  field,
  sort,
  onSort,
  children,
}: {
  field: F;
  sort: SortState<F>;
  onSort: (f: F) => void;
  children: React.ReactNode;
}) {
  const ativo = sort.field === field;
  return (
    <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => onSort(field)}>
      {children} {ativo ? (sort.dir === "asc" ? "▲" : "▼") : ""}
    </th>
  );
}
