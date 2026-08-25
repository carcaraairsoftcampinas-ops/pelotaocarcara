import React from "react";
import { PageHeader } from "../../components/Layout";

export default function Inventario() {
  return (
    <div>
      <PageHeader crumbs="Missões" title="Inventário" />
      <div className="card">
        <div className="empty-state">Em breve.</div>
      </div>
    </div>
  );
}
