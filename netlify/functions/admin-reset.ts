import { json, readJson, handleErrors, HttpError } from "./_lib/http";
import { requireUser, requirePerfil } from "./_lib/session";
import { wipeStore, STORES } from "./_lib/store";

// Reset total do sistema — só Administrador, e só com a frase de
// confirmação exata (evita clique acidental num botão destrutivo). Apaga
// TODOS os registros de todos os stores (colaboradores, campos, operadores,
// missões, financeiro, arquivos anexados) e os contadores de numeração
// sequencial (missões e operadores voltam a começar do 1). Sem volta.
//
// Depois do reset, o próprio e-mail de quem executou (se estiver em
// ADMIN_BOOTSTRAP_EMAILS) volta a virar Administrador automaticamente no
// próximo login, porque o store de colaboradores fica vazio — é o mesmo
// mecanismo de bootstrap do primeiro acesso ao sistema.
const FRASE_CONFIRMACAO = "RESETAR TUDO";

interface ResetInput {
  confirmacao?: string;
}

export default async (req: Request): Promise<Response> => {
  return handleErrors(async () => {
    const user = requireUser(req);
    requirePerfil(user, ["Administrador"]);
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido.");

    const input = await readJson<ResetInput>(req);
    if (input.confirmacao !== FRASE_CONFIRMACAO) {
      throw new HttpError(400, `Digite exatamente "${FRASE_CONFIRMACAO}" para confirmar.`);
    }

    const apagados: Record<string, number> = {};
    for (const nome of Object.values(STORES)) {
      // Backups não são apagados pelo Reset — é justamente o que permite
      // restaurar os dados caso o Reset tenha sido um erro.
      if (nome === STORES.backups) continue;
      apagados[nome] = await wipeStore(nome);
    }

    return json(200, { ok: true, apagados });
  });
};
