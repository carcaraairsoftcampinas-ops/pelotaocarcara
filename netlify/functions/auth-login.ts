import { OAuth2Client } from "google-auth-library";
import { v4 as uuidv4 } from "uuid";
import { json, readJson, handleErrors, HttpError } from "./_lib/http";
import { signSession, buildSessionCookie } from "./_lib/session";
import { listAll, upsert, STORES } from "./_lib/store";
import type { Colaborador, SessionUser } from "../../shared/types";

export default async (req: Request): Promise<Response> => {
  return handleErrors(async () => {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido.");

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new HttpError(500, "GOOGLE_CLIENT_ID não configurado no servidor.");

    const { credential } = await readJson<{ credential?: string }>(req);
    if (!credential) throw new HttpError(400, "Credencial do Google ausente.");

    const client = new OAuth2Client(clientId);
    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw new HttpError(401, "Não foi possível validar o login do Google.");
    }
    if (!payload?.email) throw new HttpError(401, "Login do Google inválido.");
    if (!payload.email_verified) throw new HttpError(401, "E-mail do Google não verificado.");

    const email = payload.email.toLowerCase().trim();
    const colaboradores = await listAll<Colaborador>(STORES.colaboradores);
    let colaborador = colaboradores.find((c) => c.email.toLowerCase() === email);

    if (!colaborador) {
      const bootstrapEmails = (process.env.ADMIN_BOOTSTRAP_EMAILS || "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      if (colaboradores.length === 0 && bootstrapEmails.includes(email)) {
        const now = new Date().toISOString();
        colaborador = {
          id: uuidv4(),
          nome: payload.given_name || "Administrador",
          sobrenome: payload.family_name || "",
          email,
          perfis: ["Administrador"],
          status: "Ativo",
          createdAt: now,
          updatedAt: now,
        };
        await upsert(STORES.colaboradores, colaborador);
      } else {
        throw new HttpError(
          403,
          "Seu e-mail ainda não está cadastrado no sistema. Peça para um administrador te cadastrar em Cadastros › Colaboradores."
        );
      }
    }

    if (colaborador.status !== "Ativo") {
      throw new HttpError(403, "Seu acesso está bloqueado. Fale com um administrador.");
    }

    const sessionUser: SessionUser = {
      email: colaborador.email,
      nome: colaborador.nome,
      sobrenome: colaborador.sobrenome,
      perfis: colaborador.perfis,
      colaboradorId: colaborador.id,
    };

    const token = signSession(sessionUser);
    return json(200, { user: sessionUser }, { "set-cookie": buildSessionCookie(token) });
  });
};
