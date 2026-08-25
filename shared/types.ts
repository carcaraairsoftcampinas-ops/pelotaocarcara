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

export type GrupoOperador = "Carcarás Amarelo" | "Carcarás Vermelho" | "Milsim Squad";

export const GRUPOS_OPERADOR: GrupoOperador[] = ["Carcarás Amarelo", "Carcarás Vermelho", "Milsim Squad"];

export interface Operador {
  id: string; // ex: "0001-2026"
  nome: string;
  sobrenome: string;
  nomeNaLista: string;
  aniversarioMes: number | null; // 1-12
  aniversarioAno: number | null;
  email: string;
  telefone: string;
  grupos: GrupoOperador[];
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
  | "Rascunho"
  | "Enviado Análise Financeira"
  | "Aprovado"
  | "Reprovado";

export interface ItemGasto {
  id: string;
  nome: string;
  quantidade: number;
  valorUnitario: number;
}

export interface LancamentoFinanceiro {
  id: string;
  tipo: "missao" | "projeto";
  missaoId: string | null;
  nomeProjeto: string | null;
  creditos: {
    pix: number;
    especie: number;
    outros: number;
  };
  gastos: ItemGasto[];
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
  Rascunho: "#8a8f98",
  "Enviado Análise Financeira": "#2f6fed",
  Reprovado: "#e33a3a",
  Aprovado: "#2fa84f",
};

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
