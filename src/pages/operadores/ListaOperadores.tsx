import React from "react";
import { PageHeader } from "../../components/Layout";

export default function ListaOperadores() {
  return (
    <div>
      <PageHeader crumbs="Operadores" title="Lista de Operadores" />
      <div className="card">
        <div className="empty-state">Em breve.</div>
      </div>
    </div>
  );
}
