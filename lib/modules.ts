import type { AppArea, ModuleAction } from "./types";

export type ModuleDefinition = {
  area: AppArea;
  sectionId: string;
  moduleId: string;
  label: string;
};

export const appAreas = [
  { id: "marketing", label: "Marketing" },
  { id: "vendas", label: "Vendas" }
] as const satisfies ReadonlyArray<{ id: AppArea; label: string }>;

export const moduleActions = [
  { key: "view", label: "Ver" },
  { key: "create", label: "Criar" },
  { key: "edit", label: "Editar" },
  { key: "delete", label: "Excluir" },
  { key: "approve", label: "Aprovar" },
  { key: "manage", label: "Gerenciar" }
] as const satisfies ReadonlyArray<{ key: ModuleAction; label: string }>;

export const marketingModules = [
  { sectionId: "marketing-painel", moduleId: "painel", area: "marketing", label: "Painel" },
  { sectionId: "marketing-calendario", moduleId: "calendario", area: "marketing", label: "Calendário" },
  { sectionId: "marketing-ideias", moduleId: "ideias", area: "marketing", label: "Ideias" },
  { sectionId: "marketing-tarefas", moduleId: "tarefas", area: "marketing", label: "Tarefas" },
  { sectionId: "marketing-revisoes", moduleId: "revisoes", area: "marketing", label: "Revisões" },
  { sectionId: "marketing-campanhas", moduleId: "campanhas", area: "marketing", label: "Campanhas" },
  { sectionId: "marketing-metricas", moduleId: "metricas", area: "marketing", label: "Métricas" },
  { sectionId: "marketing-comentarios", moduleId: "comentarios", area: "marketing", label: "Comentários" },
  { sectionId: "marketing-banco-duvidas", moduleId: "banco-duvidas", area: "marketing", label: "Dúvidas" },
  { sectionId: "marketing-configuracoes", moduleId: "configuracoes", area: "marketing", label: "Configurações" }
] as const satisfies ReadonlyArray<ModuleDefinition>;

export const salesModules = [
  { sectionId: "vendas-painel", moduleId: "painel", area: "vendas", label: "Painel de Vendas" },
  { sectionId: "vendas-clientes", moduleId: "clientes", area: "vendas", label: "Clientes" },
  { sectionId: "vendas-leads", moduleId: "leads", area: "vendas", label: "Leads" },
  { sectionId: "vendas-funil-comercial", moduleId: "funil-comercial", area: "vendas", label: "Funil Comercial" },
  { sectionId: "vendas-atividades", moduleId: "atividades", area: "vendas", label: "Atividades" },
  { sectionId: "vendas-propostas", moduleId: "propostas", area: "vendas", label: "Propostas" },
  { sectionId: "vendas-configuracoes", moduleId: "configuracoes", area: "vendas", label: "Configurações" }
] as const satisfies ReadonlyArray<ModuleDefinition>;

export const moduleRegistry = [...marketingModules, ...salesModules] as const;

export function modulesForArea(area: AppArea): readonly ModuleDefinition[] {
  return area === "marketing" ? marketingModules : salesModules;
}
