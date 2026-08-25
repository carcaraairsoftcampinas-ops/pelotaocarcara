// Tipos compartilhados entre o front-end (src) e as Netlify Functions.
// Importado por caminho relativo dos dois lados — sem pacote/build extra.

export type Perfil = "Administrador" | "Colaborador" | "Financeiro" | "Coordenador";

export type StatusColaborador = "Ativo" | "Não Ativo";

export interface Colaborador {
  id: string;
  nome: string;
  sobrenome: string;
  email: string; // e-mail de acesso (login com Google)
  perfis: Perfil[];
  status: StatusColaborador;
  createdAt: string;
  updatedAt: string;
}

export interface EnderecoCampo {
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  cep: string;
}

export interface Campo {
  id: string;
  nome: string;
  tamanhoM2: number | null;
  endereco: EnderecoCampo;
  localizacaoGoogle: string;
  localizacaoGps: string;
  mapaBlobKey: string | null;
  mapaNomeArquivo: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export type GrupoWhatsapp = "Oficial" | "Aposentados" | "Convidados";
export type Patch = "Amarelo" | "Vermelho";
export type StatusOperador = "Ativo" | "Inativo";

export const GRUPOS_WHATSAPP: GrupoWhatsapp[] = ["Oficial", "Aposentados", "Convidados"];
export const PATCHES: Patch[] = ["Amarelo", "Vermelho"];

export interface Operador {
  id: string; // ex: "0001-2026"
  nome: string;
  sobrenome: string;
  nomeNaLista: string;
  aniversarioDia: number | null; // 1-31
  aniversarioMes: number | null; // 1-12
  email: string;
  telefone: string;
  grupoWhatsapp: GrupoWhatsapp | null;
  patch: Patch | null;
  operadorMilsim: boolean;
  numeroMilsim: string | null; // formato XXMXX
  historico: string;
  status: StatusOperador;
  createdAt: string;
  updatedAt: string;
}

export type StatusMissao =
  | "Rascunho"
  | "Enviado Análise"
  | "Em Análise"
  | "Pendência"
  | "Reprovada"
  | "Aprovada"
  | "Aguardando Avaliação"
  | "Finalizada";

export interface ItemCompra {
  id: string;
  nome: string;
  quantidade: number;
  valorUnitario: number;
}

export interface ItemNecessario {
  nome: string;
  quantidade: number;
}

export interface HistoricoStatusEntry {
  status: string;
  data: string;
  colaboradorId: string;
  colaboradorNome: string;
  observacao?: string;
}

export interface Avaliacao {
  estrelas: number;
  comentario: string;
  totalOperadoresPresentes: number | null;
  avaliadoPor: string;
  avaliadoEm: string;
}

export interface Missao {
  id: string;
  numero: string | null; // ex: "001-2026", só atribuído ao enviar p/ análise
  nome: string;
  data: string;
  campoId: string;
  resumo: string;
  objetivos: string;
  cartas: { blobKey: string; nomeArquivo: string }[];
  imagens: { blobKey: string; nomeArquivo: string }[];
  quantidadeOperadores: number | null; // quantidade planejada de operadores para a missão
  itensNecessarios: ItemNecessario[]; // lista de itens necessários p/ missão, com quantidade (obrigatório p/ enviar)
  itensCompra: ItemCompra[]; // itens a comprar, se houver (opcional, soma o investimento)
  investimentoTotal: number;
  status: StatusMissao;
  criadoPorId: string;
  criadoPorNome: string;
  observacoesAnalise: string;
  avaliacao: Avaliacao | null;
  historicoStatus: HistoricoStatusEntry[];
  dataEnvioAnalise: string | null; // preenchida ao clicar em "Enviar para Análise"
  createdAt: string;
  updatedAt: string;
}

export type StatusFinanceiro =
  | "Em Andamento"
  | "Aprovação Pendente"
  | "Financeiro Aprovado"
  | "Financeiro Pendente";

export interface ItemInvestimento {
  id: string;
  nome: string;
  quantidade: number;
  valorUnitario: number;
}

export interface ItemCredito {
  id: string;
  data: string; // YYYY-MM-DD, data do recebimento
  descricao: string;
  valor: number;
}

export interface LancamentoFinanceiro {
  id: string;
  tipo: "missao" | "projeto";
  missaoId: string | null; // obrigatório se tipo = "missao"
  nomeProjeto: string | null; // obrigatório se tipo = "projeto"
  dataInicio: string | null; // obrigatório se tipo = "projeto"
  dataFinal: string | null; // obrigatório se tipo = "projeto"
  observacoesDados: string; // bloco "Dados" (não obrigatório)
  investimentos: ItemInvestimento[]; // bloco "Investimentos"
  observacoesInvestimentos: string; // não obrigatório
  creditos: ItemCredito[]; // bloco "Créditos"
  status: StatusFinanceiro;
  observacaoAprovacao: string;
  criadoPorId: string;
  criadoPorNome: string;
  historicoStatus: HistoricoStatusEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface SessionUser {
  email: string;
  nome: string;
  sobrenome: string;
  perfis: Perfil[];
  colaboradorId: string;
}

export const STATUS_MISSAO_COLORS: Record<StatusMissao, string> = {
  Rascunho: "#8a8f98",
  "Enviado Análise": "#ef8c1f",
  "Em Análise": "#e0c419",
  Pendência: "#e33a3a",
  Reprovada: "#111214",
  Aprovada: "#2fa84f",
  "Aguardando Avaliação": "#ec4899",
  Finalizada: "#2f6fed",
};

export const STATUS_FINANCEIRO_COLORS: Record<StatusFinanceiro, string> = {
  "Em Andamento": "#e0c419",
  "Aprovação Pendente": "#2f6fed",
  "Financeiro Aprovado": "#2fa84f",
  "Financeiro Pendente": "#e33a3a",
};

// Status financeiro que ainda não viraram números reais no Caixa Geral —
// usados como "provisão" (previsão futura), tanto pra lançamentos avulsos
// quanto pro status derivado de uma missão sem lançamento ainda.
export const STATUS_FINANCEIRO_PROVISAO: StatusFinanceiro[] = [
  "Em Andamento",
  "Aprovação Pendente",
  "Financeiro Pendente",
];

// Log de auditoria — registrado automaticamente pelo backend a cada
// criação/edição/mudança de status de Missões e Lançamentos Financeiros
// (missão ou projeto). Todos os perfis podem visualizar; só Administrador
// pode editar o campo `detalhes` de um registro já existente (ex: corrigir
// um texto), pela tela de Logs.
export type LogEntidadeTipo = "missao" | "financeiro";

export interface LogEntry {
  id: string;
  entidadeTipo: LogEntidadeTipo;
  entidadeId: string;
  entidadeNome: string; // nome/número pra exibir sem precisar buscar de novo
  acao: string; // descrição curta, ex: "Missão criada", "Status alterado para Aprovada"
  detalhes: string; // texto livre com mais contexto (campos alterados, observação etc.)
  colaboradorId: string;
  colaboradorNome: string;
  data: string;
}

export const PERFIS: Perfil[] = ["Administrador", "Colaborador", "Financeiro", "Coordenador"];

export const STATUS_MISSAO_ORDEM: StatusMissao[] = [
  "Rascunho",
  "Enviado Análise",
  "Em Análise",
  "Pendência",
  "Reprovada",
  "Aprovada",
  "Aguardando Avaliação",
  "Finalizada",
];
