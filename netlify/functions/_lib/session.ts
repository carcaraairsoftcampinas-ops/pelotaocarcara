import jwt from "jsonwebtoken";
import { parse, serialize } from "cookie";
import type { SessionUser, Perfil } from "../../../shared/types";
import { HttpError } from "./http";

export const SESSION_COOKIE = "carcara_session";
const SEVEN_DAYS = 60 * 60 * 24 * 7;

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET não configurado nas variáveis de ambiente.");
  return s;
}

export function signSession(user: SessionUser): string {
  return jwt.sign(user, secret(), { expiresIn: SEVEN_DAYS });
}

export function buildSessionCookie(token: string): string {
  return serialize(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SEVEN_DAYS,
  });
}

export function buildClearCookie(): string {
  return serialize(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function getUserFromRequest(req: Request): SessionUser | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const cookies = parse(cookieHeader);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  try {
    return jwt.verify(token, secret()) as unknown as SessionUser;
  } catch {
    return null;
  }
}

export function requireUser(req: Request): SessionUser {
  const user = getUserFromRequest(req);
  if (!user) throw new HttpError(401, "Sessão inválida ou expirada. Faça login novamente.");
  return user;
}

export function requirePerfil(user: SessionUser, allowed: Perfil[]): void {
  const ok = user.perfis.some((p) => allowed.includes(p));
  if (!ok) {
    throw new HttpError(403, "Você não tem permissão para acessar este recurso.");
  }
}
