import { v4 as uuidv4 } from "uuid";
import { json, readJson, handleErrors, HttpError } from "./_lib/http";
import { requireUser, requirePerfil } from "./_lib/session";
import { listAll, getById, upsert, remove, nextOperadorId, STORES } from "./_lib/store";
import { GRUPOS_WHATSAPP, PATCHES } from "../../shared/types";
import type { Operador, GrupoWhatsapp, Patch, StatusOperador, HistoricoOperadorEntry } from "../../shared/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONE_RE = /^\(\d{2}\) \d{5}-\d{4}$/;
const MILSIM_RE = /^\d{2}M\d{2}$/i;

interface HistoricoInput {
  id?: string;
  data?: string;
  texto?: string;
  registradoPorNome?: string;
  criadoEm?: string;
}

interface OperadorInput {
  id?: string;
  nome?: string;
  sobrenome?: string;
  nomeNaLista?: string;
  aniversarioDia?: number | null;
  aniversarioMes?: number | null;
  email?: string;
  telefone?: string;
  grupoWhatsapp?: GrupoWhatsapp | null;
  patch?: Patch | null;
  operadorMilsim?: boolean;
  numeroMilsim?: string | null;
  historico?: HistoricoInput[];
  status?: StatusOperador;
}

// Normaliza o histórico recebido do cliente: entradas já existentes (com
// registradoPorNome/criadoEm) passam intactas; entradas novas (recém
// adicionadas no formulário, sem esses dois campos) são carimbadas aqui no
// servidor com quem está logado e o instante real do salvamento — o cliente
// nunca pode forjar "quem registrou".
function prepararHistorico(input: HistoricoInput[] | undefined, user: { nome: string; sobrenome: string }, now: string): HistoricoOperadorEntry[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((h) => h && h.texto?.trim() && h.data)
    .map((h) => ({
      id: h.id || uuidv4(),
      data: h.data!,
      texto: h.texto!.trim(),
      registradoPorNome: h.registradoPorNome?.trim() || `${user.nome} ${user.sobrenome}`.trim(),
      criadoEm: h.criadoEm || now,
    }))
    .sort((a, b) => (a.data === b.data ? (a.criadoEm < b.criadoEm ? 1 : -1) : a.data < b.data ? 1 : -1));
}

// Registros antigos guardavam `historico` como uma única string livre.
// Converte pra lista (uma entrada, sem autor conhecido) só na leitura —
// assim que o cadastro for salvo de novo já vira lista de verdade.
function normalizarOperador(raw: any): Operador {
  let historico = raw?.historico;
  if (typeof historico === "string") {
    const texto = historico.trim();
    const dataBase = (raw.createdAt || new Date().toISOString()) as string;
    historico = texto
      ? [
          {
            id: uuidv4(),
            data: dataBase.slice(0, 10),
            texto,
            registradoPorNome: "—",
            criadoEm: dataBase,
          },
        ]
      : [];
  } else if (!Array.isArray(historico)) {
    historico = [];
  }
  return { ...raw, historico } as Operador;
}

function validar(input: OperadorInput) {
  if (!input.nome?.trim()) throw new HttpError(400, "Nome é obrigatório.");
  if (!input.sobrenome?.trim()) throw new HttpError(400, "Sobrenome é obrigatório.");
  if (!input.nomeNaLista?.trim()) throw new HttpError(400, "Nome na lista é obrigatório.");
  if (!input.email || !EMAIL_RE.test(input.email.trim())) throw new HttpError(400, "E-mail inválido.");
  if (!input.telefone || !TELEFONE_RE.test(input.telefone.trim())) {
    throw new HttpError(400, "Telefone inválido. Use o formato (XX) XXXXX-XXXX.");
  }
  if (input.aniversarioDia != null && (input.aniversarioDia < 1 || input.aniversarioDia > 31)) {
    throw new HttpError(400, "Dia de aniversário inválido.");
  }
  if (input.aniversarioMes != null && (input.aniversarioMes < 1 || input.aniversarioMes > 12)) {
    throw new HttpError(400, "Mês de aniversário inválido.");
  }
  if (input.grupoWhatsapp != null && !GRUPOS_WHATSAPP.includes(input.grupoWhatsapp)) {
    throw new HttpError(400, "Grupo WhatsApp inválido.");
  }
  if (input.patch != null && !PATCHES.includes(input.patch)) {
    throw new HttpError(400, "Patch inválido.");
  }
  if (input.operadorMilsim) {
    if (!input.numeroMilsim || !MILSIM_RE.test(input.numeroMilsim.trim())) {
      throw new HttpError(400, "Número Milsim inválido. Use o formato XXMXX.");
    }
  }
  if (input.status && input.status !== "Ativo" && input.status !== "Inativo") {
    throw new HttpError(400, "Status inválido.");
  }
}

export default async (req: Request): Promise<Response> => {
  return handleErrors(async () => {
    const user = requireUser(req);
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (req.method === "GET") {
      requirePerfil(user, ["Administrador", "Coordenador", "Colaborador"]);
      if (id) {
        const o = await getById<Operador>(STORES.operadores, id);
        if (!o) throw new HttpError(404, "Operador não encontrado.");
        return json(200, normalizarOperador(o));
      }
      const all = await listAll<Operador>(STORES.operadores);
      all.sort((a, b) => a.nome.localeCompare(b.nome));
      return json(200, all.map(normalizarOperador));
    }

    requirePerfil(user, ["Administrador"]);

    if (req.method === "POST") {
      const input = await readJson<OperadorInput>(req);
      validar(input);
      const now = new Date().toISOString();
      const record: Operador = {
        id: await nextOperadorId(new Date().getFullYear()),
        nome: input.nome!.trim(),
        sobrenome: input.sobrenome!.trim(),
        nomeNaLista: input.nomeNaLista!.trim(),
        aniversarioDia: input.aniversarioDia ?? null,
        aniversarioMes: input.aniversarioMes ?? null,
        email: input.email!.trim().toLowerCase(),
        telefone: input.telefone!.trim(),
        grupoWhatsapp: input.grupoWhatsapp ?? null,
        patch: input.patch ?? null,
        operadorMilsim: !!input.operadorMilsim,
        numeroMilsim: input.operadorMilsim ? input.numeroMilsim!.trim().toUpperCase() : null,
        historico: prepararHistorico(input.historico, user, now),
        status: input.status || "Ativo",
        createdAt: now,
        updatedAt: now,
      };
      await upsert(STORES.operadores, record);
      return json(201, record);
    }

    if (req.method === "PUT") {
      const input = await readJson<OperadorInput>(req);
      if (!input.id) throw new HttpError(400, "id é obrigatório.");
      const existing = await getById<Operador>(STORES.operadores, input.id);
      if (!existing) throw new HttpError(404, "Operador não encontrado.");
      validar(input);
      const updated: Operador = {
        ...existing,
        nome: input.nome!.trim(),
        sobrenome: input.sobrenome!.trim(),
        nomeNaLista: input.nomeNaLista!.trim(),
        aniversarioDia: input.aniversarioDia ?? null,
        aniversarioMes: input.aniversarioMes ?? null,
        email: input.email!.trim().toLowerCase(),
        telefone: input.telefone!.trim(),
        grupoWhatsapp: input.grupoWhatsapp ?? null,
        patch: input.patch ?? null,
        operadorMilsim: !!input.operadorMilsim,
        numeroMilsim: input.operadorMilsim ? input.numeroMilsim!.trim().toUpperCase() : null,
        historico: prepararHistorico(input.historico, user, new Date().toISOString()),
        status: input.status || existing.status,
        updatedAt: new Date().toISOString(),
      };
      await upsert(STORES.operadores, updated);
      return json(200, updated);
    }

    if (req.method === "DELETE") {
      if (!id) throw new HttpError(400, "id é obrigatório.");
      await remove(STORES.operadores, id);
      return json(200, { ok: true });
    }

    throw new HttpError(405, "Método não permitido.");
  });
};
