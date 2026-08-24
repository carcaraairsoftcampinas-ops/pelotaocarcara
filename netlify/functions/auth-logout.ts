import { json, handleErrors } from "./_lib/http";
import { buildClearCookie } from "./_lib/session";

export default async (): Promise<Response> => {
  return handleErrors(async () => json(200, { ok: true }, { "set-cookie": buildClearCookie() }));
};
