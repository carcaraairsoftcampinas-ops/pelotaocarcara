import type { Perfil } from "../../shared/types";

export interface MenuItem {
  label: string;
  path: string;
  perfis?: Perfil[]; // se ausente, usa os perfis do grupo
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
      { label: "Operadores", path: "/cadastros/operadores" },
      { label: "Produtos", path: "/cadastros/produtos" },
      { label: "Reset do Sistema", path: "/cadastros/reset" },
      { label: "Backup", path: "/cadastros/backup" },
    ],
  },
  {
    label: "Missões",
    perfis: ["Administrador", "Coordenador", "Colaborador"],
    items: [
      { label: "Nova Missão", path: "/missoes/nova" },
      { label: "Consulta Missões", path: "/missoes/consulta" },
      { label: "Campos disponíveis", path: "/missoes/campos-disponiveis" },
      { label: "Inventário", path: "/missoes/inventario" },
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
      { label: "Movimentação Financeira", path: "/financeiro/movimentacao" },
      { label: "Caixa Geral", path: "/financeiro/caixa" },
      { label: "Aprovação Financeira", path: "/financeiro/aprovacao", perfis: ["Administrador", "Coordenador"] },
    ],
  },
  {
    label: "Operadores",
    perfis: ["Administrador", "Coordenador", "Colaborador"],
    items: [
      { label: "Lista de operadores", path: "/operadores/lista" },
      { label: "Relatório de Presenças", path: "/operadores/presencas" },
    ],
  },
  {
    label: "Auditoria",
    perfis: ["Administrador", "Coordenador", "Colaborador", "Financeiro"],
    items: [{ label: "Logs", path: "/logs" }],
  },
];
