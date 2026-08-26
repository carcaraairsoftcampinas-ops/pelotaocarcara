import { v4 as uuidv4 } from "uuid";
import { json, readJson, handleErrors, HttpError } from "./_lib/http";
import { requireUser, requirePerfil } from "./_lib/session";
import { listAll, getById, upsert, remove, store, nextMissionNumber, STORES } from "./_lib/store";
import { registrarLog } from "./_lib/log";
import { totalItensCompra } from "../../shared/calc";
import type { Missao, ItemCompra, ItemNecessario, SessionUser, TipoMissao } from "../../shared/types";

// Rótulos legíveis dos campos comparados entre a versão antiga e a nova de
// uma missão editada — usado só pra montar o texto do log de auditoria.
const CAMPOS_MISSAO: [string, keyof Missao][] = [
  ["Nome", "nome"],
  ["Tipo", "tipo"],
  ["Data", "data"],
  ["Campo", "campoId"],
  ["Resumo", "resumo"],
  ["Objetivos", "objetivos"],
  ["Quantidade de operadores", "quantidadeOperadores"],
  ["Itens da missão", "itensNecessarios"],
  ["Itens de compra", "itensCompra"],
  ["Cartas", "cartas"],
  ["Imagens", "imagens"],
];

function camposAlterados(antigo: Missao, novo: Missao): string[] {
  return CAMPOS_MISSAO.filter(([, key]) => JSON.stringify(antigo[key]) !== JSON.stringify(novo[key])).map(
    ([label]) => label
  );
}

function nomeLog(m: Missao): string {
  return `${m.nome}${m.numero ? ` (${m.numero})` : ""}`;
}

interface AnexoRef {
  blobKey: string;
  nomeArquivo: string;
}

interface MissaoInput {
  id?: string;
  nome?: string;
  tipo?: TipoMissao;
  data?: string;
  campoId?: string;
  resumo?: string;
  objetivos?: string;
  quantidadeOperadores?: number | null;
  itensNecessarios?: ItemNecessario[];
  itensCompra?: ItemCompra[];
  novasCartas?: AnexoRef[]; // já enviadas via POST /arquivo antes deste request
  novasImagens?: AnexoRef[]; // idem
  removerCartasKeys?: string[];
  removerImagensKeys?: string[];
  action?: "save" | "submit" | "marcarComprado";
  itemCompraId?: string; // usado só com action = "marcarComprado"
  comprado?: boolean; // idem
}

function podeVerTudo(user: SessionUser): boolean {
  // Financeiro precisa enxergar todas as missões finalizadas para poder
  // vincular lançamentos financeiros a elas.
  return user.perfis.some((p) => p === "Administrador" || p === "Coordenador" || p === "Financeiro");
}

function validarRascunho(input: MissaoInput) {
  if (!input.nome?.trim()) throw new HttpError(400, "Nome da Missão é obrigatório.");
  if (!input.data) throw new HttpError(400, "Data da Missão é obrigatória.");
  if (!input.campoId) throw new HttpError(400, "Campo da missão é obrigatório.");
  if (!input.resumo?.trim()) throw new HttpError(400, "Resumo da Missão é obrigatório.");
  if (!input.objetivos?.trim()) throw new HttpError(400, "Objetivos da missão são obrigatórios.");
}

function validarEnvio(input: MissaoInput, cartasTotal: number) {
  validarRascunho(input);
  if (cartasTotal === 0) throw new HttpError(400, "Anexe ao menos uma Carta da Missão para enviar para análise.");
  // Imagens deixaram de ser obrigatórias pra enviar pra análise — só as Cartas continuam obrigatórias.
  if (!input.quantidadeOperadores || input.quantidadeOperadores < 1) {
    throw new HttpError(400, "Informe a quantidade de operadores para enviar para análise.");
  }
  if (!input.itensNecessarios || input.itensNecessarios.filter((i) => i.nome?.trim()).length === 0) {
    throw new HttpError(400, "Informe os itens necessários para a missão para enviar para análise.");
  }
}

// Registros criados antes da Leva 11 não têm `tipo` — assume "Evento" (o
// caso mais comum até aqui) só na leitura; a partir do próximo salvamento o
// campo já fica persistido de verdade.
function normalizarMissao(raw: any): Missao {
  return {
    ...raw,
    tipo: raw?.tipo === "Semanal" ? "Semanal" : "Evento",
    analistaId: raw?.analistaId ?? null,
    analistaNome: raw?.analistaNome ?? null,
  } as Missao;
}

function limparItensNecessarios(itens: ItemNecessario[] | undefined): ItemNecessario[] {
  return (itens || [])
    .filter((i) => i.nome?.trim())
    .map((i) => ({ nome: i.nome.trim(), quantidade: Math.max(1, Number(i.quantidade) || 1) }));
}

// Data local (YYYY-MM-DD) do servidor, pra comparar com o campo `data` da
// missão (também YYYY-MM-DD, vindo de um <input type="date">).
function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Missão "Aprovada" cuja data já passou vira "Aguardando Avaliação" sozinha,
// sem precisar de nenhum agendamento — a checagem roda toda vez que a lista
// (ou uma missão) é lida. Só grava de volta quando realmente muda algo.
async function aplicarTransicaoAutomatica(m: Missao): Promise<Missao> {
  if (m.status !== "Aprovada" || !m.data || m.data >= hojeISO()) return m;
  const now = new Date().toISOString();
  const atualizada: Missao = {
    ...m,
    status: "Aguardando Avaliação",
    updatedAt: now,
    historicoStatus: [
      ...m.historicoStatus,
      {
        status: "Aguardando Avaliação",
        data: now,
        colaboradorId: "sistema",
        colaboradorNome: "Sistema (automático)",
      },
    ],
  };
  await upsert(STORES.missoes, atualizada);
  return atualizada;
}

export default async (req: Request): Promise<Response> => {
  return handleErrors(async () => {
    const user = requireUser(req);
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (req.method === "GET") {
      if (id) {
        const m = await getById<Missao>(STORES.missoes, id);
        if (!m) throw new HttpError(404, "Missão não encontrada.");
        if (!podeVerTudo(user) && m.criadoPorId !== user.colaboradorId) {
          throw new HttpError(403, "Você só pode visualizar as missões que criou.");
        }
        return json(200, normalizarMissao(await aplicarTransicaoAutomatica(m)));
      }

      let all = await listAll<Missao>(STORES.missoes);
      if (!podeVerTudo(user)) {
        all = all.filter((m) => m.criadoPorId === user.colaboradorId);
      }
      all = await Promise.all(all.map((m) => aplicarTransicaoAutomatica(m)));
      all = all.map(normalizarMissao);

      const dataInicio = url.searchParams.get("dataInicio");
      const dataFim = url.searchParams.get("dataFim");
      const campoId = url.searchParams.get("campoId");
      const colaboradorId = url.searchParams.get("colaboradorId");
      const estrelasMin = url.searchParams.get("estrelasMin");
      const status = url.searchParams.get("status");
      const numero = url.searchParams.get("numero");

      if (dataInicio) all = all.filter((m) => m.data >= dataInicio);
      if (dataFim) all = all.filter((m) => m.data <= dataFim);
      if (campoId) all = all.filter((m) => m.campoId === campoId);
      if (colaboradorId) all = all.filter((m) => m.criadoPorId === colaboradorId);
      if (status) all = all.filter((m) => m.status === status);
      if (numero) all = all.filter((m) => (m.numero || "").toLowerCase().includes(numero.toLowerCase()));
      if (estrelasMin && podeVerTudo(user)) {
        const min = Number(estrelasMin);
        all = all.filter((m) => (m.avaliacao?.estrelas ?? 0) >= min);
      }

      all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return json(200, all);
    }

    if (req.method === "POST") {
      requirePerfil(user, ["Administrador", "Coordenador", "Colaborador"]);
      const input = await readJson<MissaoInput>(req);
      validarRascunho(input);
      const now = new Date().toISOString();
      const cartas = input.novasCartas || [];
      const imagens = input.novasImagens || [];
      const itensCompra = (input.itensCompra || []).map((i) => ({ ...i, id: i.id || uuidv4() }));

      const record: Missao = {
        id: uuidv4(),
        numero: null,
        nome: input.nome!.trim(),
        tipo: input.tipo === "Semanal" ? "Semanal" : "Evento",
        data: input.data!,
        campoId: input.campoId!,
        resumo: input.resumo!.trim(),
        objetivos: input.objetivos!.trim(),
        cartas,
        imagens,
        quantidadeOperadores: input.quantidadeOperadores ?? null,
        itensNecessarios: limparItensNecessarios(input.itensNecessarios),
        itensCompra,
        investimentoTotal: totalItensCompra(itensCompra),
        status: "Rascunho",
        criadoPorId: user.colaboradorId,
        criadoPorNome: `${user.nome} ${user.sobrenome}`.trim(),
        analistaId: null,
        analistaNome: null,
        observacoesAnalise: "",
        avaliacao: null,
        historicoStatus: [
          { status: "Rascunho", data: now, colaboradorId: user.colaboradorId, colaboradorNome: user.nome },
        ],
        dataEnvioAnalise: null,
        createdAt: now,
        updatedAt: now,
      };

      if (input.action === "submit") {
        validarEnvio(input, cartas.length);
        const dataEnvio = new Date().toISOString();
        // Missões aprovadas na mesma data geram conflito de agenda.
        const conflito = (await listAll<Missao>(STORES.missoes)).find(
          (m) => m.status === "Aprovada" && m.data === record.data
        );
        if (conflito) {
          throw new HttpError(
            409,
            `Já existe a missão "${conflito.nome}" (${conflito.numero || "sem número"}) aprovada para ${record.data}. Escolha outra data.`
          );
        }
        const year = new Date(record.data).getFullYear() || new Date().getFullYear();
        record.numero = await nextMissionNumber(year);
        record.status = "Enviado Análise";
        record.dataEnvioAnalise = dataEnvio;
        record.historicoStatus.push({
          status: "Enviado Análise",
          data: dataEnvio,
          colaboradorId: user.colaboradorId,
          colaboradorNome: user.nome,
        });
      }

      await upsert(STORES.missoes, record);
      await registrarLog({
        entidadeTipo: "missao",
        entidadeId: record.id,
        entidadeNome: nomeLog(record),
        acao: record.status === "Enviado Análise" ? "Missão criada e enviada para análise" : "Missão criada (Rascunho)",
        colaboradorId: user.colaboradorId,
        colaboradorNome: user.nome,
      });
      return json(201, record);
    }

    if (req.method === "PUT") {
      const input = await readJson<MissaoInput>(req);
      if (!input.id) throw new HttpError(400, "id é obrigatório.");
      const existing = await getById<Missao>(STORES.missoes, input.id);
      if (!existing) throw new HttpError(404, "Missão não encontrada.");

      if (input.action === "marcarComprado") {
        requirePerfil(user, ["Administrador", "Coordenador", "Financeiro"]);
        if (!input.itemCompraId) throw new HttpError(400, "itemCompraId é obrigatório.");
        if (!["Aprovada", "Aguardando Avaliação", "Finalizada"].includes(existing.status)) {
          throw new HttpError(400, "Só é possível marcar itens comprados em missões já aprovadas.");
        }
        const itensCompra = existing.itensCompra.map((i) =>
          i.id === input.itemCompraId ? { ...i, comprado: !!input.comprado } : i
        );
        const updadaComComprado: Missao = { ...existing, itensCompra, updatedAt: new Date().toISOString() };
        await upsert(STORES.missoes, updadaComComprado);
        await registrarLog({
          entidadeTipo: "missao",
          entidadeId: updadaComComprado.id,
          entidadeNome: nomeLog(updadaComComprado),
          acao: input.comprado ? "Item de compra marcado como comprado" : "Item de compra desmarcado",
          detalhes: itensCompra.find((i) => i.id === input.itemCompraId)?.nome || "",
          colaboradorId: user.colaboradorId,
          colaboradorNome: user.nome,
        });
        return json(200, updadaComComprado);
      }

      const isOwner = existing.criadoPorId === user.colaboradorId;
      const isAdmin = user.perfis.includes("Administrador");
      if (!isOwner && !isAdmin) throw new HttpError(403, "Você só pode editar missões que criou.");
      if (existing.status !== "Rascunho" && existing.status !== "Pendência") {
        throw new HttpError(400, `Missões com status "${existing.status}" não podem mais ser editadas.`);
      }

      validarRascunho(input);
      const s = store(STORES.arquivos);
      for (const key of input.removerCartasKeys || []) await s.delete(key).catch(() => {});
      for (const key of input.removerImagensKeys || []) await s.delete(key).catch(() => {});

      const cartas = [
        ...existing.cartas.filter((c) => !(input.removerCartasKeys || []).includes(c.blobKey)),
        ...(input.novasCartas || []),
      ];
      const imagens = [
        ...existing.imagens.filter((i) => !(input.removerImagensKeys || []).includes(i.blobKey)),
        ...(input.novasImagens || []),
      ];
      const itensCompra = (input.itensCompra || existing.itensCompra).map((i) => ({ ...i, id: i.id || uuidv4() }));

      const updated: Missao = {
        ...existing,
        nome: input.nome!.trim(),
        tipo: input.tipo === "Semanal" ? "Semanal" : input.tipo === "Evento" ? "Evento" : existing.tipo || "Evento",
        data: input.data!,
        campoId: input.campoId!,
        resumo: input.resumo!.trim(),
        objetivos: input.objetivos!.trim(),
        cartas,
        imagens,
        quantidadeOperadores: input.quantidadeOperadores ?? existing.quantidadeOperadores,
        itensNecessarios: limparItensNecessarios(input.itensNecessarios ?? existing.itensNecessarios),
        itensCompra,
        investimentoTotal: totalItensCompra(itensCompra),
        updatedAt: new Date().toISOString(),
      };

      if (input.action === "submit") {
        validarEnvio(input, cartas.length);
        const conflito = (await listAll<Missao>(STORES.missoes)).find(
          (m) => m.id !== updated.id && m.status === "Aprovada" && m.data === updated.data
        );
        if (conflito) {
          throw new HttpError(
            409,
            `Já existe a missão "${conflito.nome}" (${conflito.numero || "sem número"}) aprovada para ${updated.data}. Escolha outra data.`
          );
        }
        if (!updated.numero) {
          const year = new Date(updated.data).getFullYear() || new Date().getFullYear();
          updated.numero = await nextMissionNumber(year);
        }
        updated.status = "Enviado Análise";
        updated.dataEnvioAnalise = updated.updatedAt;
        updated.historicoStatus.push({
          status: "Enviado Análise",
          data: updated.updatedAt,
          colaboradorId: user.colaboradorId,
          colaboradorNome: user.nome,
        });
      }

      await upsert(STORES.missoes, updated);
      const alterados = camposAlterados(existing, updated);
      await registrarLog({
        entidadeTipo: "missao",
        entidadeId: updated.id,
        entidadeNome: nomeLog(updated),
        acao: input.action === "submit" ? "Missão editada e enviada para análise" : "Missão editada",
        detalhes: alterados.length > 0 ? `Campos alterados: ${alterados.join(", ")}.` : "Nenhum campo alterado.",
        colaboradorId: user.colaboradorId,
        colaboradorNome: user.nome,
      });
      return json(200, updated);
    }

    if (req.method === "DELETE") {
      if (!id) throw new HttpError(400, "id é obrigatório.");
      const existing = await getById<Missao>(STORES.missoes, id);
      if (!existing) throw new HttpError(404, "Missão não encontrada.");
      const isOwner = existing.criadoPorId === user.colaboradorId;
      requirePerfil(user, isOwner ? user.perfis : ["Administrador"]);
      if (existing.status !== "Rascunho") {
        throw new HttpError(400, "Só é possível excluir missões em Rascunho.");
      }
      const s = store(STORES.arquivos);
      for (const c of existing.cartas) await s.delete(c.blobKey).catch(() => {});
      for (const i of existing.imagens) await s.delete(i.blobKey).catch(() => {});
      await remove(STORES.missoes, id);
      await registrarLog({
        entidadeTipo: "missao",
        entidadeId: existing.id,
        entidadeNome: nomeLog(existing),
        acao: "Missão excluída",
        colaboradorId: user.colaboradorId,
        colaboradorNome: user.nome,
      });
      return json(200, { ok: true });
    }

    throw new HttpError(405, "Método não permitido.");
  });
};
