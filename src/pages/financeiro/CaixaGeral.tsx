import React, { useEffect, useState } from "react";
import { PageHeader } from "../../components/Layout";
import { Banner } from "../../components/Field";
import { api, ApiError } from "../../lib/api";
import { totalCreditos, totalGastos, resultadoLancamento, formatBRL, formatDate } from "../../../shared/calc";
import type { LancamentoFinanceiro, Missao } from "../../../shared/types";

export default function CaixaGeral() {
  const [aprovados, setAprovados] = useState<LancamentoFinanceiro[]>([]);
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<LancamentoFinanceiro | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [l, m] = await Promise.all([
          api.get<LancamentoFinanceiro[]>("/financeiro?status=Aprovado"),
          api.get<Missao[]>("/missoes"),
        ]);
        setAprovados(l);
        setMissoes(m);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Erro ao carregar caixa geral.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalRecebido = aprovados.reduce((sum, l) => sum + totalCreditos(l.creditos), 0);
  const totalGasto = aprovados.reduce((sum, l) => sum + totalGastos(l.gastos), 0);
  const saldo = totalRecebido - totalGasto;

  function titulo(l: LancamentoFinanceiro): string {
    if (l.tipo === "missao") {
      const m = missoes.find((x) => x.id === l.missaoId);
      return m ? `${m.nome} (${m.numero})` : "Missão";
    }
    return l.nomeProjeto || "Projeto";
  }

  return (
    <div>
      <PageHeader crumbs="Financeiro" title="Caixa Geral" />
      <Banner type="error">{error}</Banner>

      {loading ? (
        <div className="spinner" />
      ) : (
        <>
          <div className="grid grid-3">
            <div className="card">
              <h2>Total recebido</h2>
              <p className="value" style={{ fontSize: 24, color: "var(--green)" }}>
                {formatBRL(totalRecebido)}
              </p>
            </div>
            <div className="card">
              <h2>Total gasto</h2>
              <p className="value" style={{ fontSize: 24, color: "var(--red)" }}>
                {formatBRL(totalGasto)}
              </p>
            </div>
            <div className="card">
              <h2>Saldo do caixa</h2>
              <p className="value" style={{ fontSize: 24, color: "var(--gold)" }}>
                {formatBRL(saldo)}
              </p>
            </div>
          </div>

          <div className="card">
            <h2>Lançamentos aprovados</h2>
            {aprovados.length === 0 ? (
              <div className="empty-state">Nenhum lançamento aprovado ainda.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Origem</th>
                      <th>Data</th>
                      <th>Recebido</th>
                      <th>Gasto</th>
                      <th>Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aprovados.map((l) => (
                      <tr key={l.id} style={{ cursor: "pointer" }} onClick={() => setDetalhe(l)}>
                        <td>{titulo(l)}</td>
                        <td>{formatDate(l.createdAt)}</td>
                        <td>{formatBRL(totalCreditos(l.creditos))}</td>
                        <td>{formatBRL(totalGastos(l.gastos))}</td>
                        <td>{formatBRL(resultadoLancamento(l))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {detalhe && (
            <div className="card">
              <h2>{titulo(detalhe)}</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qtd</th>
                      <th>Valor unit.</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalhe.gastos.map((g) => (
                      <tr key={g.id}>
                        <td>{g.nome}</td>
                        <td>{g.quantidade}</td>
                        <td>{formatBRL(g.valorUnitario)}</td>
                        <td>{formatBRL(g.quantidade * g.valorUnitario)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="btn-row">
                <button className="btn btn-secondary" onClick={() => setDetalhe(null)}>
                  Fechar
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
