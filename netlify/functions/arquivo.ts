import { handleErrors, HttpError } from "./_lib/http";
import { requireUser } from "./_lib/session";
import { store, STORES } from "./_lib/store";

export default async (req: Request): Promise<Response> => {
  return handleErrors(async () => {
    requireUser(req);
    if (req.method !== "GET") throw new HttpError(405, "Método não permitido.");

    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    if (!key) throw new HttpError(400, "key é obrigatório.");

    const s = store(STORES.arquivos);
    const result = await s.getWithMetadata(key, { type: "arrayBuffer" });
    if (!result) throw new HttpError(404, "Arquivo não encontrado.");

    const { data, metadata } = result as { data: ArrayBuffer; metadata: Record<string, string> };
    const filename = (metadata?.filename as string) || "arquivo";
    const contentType = (metadata?.contentType as string) || "application/octet-stream";

    return new Response(data, {
      status: 200,
      headers: {
        "content-type": contentType,
        "content-disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "cache-control": "private, max-age=3600",
      },
    });
  });
};
