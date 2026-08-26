import { criarBackup } from "./_lib/backup";

// Scheduled Function — roda todo dia às 06:00 UTC (03:00 no horário de
// Brasília) e cria um backup automático dos dados do sistema. Não precisa de
// autenticação: o próprio Netlify só aciona essa função pelo agendamento
// (não fica exposta como endpoint de uso normal, mas por segurança extra a
// lógica também não recebe nenhum input do chamador).
//
// O pacote `@netlify/functions` (que exporta o tipo `Config`) não está
// instalado neste projeto — por isso o `config` abaixo é um objeto literal
// simples, sem import de tipo. O Netlify detecta a função agendada pelo
// próprio `schedule` exportado no bundle, no build.
export const config = {
  schedule: "0 6 * * *",
};

export default async (): Promise<Response> => {
  try {
    await criarBackup();
    return new Response("ok");
  } catch (err) {
    console.error("Falha ao criar backup automático:", err);
    // Netlify Scheduled Functions não têm um "chamador" pra devolver erro —
    // só loga. Retornar 200 mesmo assim evita retentativas desnecessárias
    // (o próximo backup automático do dia seguinte tenta de novo).
    return new Response("erro ao criar backup, ver logs da function");
  }
};
