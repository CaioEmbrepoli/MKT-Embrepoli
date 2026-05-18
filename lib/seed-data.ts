import type {
  Campaign,
  CampaignAudience,
  CalendarDate,
  Channel,
  ContentType,
  EditorialPost,
  FunnelStage,
  Idea,
  Notification,
  PostReviewAsset,
  PostMetric,
  PostTemplate,
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

export const campaignAudiences: CampaignAudience[] = [
  { id: "geral", name: "Geral" },
  { id: "clientes-atuais", name: "Clientes atuais" },
  { id: "leads", name: "Leads" },
  { id: "equipe-interna", name: "Equipe interna" },
  { id: "outros", name: "Outros" }
];

export const posts: EditorialPost[] = [
  {
    id: "post-1",
    templateId: "template-antes-depois-tecnico",
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
    ideaId: "",
    order: 1,
    publishAt: "2026-05-14T10:00",
    description: "Carrossel com sintomas, solução instalada e resultado percebido.",
    productionChecklist: []
  },
  {
    id: "post-2",
    templateId: "template-duvida-tecnica",
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
    ideaId: "",
    order: 1,
    publishAt: "2026-05-18T18:30",
    description: "Vídeo curto explicando uso, potência esperada e cuidados na instalação.",
    productionChecklist: []
  },
  {
    id: "post-3",
    templateId: "template-oferta-produto",
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
    ideaId: "",
    order: 1,
    publishAt: "2026-05-22T09:15",
    description: "Post técnico para oficinas parceiras e compradores B2B.",
    productionChecklist: []
  }
];

export const postReviewAssets: PostReviewAsset[] = [];

export const notifications: Notification[] = [];

export const calendarDates: CalendarDate[] = [
  { id: "ano-novo-2026", name: "Ano Novo", date: "2026-01-01", type: "Feriado", color: "#2563eb", notes: "" },
  { id: "tiradentes-2026", name: "Tiradentes", date: "2026-04-21", type: "Feriado", color: "#2563eb", notes: "" },
  { id: "dia-do-trabalho-2026", name: "Dia do Trabalho", date: "2026-05-01", type: "Feriado", color: "#2563eb", notes: "" },
  { id: "dia-dos-namorados-2026", name: "Dia dos Namorados", date: "2026-06-12", type: "Data comemorativa", color: "#e25588", notes: "Possível gancho para campanhas leves." },
  { id: "dia-do-cliente-2026", name: "Dia do Cliente", date: "2026-09-15", type: "Data comemorativa", color: "#0891b2", notes: "Bom para provas sociais e pós-venda." },
  { id: "black-friday-2026", name: "Black Friday", date: "2026-11-27", type: "Data comemorativa", color: "#111827", notes: "Planejar ofertas e criativos com antecedência." },
  { id: "natal-2026", name: "Natal", date: "2026-12-25", type: "Feriado", color: "#16a34a", notes: "" }
];

export const postTemplates: PostTemplate[] = [
  {
    id: "template-antes-depois-tecnico",
    name: "Antes/depois técnico",
    description: "Mostrar a condição inicial, a solução aplicada e o resultado percebido.",
    contentTypeId: "antes-depois",
    channelId: "instagram",
    format: "Feed",
    suggestedTime: "10:00",
    funnelStageId: "meio",
    structure: "1. Problema inicial\n2. Peça/kit aplicado\n3. Resultado após instalação\n4. Chamada para tirar dúvidas",
    checklist: "Foto do antes\nFoto do depois\nAplicação correta identificada\nLegenda sem promessa exagerada",
    structureItems: ["Problema inicial", "Peça/kit aplicado", "Resultado após instalação", "Chamada para tirar dúvidas"],
    checklistItems: [
      { id: "template-antes-check-1", label: "Foto do antes", done: false },
      { id: "template-antes-check-2", label: "Foto do depois", done: false },
      { id: "template-antes-check-3", label: "Aplicação correta identificada", done: false },
      { id: "template-antes-check-4", label: "Legenda sem promessa exagerada", done: false }
    ],
    visualGuidance: "Usar comparação clara, setas ou marcações simples e foco na aplicação real.",
    captionExample: "Antes e depois de uma aplicação diesel com upgrade bem dimensionado. O foco é melhorar resposta e confiabilidade dentro do uso correto."
  },
  {
    id: "template-duvida-tecnica",
    name: "Dúvida técnica",
    description: "Responder uma pergunta frequente de forma simples, técnica e direta.",
    contentTypeId: "duvidas-tecnicas",
    channelId: "youtube",
    format: "Shorts",
    suggestedTime: "18:30",
    funnelStageId: "topo",
    structure: "1. Pergunta do cliente\n2. Resposta curta\n3. Explicação técnica\n4. Quando procurar a Embrepoli",
    checklist: "Pergunta clara\nResposta sem termos confusos\nExemplo prático\nCTA leve",
    structureItems: ["Pergunta do cliente", "Resposta curta", "Explicação técnica", "Quando procurar a Embrepoli"],
    checklistItems: [
      { id: "template-duvida-check-1", label: "Pergunta clara", done: false },
      { id: "template-duvida-check-2", label: "Resposta sem termos confusos", done: false },
      { id: "template-duvida-check-3", label: "Exemplo prático", done: false },
      { id: "template-duvida-check-4", label: "CTA leve", done: false }
    ],
    visualGuidance: "Usar close da peça, texto curto na tela e fala objetiva.",
    captionExample: "Essa é uma dúvida comum em motores diesel. O melhor kit depende da aplicação, uso e objetivo do veículo."
  },
  {
    id: "template-bastidor-instalacao",
    name: "Bastidor de instalação",
    description: "Mostrar o processo de montagem ou preparação como conteúdo de confiança.",
    contentTypeId: "bastidores",
    channelId: "tiktok",
    format: "Vídeo",
    suggestedTime: "19:00",
    funnelStageId: "topo",
    structure: "1. Cena rápida da oficina\n2. Detalhe técnico\n3. Cuidados na montagem\n4. Resultado final",
    checklist: "Ambiente organizado\nPeça em destaque\nMostrar cuidado técnico\nEvitar informação sensível do cliente",
    structureItems: ["Cena rápida da oficina", "Detalhe técnico", "Cuidados na montagem", "Resultado final"],
    checklistItems: [
      { id: "template-bastidor-check-1", label: "Ambiente organizado", done: false },
      { id: "template-bastidor-check-2", label: "Peça em destaque", done: false },
      { id: "template-bastidor-check-3", label: "Mostrar cuidado técnico", done: false },
      { id: "template-bastidor-check-4", label: "Evitar informação sensível do cliente", done: false }
    ],
    visualGuidance: "Vídeo dinâmico, cortes curtos e áudio/legenda explicando o detalhe técnico.",
    captionExample: "Um pouco dos bastidores de uma instalação diesel feita com atenção em cada detalhe."
  },
  {
    id: "template-prova-resultado",
    name: "Prova de resultado",
    description: "Evidenciar resultado, aplicação real ou feedback de cliente.",
    contentTypeId: "provas-resultados",
    channelId: "instagram",
    format: "Reels",
    suggestedTime: "12:00",
    funnelStageId: "fundo",
    structure: "1. Contexto da aplicação\n2. O que foi instalado\n3. Resultado/feedback\n4. Próximo passo para orçamento",
    checklist: "Resultado verificável\nContexto do veículo/máquina\nAutorização para uso\nCTA para atendimento",
    structureItems: ["Contexto da aplicação", "O que foi instalado", "Resultado/feedback", "Próximo passo para orçamento"],
    checklistItems: [
      { id: "template-prova-check-1", label: "Resultado verificável", done: false },
      { id: "template-prova-check-2", label: "Contexto do veículo/máquina", done: false },
      { id: "template-prova-check-3", label: "Autorização para uso", done: false },
      { id: "template-prova-check-4", label: "CTA para atendimento", done: false }
    ],
    visualGuidance: "Priorizar imagens reais, depoimento curto e texto destacando a aplicação.",
    captionExample: "Aplicação real, resultado na prática e solução pensada para o uso do cliente."
  },
  {
    id: "template-cliente-aplicacao-real",
    name: "Cliente/aplicação real",
    description: "Apresentar uma aplicação real de cliente com foco em contexto e confiança.",
    contentTypeId: "clientes",
    channelId: "facebook",
    format: "Post",
    suggestedTime: "09:00",
    funnelStageId: "meio",
    structure: "1. Tipo de cliente/aplicação\n2. Necessidade\n3. Solução Embrepoli\n4. Benefício percebido",
    checklist: "Cliente autorizado\nAplicação bem explicada\nLinha de produto correta\nFoto ou vídeo real",
    structureItems: ["Tipo de cliente/aplicação", "Necessidade", "Solução Embrepoli", "Benefício percebido"],
    checklistItems: [
      { id: "template-cliente-check-1", label: "Cliente autorizado", done: false },
      { id: "template-cliente-check-2", label: "Aplicação bem explicada", done: false },
      { id: "template-cliente-check-3", label: "Linha de produto correta", done: false },
      { id: "template-cliente-check-4", label: "Foto ou vídeo real", done: false }
    ],
    visualGuidance: "Mostrar veículo, máquina ou peça aplicada sem poluir a arte.",
    captionExample: "Cada aplicação tem uma necessidade. Por isso, o dimensionamento correto faz diferença no resultado."
  },
  {
    id: "template-oferta-produto",
    name: "Oferta de produto",
    description: "Divulgar produto/linha com chamada comercial sem perder clareza técnica.",
    contentTypeId: "instalacao",
    channelId: "instagram",
    format: "Story",
    suggestedTime: "16:00",
    funnelStageId: "fundo",
    structure: "1. Produto ou kit\n2. Aplicação indicada\n3. Diferencial\n4. Chamada para orçamento",
    checklist: "Produto correto\nAplicações claras\nPreço só se autorizado\nCTA direto",
    structureItems: ["Produto ou kit", "Aplicação indicada", "Diferencial", "Chamada para orçamento"],
    checklistItems: [
      { id: "template-oferta-check-1", label: "Produto correto", done: false },
      { id: "template-oferta-check-2", label: "Aplicações claras", done: false },
      { id: "template-oferta-check-3", label: "Preço só se autorizado", done: false },
      { id: "template-oferta-check-4", label: "CTA direto", done: false }
    ],
    visualGuidance: "Arte limpa com produto em destaque, pouco texto e botão/chamada visível.",
    captionExample: "Kit indicado para quem busca uma solução bem dimensionada para aplicação diesel."
  },
  {
    id: "template-educativo-diesel-performance",
    name: "Conteúdo educativo diesel performance",
    description: "Explicar conceitos de performance diesel e posicionar a Embrepoli como referência técnica.",
    contentTypeId: "duvidas-tecnicas",
    channelId: "youtube",
    format: "Vídeo",
    suggestedTime: "18:00",
    funnelStageId: "topo",
    structure: "1. Conceito principal\n2. Erro comum\n3. Explicação técnica simples\n4. Aplicação prática",
    checklist: "Tema útil\nLinguagem simples\nExemplo real\nEvitar promessa absoluta",
    structureItems: ["Conceito principal", "Erro comum", "Explicação técnica simples", "Aplicação prática"],
    checklistItems: [
      { id: "template-educativo-check-1", label: "Tema útil", done: false },
      { id: "template-educativo-check-2", label: "Linguagem simples", done: false },
      { id: "template-educativo-check-3", label: "Exemplo real", done: false },
      { id: "template-educativo-check-4", label: "Evitar promessa absoluta", done: false }
    ],
    visualGuidance: "Misturar fala técnica com imagens de peças, gráficos simples ou exemplos reais.",
    captionExample: "Performance diesel não é só potência. Dimensionamento, aplicação e confiabilidade caminham juntos."
  }
];

export const ideas: Idea[] = [
  {
    id: "idea-1",
    templateId: "template-duvida-tecnica",
    title: "Mitos sobre turbina maior em motor diesel",
    description: "Explicar dúvidas comuns sobre turbina maior, lag, durabilidade e aplicação correta.",
    productLineId: "pickup-turbo",
    vehicleTypeId: "diesel-performance",
    contentTypeId: "duvidas-tecnicas",
    type: "Postagem",
    channelId: "instagram",
    format: "Feed",
    funnelStageId: "topo",
    createdBy: "user-conteudo",
    priority: "Alta",
    order: 1,
    attachments: []
  },
  {
    id: "idea-2",
    templateId: "template-bastidor-instalacao",
    title: "Bastidores da montagem de um kit intercooler",
    description: "Mostrar a sequência de montagem, acabamento e cuidados antes da entrega.",
    productLineId: "intercooler",
    vehicleTypeId: "caminhonetes",
    contentTypeId: "bastidores",
    type: "Postagem",
    channelId: "tiktok",
    format: "Vídeo",
    funnelStageId: "topo",
    createdBy: "user-design",
    priority: "Média",
    order: 2,
    attachments: []
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
    attachments: [],
    resetFrequency: "none",
    resetTime: "23:59",
    resetMonthLastDay: false
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
    attachments: [],
    resetFrequency: "none",
    resetTime: "23:59",
    resetMonthLastDay: false
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
    attachments: [],
    resetFrequency: "none",
    resetTime: "23:59",
    resetMonthLastDay: false
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
    attachments: [],
    resetFrequency: "none",
    resetTime: "23:59",
    resetMonthLastDay: false
  },
  {
    id: "goal-weekly-schedule",
    title: "Organizar agendamento semanal",
    columnId: "goals-todo",
    order: 1,
    priority: "Alta",
    progress: "No prazo",
    createdBy: "user-admin",
    assignedTo: ["user-gestor"],
    relatedTo: "Metas",
    funnelStageId: "topo",
    dueDate: "2026-05-17",
    description: "Planejar e revisar os posts da semana antes do fechamento do domingo.",
    checklist: [
      { id: "goal-weekly-check-1", label: "Revisar calendário da semana", done: false },
      { id: "goal-weekly-check-2", label: "Conferir responsáveis", done: false },
      { id: "goal-weekly-check-3", label: "Validar artes pendentes", done: false }
    ],
    comments: [],
    attachments: [],
    resetFrequency: "weekly",
    resetTime: "23:59",
    resetWeekday: 0,
    resetMonthLastDay: false,
    fixedGoalKey: "weekly_schedule",
    nextResetAt: "2026-05-18T02:59:00.000Z"
  },
  {
    id: "goal-monthly-targets",
    title: "Metas mensais",
    columnId: "goals-todo",
    order: 2,
    priority: "Média",
    progress: "No prazo",
    createdBy: "user-admin",
    assignedTo: ["user-gestor"],
    relatedTo: "Metas",
    funnelStageId: "meio",
    dueDate: "2026-05-31",
    description: "Acompanhar as metas mensais de marketing e registrar aprendizados do mês.",
    checklist: [
      { id: "goal-monthly-check-1", label: "Definir objetivo do mês", done: false },
      { id: "goal-monthly-check-2", label: "Acompanhar métricas principais", done: false },
      { id: "goal-monthly-check-3", label: "Registrar próximos ajustes", done: false }
    ],
    comments: [],
    attachments: [],
    resetFrequency: "monthly",
    resetTime: "23:59",
    resetMonthLastDay: true,
    fixedGoalKey: "monthly_goals",
    nextResetAt: "2026-06-01T02:59:00.000Z"
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


