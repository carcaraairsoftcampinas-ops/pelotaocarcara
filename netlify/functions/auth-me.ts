import { json, handleErrors } from "./_lib/http";
import { getUserFromRequest, buildClearCookie, buildSessionCookie, signSession } from "./_lib/session";
import { getById, STORES } from "./_lib/store";
import type { Colaborador, SessionUser } from "../../shared/types";

export default async (req: Request): Promise<Response> => {
  return handleErrors(async () => {
    const sessionUser = getUserFromRequest(req);
    if (!sessionUser) return json(401, { user: null });

    const colaborador = await getById<Colaborador>(STORES.colaboradores, sessionUser.colaboradorId);
    if (!colaborador || colaborador.status !== "Ativo") {
      return json(401, { user: null }, { "set-cookie": buildClearCookie() });
    }

    // Reflete perfis/nome atuais, caso um admin tenha alterado o cadastro
    // desde a última vez que o token foi emitido.
    const fresh: SessionUser = {
      email: colaborador.email,
      nome: colaborador.nome,
      sobrenome: colaborador.sobrenome,
      perfis: colaborador.perfis,
      colaboradorId: colaborador.id,
    };

    // Reemite o cookie de sessão com os dados atualizados. Sem isso, o
    // cookie (usado por TODAS as funções de escrita via requireUser/
    // requirePerfil) ficava travado nos perfis de quando o login foi feito
    // — até 7 dias — mesmo com a tela já mostrando os perfis novos aqui.
    // Resultado: um Administrador promovido depois do login via a tela de
    // Cadastros liberada, mas tomava "Você não tem permissão" ao tentar
    // salvar, porque o backend decodificava o cookie antigo.
    const token = signSession(fresh);
    return json(200, { user: fresh }, { "set-cookie": buildSessionCookie(token) });
  });
};
