import { useState } from "react";

// Hook genérico de ordenação por clique no cabeçalho da grid — usado em toda
// tela que tem uma tabela (ver SortableTh.tsx para o <th> clicável).
export interface SortState<F extends string> {
  field: F | null;
  dir: "asc" | "desc";
}

export function useSort<F extends string>() {
  const [sort, setSort] = useState<SortState<F>>({ field: null, dir: "asc" });

  function toggleSort(field: F) {
    setSort((prev) =>
      prev.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "asc" }
    );
  }

  function ordenar<T>(lista: T[], valorFn: (item: T, field: F) => string | number): T[] {
    if (!sort.field) return lista;
    const { field, dir } = sort;
    return [...lista].sort((a, b) => {
      const va = valorFn(a, field);
      const vb = valorFn(b, field);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return dir === "asc" ? cmp : -cmp;
    });
  }

  return { sort, toggleSort, ordenar };
}
