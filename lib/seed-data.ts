import type {
  Campaign,
  Channel,
  ContentType,
  EditorialPost,
  FunnelStage,
  Idea,
  Notification,
  PostReviewAsset,
  PostMetric,
  ProductLine,
  Profile,
  Task,
  TaskBoard,
  TaskColumn,
  VehicleType
} from "./types";

export const profiles: Profile[] = [
  {
    id: "user-admin",
    name: "Caio Embrepoli",
    email: "caio@embrepoli.com.br",
    phone: "(00) 00000-0000",
    bio: "Organização do marketing e visão geral da operação.",
    role: "admin",
    avatarUrl: "",
    active: true,
    notificationSound: true
  },
  {
    id: "user-gestor",
    name: "Gestor Marketing",
    email: "gestor@embrepoli.com.br",
    phone: "",
    bio: "Gestão das campanhas e aprovações.",
    role: "gestor",
    avatarUrl: "",
    active: true,
    notificationSound: true
  },
  {
    id: "user-design",
    name: "Design",
    email: "design@embrepoli.com.br",
    phone: "",
    bio: "Criação visual e materiais das campanhas.",
    role: "colaborador",
    avatarUrl: "",
    active: true,
    notificationSound: true
  },
  {
    id: "user-conteudo",
    name: "Conteúdo",
    email: "conteudo@embrepoli.com.br",
    phone: "",
    bio: "Conteúdo técnico e planejamento editorial.",
    role: "colaborador",
    avatarUrl: "",
    active: true,
    notificationSound: true
  }
];

export const channels: Channel[] = [
  { id: "instagram", name: "Instagram", color: "#e25588" },
  { id: "tiktok", name: "TikTok", color: "#111827" },
  { id: "youtube", name: "YouTube", color: "#ef4444" },
  { id: "facebook", name: "Facebook", color: "#2563eb" },
  { id: "linkedin", name: "LinkedIn", color: "#0a66c2" }
];

export const productLines: ProductLine[] = [
  { id: "pickup-turbo", name: "Kits turbo para caminhonetes" },
  { id: "agro", name: "Turbo/intercooler linha agrícola" },
  { id: "truck", name: "Kits para caminhões" },
  { id: "intercooler", name: "Intercooler" },
  { id: "remap", name: "Remap" }
];

export const vehicleTypes: VehicleType[] = [
  { id: "diesel-performance", name: "Diesel performance" },
  { id: "caminhonetes", name: "Caminhonetes" },
  { id: "tratores", name: "Tratores" },
  { id: "caminhoes", name: "Caminhões" }
];

export const contentTypes: ContentType[] = [
  { id: "antes-depois", name: "Antes/depois" },
  { id: "duvidas-tecnicas", name: "Dúvidas técnicas" },
  { id: "bastidores", name: "Bastidores" },
  { id: "instalacao", name: "Instalação" },
  { id: "clientes", name: "Clientes" },
  { id: "provas-resultados", name: "Provas/resultados" }
];

export const funnelStages: FunnelStage[] = [
  { id: "topo", name: "Topo - Descoberta", color: "#38bdf8", order: 1 },
  { id: "meio", name: "Meio - Interesse", color: "#2563eb", order: 2 },
  { id: "fundo", name: "Fundo - Decisão", color: "#1d4ed8", order: 3 },
  { id: "pos", name: "Pós-venda - Relacionamento", color: "#334155", order: 4 }
];

export const taskBoards: TaskBoard[] = [
  { id: "tarefas", name: "Tarefas", order: 1, isFixed: true },
  { id: "metas", name: "Metas", order: 2, isFixed: true }
];

export const taskColumns: TaskColumn[] = [
  { id: "todo", boardId: "tarefas", name: "A fazer", color: "#dbeafe", order: 1 },
  { id: "doing", boardId: "tarefas", name: "Em andamento", color: "#cffafe", order: 2 },
  { id: "review", boardId: "tarefas", name: "Em revisão", color: "#e0e7ff", order: 3 },
  { id: "done", boardId: "tarefas", name: "Concluído", color: "#dcfce7", order: 4 },
  { id: "goals-todo", boardId: "metas", name: "A fazer", color: "#dbeafe", order: 1 },
  { id: "goals-doing", boardId: "metas", name: "Em andamento", color: "#cffafe", order: 2 },
  { id: "goals-review", boardId: "metas", name: "Em revisão", color: "#e0e7ff", order: 3 },
  { id: "goals-done", boardId: "metas", name: "Concluído", color: "#dcfce7", order: 4 }
];

export const campaigns: Campaign[] = [
  {
    id: "campanha-neutra",
    name: "Campanha neutra",
    objective: "",
    audience: "Geral",
    message: "",
    productLineId: "",
    vehicleTypeId: "",
    funnelStageId: "",
    createdBy: "user-admin",
    assignedTo: ["user-gestor"],
    startDate: "",
    endDate: "",
    status: "Planejada"
  },
  {
    id: "safra-forte",
    name: "Safra Forte",
    objective: "Gerar demanda para kits turbo e intercooler na linha agrícola.",
    audience: "Produtores, oficinas diesel e donos de tratores.",
    message: "Mais força, melhor resposta e confiabilidade no trabalho pesado.",
    productLineId: "agro",
    vehicleTypeId: "tratores",
    funnelStageId: "meio",
    createdBy: "user-admin",
    assignedTo: ["user-gestor"],
    startDate: "2026-05-13",
    endDate: "2026-06-28",
    status: "Ativa"
  },
  {
    id: "pickup-performance",
    name: "Pickup Diesel Performance",
    objective: "Educar compradores sobre upgrades de turbina para caminhonetes.",
    audience: "Donos de caminhonetes diesel e preparadores.",
    message: "Upgrade bem dimensionado para ganhar desempenho sem perder segurança.",
    productLineId: "pickup-turbo",
    vehicleTypeId: "caminhonetes",
    funnelStageId: "topo",
    createdBy: "user-admin",
    assignedTo: ["user-conteudo"],
    startDate: "2026-05-20",
    endDate: "2026-07-05",
    status: "Planejada"
  }
];

export const posts: EditorialPost[] = [
  {
    id: "post-1",
    title: "Antes e depois: resposta do turbo em trator de trabalho",
    channelId: "instagram",
    campaignId: "safra-forte",
    productLineId: "agro",
    vehicleTypeId: "tratores",
    contentTypeId: "antes-depois",
    funnelStageId: "meio",
    createdBy: "user-conteudo",
    assignedTo: ["user-gestor"],
    status: "Revisão",
    format: "Feed",
    order: 1,
    publishAt: "2026-05-14T10:00",
    description: "Carrossel com sintomas, solução instalada e resultado percebido."
  },
  {
    id: "post-2",
    title: "Como escolher kit turbo para caminhonete diesel",
    channelId: "youtube",
    campaignId: "pickup-performance",
    productLineId: "pickup-turbo",
    vehicleTypeId: "caminhonetes",
    contentTypeId: "duvidas-tecnicas",
    funnelStageId: "topo",
    createdBy: "user-conteudo",
    assignedTo: ["user-design"],
    status: "Produção",
    format: "Vídeo",
    order: 1,
    publishAt: "2026-05-18T18:30",
    description: "Vídeo curto explicando uso, potência esperada e cuidados na instalação."
  },
  {
    id: "post-3",
    title: "Checklist de instalação de intercooler",
    channelId: "linkedin",
    campaignId: "safra-forte",
    productLineId: "intercooler",
    vehicleTypeId: "diesel-performance",
    contentTypeId: "instalacao",
    funnelStageId: "fundo",
    createdBy: "user-gestor",
    assignedTo: ["user-conteudo"],
    status: "Aprovado",
    format: "Post",
    order: 1,
    publishAt: "2026-05-22T09:15",
    description: "Post técnico para oficinas parceiras e compradores B2B."
  }
];

export const postReviewAssets: PostReviewAsset[] = [];

export const notifications: Notification[] = [];

export const ideas: Idea[] = [
  {
    id: "idea-1",
    title: "Mitos sobre turbina maior em motor diesel",
    productLineId: "pickup-turbo",
    vehicleTypeId: "diesel-performance",
    contentTypeId: "duvidas-tecnicas",
    type: "Postagem",
    channelId: "instagram",
    funnelStageId: "topo",
    createdBy: "user-conteudo",
    priority: "Alta",
    order: 1
  },
  {
    id: "idea-2",
    title: "Bastidores da montagem de um kit intercooler",
    productLineId: "intercooler",
    vehicleTypeId: "caminhonetes",
    contentTypeId: "bastidores",
    type: "Postagem",
    channelId: "tiktok",
    funnelStageId: "topo",
    createdBy: "user-design",
    priority: "Média",
    order: 2
  }
];

export const tasks: Task[] = [
  {
    id: "task-1",
    title: "Separar fotos do trator para campanha Safra Forte",
    columnId: "todo",
    order: 1,
    priority: "Alta",
    progress: "No prazo",
    createdBy: "user-gestor",
    assignedTo: ["user-design"],
    relatedTo: "Safra Forte",
    funnelStageId: "meio",
    dueDate: "2026-05-11",
    description: "Selecionar fotos de oficina, instalação e peça finalizada.",
    checklist: [
      { id: "check-1", label: "Escolher fotos", done: true },
      { id: "check-2", label: "Tratar imagens", done: false }
    ],
    comments: [
      {
        id: "comment-1",
        authorId: "user-gestor",
        message: "Priorizar imagens que mostrem aplicação real.",
        createdAt: "2026-05-08T10:00"
      }
    ],
    attachments: []
  },
  {
    id: "task-2",
    title: "Revisar roteiro do vídeo sobre kit turbo",
    columnId: "doing",
    order: 1,
    priority: "Média",
    progress: "Atenção",
    createdBy: "user-admin",
    assignedTo: ["user-conteudo"],
    relatedTo: "Pickup Diesel Performance",
    funnelStageId: "topo",
    dueDate: "2026-05-12",
    description: "Conferir se o roteiro está técnico, mas fácil de entender.",
    checklist: [],
    comments: [],
    attachments: []
  },
  {
    id: "task-3",
    title: "Aprovar copy do carrossel antes/depois",
    columnId: "review",
    order: 1,
    priority: "Alta",
    progress: "Finalizando",
    createdBy: "user-conteudo",
    assignedTo: ["user-gestor"],
    relatedTo: "Post Instagram",
    funnelStageId: "meio",
    dueDate: "2026-05-13",
    description: "Revisar promessa, clareza e linguagem técnica.",
    checklist: [],
    comments: [],
    attachments: []
  },
  {
    id: "task-4",
    title: "Registrar métricas do post de intercooler",
    columnId: "done",
    order: 1,
    priority: "Baixa",
    progress: "Finalizando",
    createdBy: "user-admin",
    assignedTo: ["user-conteudo"],
    relatedTo: "Métricas",
    funnelStageId: "pos",
    dueDate: "2026-05-08",
    description: "Fechar resultados da semana.",
    checklist: [{ id: "check-5", label: "Registrar leads", done: true }],
    comments: [],
    attachments: []
  }
];

export const metrics: PostMetric[] = [
  {
    id: "metric-1",
    postId: "",
    postTitle: "Dica rápida: sinais de perda de pressão",
    channelId: "instagram",
    campaignId: "pickup-performance",
    productLineId: "intercooler",
    vehicleTypeId: "diesel-performance",
    contentTypeId: "duvidas-tecnicas",
    funnelStageId: "topo",
    date: "2026-05-10",
    reach: 12840,
    likes: 742,
    comments: 38,
    shares: 96,
    clicks: 214,
    leads: 17,
    notes: "Boa retenção nos comentários técnicos.",
    learning: "Conteúdo de diagnóstico gera dúvidas qualificadas."
  },
  {
    id: "metric-2",
    postId: "post-2",
    postTitle: "Kit turbo em caminhonete de uso misto",
    channelId: "youtube",
    campaignId: "pickup-performance",
    productLineId: "pickup-turbo",
    vehicleTypeId: "caminhonetes",
    contentTypeId: "provas-resultados",
    funnelStageId: "fundo",
    date: "2026-05-11",
    reach: 9240,
    likes: 381,
    comments: 42,
    shares: 51,
    clicks: 188,
    leads: 22,
    notes: "Gerou leads com intenção de compra.",
    learning: "Vídeo com aplicação real converte melhor no fundo do funil."
  }
];


