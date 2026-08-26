import { json, readJson, handleErrors, HttpError } from "./_lib/http";
import { requireUser, requirePerfil } from "./_lib/session";
import { criarBackup, listarBackups, obterBackup, excluirBackup, restaurarBackup } from "./_lib/backup";

// Rotina de backup — só Administrador. Guarda snapshots dos stores de dados
// (colaboradores, campos, operadores, produtos, missões, financeiro, logs) +
// contadores de numeração. NÃO inclui `arquivos` (anexos binários — cartas,
// imagens, mapas de campo): ver comentário no topo de `_lib/backup.ts` para
// o motivo. Restauração é destrutiva (substitui os dados atuais pelos do
// backup) e exige frase de confirmação, mesmo padrão do Reset do Sistema.
const FRASE_CONFIRMACAO_RESTAURAR = "RESTAURAR BACKUP";

interface AcaoInput {
  acao?: "criar" | "restaurar";
  id?: string;
  confirmacao?: string;
}

export default async (req: Request): Promise<Response> => {
  return handleErrors(async () => {
    const user = requireUser(req);
    requirePerfil(user, ["Administrador"]);

    if (req.method === "GET") {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");

      if (id) {
        // Download de um backup específico — devolve o snapshot completo
        // como arquivo JSON pra download (guardar fora do sistema, se quiser).
        const snapshot = await obterBackup(id);
        if (!snapshot) throw new HttpError(404, "Backup não encontrado.");
        return new Response(JSON.stringify(snapshot, null, 2), {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "content-disposition": `attachment; filename="${encodeURIComponent(id)}.json"`,
          },
        });
      }

      const lista = await listarBackups();
      return json(200, lista);
    }

    if (req.method === "POST") {
      const input = await readJson<AcaoInput>(req);

      if (input.acao === "criar") {
        const resumo = await criarBackup();
        return json(201, resumo);
      }

      if (input.acao === "restaurar") {
        if (!input.id) throw new HttpError(400, "id é obrigatório para restaurar.");
        if (input.confirmacao !== FRASE_CONFIRMACAO_RESTAURAR) {
          throw new HttpError(400, `Digite exatamente "${FRASE_CONFIRMACAO_RESTAURAR}" para confirmar.`);
        }
        const restaurados = await restaurarBackup(input.id);
        return json(200, { ok: true, restaurados });
      }

      throw new HttpError(400, "Ação inválida.");
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");
      if (!id) throw new HttpError(400, "id é obrigatório.");
      await excluirBackup(id);
      return json(200, { ok: true });
    }

    throw new HttpError(405, "Método não permitido.");
  });
};
