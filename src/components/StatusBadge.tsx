import React from "react";
import type { StatusFinanceiro, StatusMissao } from "../../shared/types";
import { STATUS_FINANCEIRO_COLORS, STATUS_MISSAO_COLORS } from "../../shared/types";

export function StatusBadge({ status }: { status: StatusMissao }) {
  const color = STATUS_MISSAO_COLORS[status];
  return (
    <span className="badge">
      <span className="badge-emblem" style={{ backgroundColor: color }} />
      {status}
    </span>
  );
}

export function StatusFinanceiroBadge({ status }: { status: StatusFinanceiro }) {
  const color = STATUS_FINANCEIRO_COLORS[status];
  return (
    <span className="badge">
      <span className="badge-emblem" style={{ backgroundColor: color }} />
      {status}
    </span>
  );
}

export function ColorDot({ color }: { color: string }) {
  return <span className="badge-emblem" style={{ backgroundColor: color, width: 12, height: 12 }} />;
}
