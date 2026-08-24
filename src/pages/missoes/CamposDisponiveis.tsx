import React, { useEffect, useState } from "react";
import { PageHeader } from "../../components/Layout";
import { api, ApiError, arquivoUrl } from "../../lib/api";
import { Banner } from "../../components/Field";
import type { Campo } from "../../../shared/types";

export default function CamposDisponiveis() {
  const [campos, setCampos] = useState<Campo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setCampos(await api.get<Campo[]>("/campos"));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Erro ao carregar campos.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <PageHeader crumbs="Missões" title="Campos disponíveis" />
      <Banner type="error">{error}</Banner>

      {loading ? (
        <div className="spinner" />
      ) : campos.length === 0 ? (
        <div className="card">
          <div className="empty-state">Nenhum campo cadastrado ainda.</div>
        </div>
      ) : (
        <div className="grid grid-2">
          {campos.map((c) => (
            <div className="card" key={c.id}>
              <h2>{c.nome}</h2>
              <p>
                {c.endereco.rua}, {c.endereco.numero} — {c.endereco.bairro}, {c.endereco.cidade} — {c.endereco.cep}
              </p>
              {c.tamanhoM2 && <p>Tamanho: {c.tamanhoM2} m²</p>}
              {c.localizacaoGps && <p>GPS: {c.localizacaoGps}</p>}
              <div className="btn-row">
                {c.localizacaoGoogle && (
                  <a className="btn btn-secondary" href={c.localizacaoGoogle} target="_blank" rel="noreferrer">
                    Ver no Google Maps
                  </a>
                )}
                {c.mapaBlobKey && (
                  <a className="btn btn-secondary" href={arquivoUrl(c.mapaBlobKey)} target="_blank" rel="noreferrer">
                    Ver mapa anexado
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
