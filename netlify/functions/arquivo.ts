import { v4 as uuidv4 } from "uuid";
import { json, readJson, handleErrors, HttpError } from "./_lib/http";
import { requireUser } from "./_lib/session";
import { store, base64ToArrayBuffer, STORES } from "./_lib/store";

interface UploadInput {
  base64?: string;
  nomeArquivo?: string;
  contentType?: string;
}

const MAX_BYTES = 8 * 1024 * 1024;

export default async (req: Request): Promise<Response> => {
  return handleErrors(async () => {
    requireUser(req);

    if (req.method === "GET") {
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
    }

    if (req.method === "POST") {
      // Upload de UM arquivo por vez (evita estourar o limite de payload das
      // Netlify Functions quando várias imagens/cartas grandes vão juntas no
      // mesmo request — cada arquivo agora vai numa chamada separada, e a
      // tela só manda os "blobKey" resultantes no salvamento do registro).
      const input = await readJson<UploadInput>(req);
      if (!input.base64 || !input.nomeArquivo) {
        throw new HttpError(400, "base64 e nomeArquivo são obrigatórios.");
      }
      const bytes = base64ToArrayBuffer(input.base64);
      if (bytes.byteLength > MAX_BYTES) {
        throw new HttpError(400, `O arquivo "${input.nomeArquivo}" deve ter no máximo 8MB.`);
      }
      const key = uuidv4();
      const s = store(STORES.arquivos);
      await s.set(key, bytes, {
        metadata: {
          filename: input.nomeArquivo,
          contentType: input.contentType || "application/octet-stream",
        },
      });
      return json(201, { blobKey: key, nomeArquivo: input.nomeArquivo });
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const key = url.searchParams.get("key");
      if (!key) throw new HttpError(400, "key é obrigatório.");
      await store(STORES.arquivos).delete(key).catch(() => {});
      return json(200, { ok: true });
    }

    throw new HttpError(405, "Método não permitido.");
  });
};
