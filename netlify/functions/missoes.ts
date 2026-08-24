import { v4 as uuidv4 } from "uuid";
import { json, readJson, handleErrors, HttpError } from "./_lib/http";
import { requireUser, requirePerfil } from "./_lib/session";
import { listAll, getById, upsert, remove, store, nextMissionNumber, base64ToArrayBuffer, STORES } from "./_lib/store";
import { totalItensCompra } from "../../shared/calc";
import type { Missao, ItemCompra, SessionUser } from "../../shared/types";

interface AnexoInput {
  base64: string;
  nomeArquivo: string;
  contentType: string;
}

interface MissaoInput {
  id?: string;
  nome?: string;
  data?: string;
  campoId?: string;
  resumo?: string;
  objetivos?: string;
  itensNecessarios?: string[];
  itensCompra?: ItemCompra[];
  novasCartas?: AnexoInput[];
  novasImagens?: AnexoInput[];
  removerCartasKeys?: string[];
  removerImagensKeys?: string[];
  action?: "save" | "submit";
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

function validarEnvio(input: MissaoInput, cartasTotal: number, imagensTotal: number) {
  validarRascunho(input);
  if (cartasTotal === 0) throw new HttpError(400, "Anexe ao menos uma Carta da Missão para enviar para análise.");
  if (imagensTotal === 0) throw new HttpError(400, "Anexe ao menos uma Imagem para enviar para análise.");
  if (!input.itensNecessarios || input.itensNecessarios.filter((i) => i.trim()).length === 0) {
    throw new HttpError(400, "Informe os itens necessários para a missão para enviar para análise.");
  }
}

async function salvarAnexos(anexos: AnexoInput[] | undefined): Promise<{ blobKey: string; nomeArquivo: string }[]> {
  if (!anexos || anexos.length === 0) return [];
  const s = store(STORES.arquivos);
  const results: { blobKey: string; nomeArquivo: string }[] = [];
  for (const a of anexos) {
    const bytes = base64ToArrayBuffer(a.base64);
    if (bytes.byteLength > 8 * 1024 * 1024) {
      throw new HttpError(400, `O arquivo "${a.nomeArquivo}" deve ter no máximo 8MB.`);
    }
    const key = uuidv4();
    await s.set(key, bytes, { metadata: { filename: a.nomeArquivo, contentType: a.contentType } });
    results.push({ blobKey: key, nomeArquivo: a.nomeArquivo });
  }
  return results;
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
        return json(200, m);
      }

      let all = await listAll<Missao>(STORES.missoes);
      if (!podeVerTudo(user)) {
        all = all.filter((m) => m.criadoPorId === user.colaboradorId);
      }

      const dataInicio = url.searchParams.get("dataInicio");
      const dataFim = url.searchParams.get("dataFim");
      const campoId = url.searchParams.get("campoId");
      const colaboradorId = url.searchParams.get("colaboradorId");
      const estrelasMin = url.searchParams.get("estrelasMin");

      if (dataInicio) all = all.filter((m) => m.data >= dataInicio);
      if (dataFim) all = all.filter((m) => m.data <= dataFim);
      if (campoId) all = all.filter((m) => m.campoId === campoId);
      if (colaboradorId) all = all.filter((m) => m.criadoPorId === colaboradorId);
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
      const cartas = await salvarAnexos(input.novasCartas);
      const imagens = await salvarAnexos(input.novasImagens);
      const itensCompra = (input.itensCompra || []).map((i) => ({ ...i, id: i.id || uuidv4() }));

      const record: Missao = {
        id: uuidv4(),
        numero: null,
        nome: input.nome!.trim(),
        data: input.data!,
        campoId: input.campoId!,
        resumo: input.resumo!.trim(),
        objetivos: input.objetivos!.trim(),
        cartas,
        imagens,
        itensNecessarios: (input.itensNecessarios || []).map((i) => i.trim()).filter(Boolean),
        itensCompra,
        investimentoTotal: totalItensCompra(itensCompra),
        status: "Rascunho",
        criadoPorId: user.colaboradorId,
        criadoPorNome: `${user.nome} ${user.sobrenome}`.trim(),
        observacoesAnalise: "",
        avaliacao: null,
        historicoStatus: [
          { status: "Rascunho", data: now, colaboradorId: user.colaboradorId, colaboradorNome: user.nome },
        ],
        createdAt: now,
        updatedAt: now,
      };

      if (input.action === "submit") {
        validarEnvio(input, cartas.length, imagens.length);
        const year = new Date(record.data).getFullYear() || new Date().getFullYear();
        record.numero = await nextMissionNumber(year);
        record.status = "Enviado Análise";
        record.historicoStatus.push({
          status: "Enviado Análise",
          data: new Date().toISOString(),
          colaboradorId: user.colaboradorId,
          colaboradorNome: user.nome,
        });
      }

      await upsert(STORES.missoes, record);
      return json(201, record);
    }

    if (req.method === "PUT") {
      const input = await readJson<MissaoInput>(req);
      if (!input.id) throw new HttpError(400, "id é obrigatório.");
      const existing = await getById<Missao>(STORES.missoes, input.id);
      if (!existing) throw new HttpError(404, "Missão não encontrada.");

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

      const novasCartas = await salvarAnexos(input.novasCartas);
      const novasImagens = await salvarAnexos(input.novasImagens);
      const cartas = [
        ...existing.cartas.filter((c) => !(input.removerCartasKeys || []).includes(c.blobKey)),
        ...novasCartas,
      ];
      const imagens = [
        ...existing.imagens.filter((i) => !(input.removerImagensKeys || []).includes(i.blobKey)),
        ...novasImagens,
      ];
      const itensCompra = (input.itensCompra || existing.itensCompra).map((i) => ({ ...i, id: i.id || uuidv4() }));

      const updated: Missao = {
        ...existing,
        nome: input.nome!.trim(),
        data: input.data!,
        campoId: input.campoId!,
        resumo: input.resumo!.trim(),
        objetivos: input.objetivos!.trim(),
        cartas,
        imagens,
        itensNecessarios: (input.itensNecessarios ?? existing.itensNecessarios).map((i) => i.trim()).filter(Boolean),
        itensCompra,
        investimentoTotal: totalItensCompra(itensCompra),
        updatedAt: new Date().toISOString(),
      };

      if (input.action === "submit") {
        validarEnvio(input, cartas.length, imagens.length);
        if (!updated.numero) {
          const year = new Date(updated.data).getFullYear() || new Date().getFullYear();
          updated.numero = await nextMissionNumber(year);
        }
        updated.status = "Enviado Análise";
        updated.historicoStatus.push({
          status: "Enviado Análise",
          data: updated.updatedAt,
          colaboradorId: user.colaboradorId,
          colaboradorNome: user.nome,
        });
      }

      await upsert(STORES.missoes, updated);
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
      return json(200, { ok: true });
    }

    throw new HttpError(405, "Método não permitido.");
  });
};
