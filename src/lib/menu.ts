import type { Perfil } from "../../shared/types";

export interface MenuItem {
  label: string;
  path: string;
}

export interface MenuGroup {
  label: string;
  perfis: Perfil[];
  items: MenuItem[];
}

export const MENU: MenuGroup[] = [
  {
    label: "Cadastros",
    perfis: ["Administrador"],
    items: [
      { label: "Colaboradores", path: "/cadastros/colaboradores" },
      { label: "Campos", path: "/cadastros/campos" },
    ],
  },
  {
    label: "Missões",
    perfis: ["Administrador", "Coordenador", "Colaborador"],
    items: [
      { label: "Nova Missão", path: "/missoes/nova" },
      { label: "Consulta Missões", path: "/missoes/consulta" },
      { label: "Campos disponíveis", path: "/missoes/campos-disponiveis" },
    ],
  },
  {
    label: "Análise de Missões",
    perfis: ["Administrador", "Coordenador"],
    items: [
      { label: "Análise de Missões", path: "/analise/missoes" },
      { label: "Avaliação de Missões", path: "/analise/avaliacao" },
    ],
  },
  {
    label: "Financeiro",
    perfis: ["Administrador", "Financeiro", "Coordenador"],
    items: [
      { label: "Lançamento Financeiro", path: "/financeiro/lancamento" },
      { label: "Caixa Geral", path: "/financeiro/caixa" },
    ],
  },
  {
    label: "Aprovação Financeira",
    perfis: ["Administrador"],
    items: [{ label: "Aprovação Financeira", path: "/financeiro/aprovacao" }],
  },
];
