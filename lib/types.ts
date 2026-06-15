export type Role = "admin" | "gestor" | "colaborador";

export type AppArea = "marketing" | "vendas";
export type ModuleAction = "view" | "create" | "edit" | "delete" | "approve" | "manage";

export type CustomerQuestionStatus = "pendente" | "respondido" | "aprovado" | "descartado";
export type CustomerQuestionSource = "youtube" | "instagram" | "facebook" | "tiktok" | "manual";

export type CustomerQuestion = {
  id: string;
  organizationId: string;
  source: CustomerQuestionSource;
  externalId?: string;
  videoId?: string;
  videoTitle?: string;
  questionText: string;
  answerText: string;
  authorName: string;
  likes: number;
  status: CustomerQuestionStatus;
  category: string;
  reviewerId?: string;
  learning: string;
  fromCommentId?: string;
  sourceCommentId?: string;
  needsReview: boolean;
  reviewedAt?: string;
  reviewedBy?: string;
  aiConfidence?: number;
  aiReason?: string;
  publishedAt?: string;
  answeredAt?: string;
  createdAt: string;
};

export type Profile = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  phone: string;
  bio: string;
  role: Role;
  avatarUrl: string;
  active: boolean;
  notificationSound: boolean;
};

export type ProfileArea = {
  id: string;
  profileId: string;
  area: AppArea;
  active: boolean;
};

export type ProfileModulePermission = {
  id: string;
  profileId: string;
  area: AppArea;
  moduleId: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canManage: boolean;
};

export type Channel = {
  id: string;
  name: string;
  color: string;
};

export type TrackableLink = {
  id: string;
  organizationId: string;
  slug: string;
  destinationUrl: string;
  label: string;
  clickCount: number;
  createdAt: string;
  createdBy?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

export type ProductLine = {
  id: string;
  name: string;
};

export type VehicleType = {
  id: string;
  name: string;
};

export type ContentType = {
  id: string;
  name: string;
};

export type FunnelStage = {
  id: string;
  name: string;
  color: string;
  order: number;
};

export type TaskColumn = {
  id: string;
  boardId: string;
  name: string;
  color: string;
  order: number;
};

export type TaskBoard = {
  id: string;
  name: string;
  order: number;
  isFixed: boolean;
};

export type Campaign = {
  id: string;
  name: string;
  objective: string;
  audience: string;
  message: string;
  productLineId: string;
  vehicleTypeId: string;
  funnelStageId: string;
  createdBy: string;
  assignedTo: string[];
  startDate: string;
  endDate: string;
  status: "Planejada" | "Ativa" | "Pausada" | "Encerrada";
};

export type CampaignAudience = {
  id: string;
  name: string;
};

export type PostStatus = string;

export type PostChannelEntry = {
  channelId: string;
  format: string;
};

export type EditorialPost = {
  id: string;
  ideaId?: string;
  templateId?: string;
  title: string;
  channelId: string;
  campaignId: string;
  productLineId: string;
  vehicleTypeId: string;
  contentTypeId: string;
  funnelStageId: string;
  createdBy: string;
  assignedTo: string[];
  status: PostStatus;
  format: string;
  extraChannels?: PostChannelEntry[];
  order?: number;
  publishAt: string;
  description: string;
  productionChecklist: ChecklistItem[];
  publishedVideoId?: string;
  publishedAt?: string;
};

export type PostPublicationPlatform = "youtube" | "tiktok" | "instagram" | "facebook" | "linkedin" | "outros";

export type PostPublicationStatus = "pending" | "processing" | "published" | "scheduled" | "error" | "cancelled";

export type PostPublicationCarouselAsset = {
  assetUrl: string;
  title?: string;
  order: number;
};

export type PostPublication = {
  id: string;
  postId: string;
  platform: PostPublicationPlatform;
  status: PostPublicationStatus;
  title: string;
  caption: string;
  format: string;
  assetUrl: string;
  carouselAssets?: PostPublicationCarouselAsset[];
  thumbnailUrl?: string;
  externalId?: string;
  permalink?: string;
  scheduledAt?: string;
  publishedAt?: string;
  error?: string;
  attempts: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type FileAttachment = {
  id: string;
  name: string;
  type: "arquivo" | "foto" | "video";
  source: "upload" | "external";
  url: string;
  previewUrl: string;
  originalSize: number;
  compressedSize: number;
  mimeType: string;
};

export type ReviewAssetStatus = "Aguardando revisão" | "Aprovado" | "Ajustes solicitados" | "Substituído";

export type PostReviewComment = {
  id: string;
  assetId: string;
  authorId: string;
  message: string;
  createdAt: string;
};

export type PostReviewAsset = {
  id: string;
  postId: string;
  name: string;
  type: "arquivo" | "foto" | "video";
  source: "upload" | "external";
  url: string;
  previewUrl: string;
  originalSize: number;
  compressedSize: number;
  mimeType: string;
  status: ReviewAssetStatus;
  uploadedBy: string;
  reviewedBy: string;
  uploadedAt: string;
  reviewedAt: string;
  comments: PostReviewComment[];
  isCover?: boolean;
  carouselGroupId?: string;
  carouselOrder?: number;
};

export type Idea = {
  id: string;
  templateId?: string;
  title: string;
  description: string;
  productLineId: string;
  vehicleTypeId: string;
  contentTypeId: string;
  type: "Postagem" | "Melhoria" | "Sistema" | "Outros";
  channelId: string;
  format: string;
  funnelStageId: string;
  createdBy: string;
  priority: string;
  order: number;
  attachments: FileAttachment[];
};

export type PostTemplate = {
  id: string;
  name: string;
  description: string;
  contentTypeId: string;
  channelId: string;
  format: string;
  suggestedTime: string;
  funnelStageId: string;
  structure: string;
  checklist: string;
  structureItems: string[];
  checklistItems: ChecklistItem[];
  visualGuidance: string;
  captionExample: string;
};

export type TaskPriority = string;
export type TaskProgress = string;
export type TaskResetFrequency = "none" | "daily" | "weekly" | "monthly" | "quarterly";

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

export type TaskComment = {
  id: string;
  authorId: string;
  message: string;
  createdAt: string;
};

export type TaskAttachment = FileAttachment;

export type CalendarDate = {
  id: string;
  name: string;
  date: string;
  type: "Feriado" | "Data comemorativa" | "Interno" | "Outro";
  color: string;
  notes: string;
};

export type Task = {
  id: string;
  title: string;
  columnId: string;
  order: number;
  priority: TaskPriority;
  progress: TaskProgress;
  createdBy: string;
  assignedTo: string[];
  relatedTo: string;
  funnelStageId: string;
  parentTaskId?: string;
  previousColumnId?: string;
  dueDate: string;
  description: string;
  checklist: ChecklistItem[];
  comments: TaskComment[];
  attachments: TaskAttachment[];
  resetFrequency: TaskResetFrequency;
  resetTime: string;
  resetWeekday?: number;
  resetMonthDay?: number;
  resetMonthLastDay: boolean;
  fixedGoalKey?: string;
  lastResetAt?: string;
  nextResetAt?: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  isPrivate?: boolean;
};

export type PostMetric = {
  id: string;
  externalId?: string;
  postId?: string;
  postTitle: string;
  channelId: string;
  campaignId: string;
  productLineId: string;
  vehicleTypeId: string;
  contentTypeId: string;
  funnelStageId: string;
  date: string;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  leads: number;
  notes: string;
  learning: string;
  videoType?: 'video' | 'short';
  privacyStatus?: 'public' | 'unlisted' | 'private';
  watchTimeMinutes?: number;
  averageViewDurationSeconds?: number;
  averageViewPercentage?: number;
  subscribersGained?: number;
  subscribersLost?: number;
  impressions?: number;
  impressionClickThroughRate?: number;
  thumbnailUrl?: string;
  sourceUrl?: string;
  embedUrl?: string;
};

export type PostMetricSnapshot = {
  id: string;
  metricId: string;
  capturedAt: string;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  leads: number;
};

export type AdPlatform = "meta" | "google" | "tiktok" | "outros";
export type AdEntityStatus = "active" | "paused" | "archived" | "deleted" | "unknown";
export type AdBudgetType = "daily" | "lifetime" | "unknown";
export type AdAlertSeverity = "bom" | "atencao" | "critico";
export type AdAlertStatus = "open" | "reviewed" | "dismissed";
export type AdAlertEntityType = "account" | "campaign" | "ad_set" | "ad";

export type AdAccount = {
  id: string;
  platform: AdPlatform;
  externalId?: string;
  name: string;
  currency: string;
  status: AdEntityStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type AdCampaign = {
  id: string;
  accountId: string;
  internalCampaignId?: string;
  externalId?: string;
  name: string;
  objective: string;
  status: AdEntityStatus;
  budgetAmount?: number;
  budgetType?: AdBudgetType;
  startsAt?: string;
  endsAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AdSet = {
  id: string;
  accountId: string;
  campaignId: string;
  externalId?: string;
  name: string;
  audienceName?: string;
  status: AdEntityStatus;
  budgetAmount?: number;
  budgetType?: AdBudgetType;
  createdAt?: string;
  updatedAt?: string;
};

export type Ad = {
  id: string;
  accountId: string;
  campaignId: string;
  adSetId?: string;
  externalId?: string;
  name: string;
  creativeName?: string;
  status: AdEntityStatus;
  thumbnailUrl?: string;
  sourceUrl?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AdInsightDaily = {
  id: string;
  platform: AdPlatform;
  accountId: string;
  campaignId?: string;
  adSetId?: string;
  adId?: string;
  date: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  cpm: number;
  clicks: number;
  linkClicks: number;
  ctr: number;
  cpc: number;
  landingPageViews: number;
  leads: number;
  costPerLead: number;
  conversations: number;
  costPerConversation: number;
  purchases: number;
  purchaseValue: number;
  costPerPurchase: number;
  roas: number;
  engagements: number;
  videoViews: number;
  costPerEngagement: number;
  breakdownPlacement?: string;
  breakdownAge?: string;
  breakdownGender?: string;
  breakdownRegion?: string;
  breakdownDevice?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AdAlert = {
  id: string;
  platform: AdPlatform;
  severity: AdAlertSeverity;
  status: AdAlertStatus;
  entityType: AdAlertEntityType;
  entityId: string;
  title: string;
  description: string;
  recommendation: string;
  metricKey: string;
  metricValue?: number;
  benchmarkValue?: number;
  date: string;
  createdAt?: string;
  reviewedAt?: string;
};

export type Notification = {
  id: string;
  userId: string;
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  targetKind: "post" | "task" | "review" | "idea" | "campaign" | "metric" | "calendar" | "question" | "system";
  targetId: string;
};

export type CommentStatus = "novo" | "respondido" | "ignorado";
export type CommentClassificationStatus = "pendente" | "relevante" | "normal" | "erro";

export type CommentExternalReply = {
  id: string;
  authorName: string;
  authorAvatarUrl?: string;
  text: string;
  publishedAt: string;
  likes?: number;
  isOwnReply?: boolean;
};

export type CommentResponseHistoryItem = {
  id: string;
  externalReplyId?: string;
  text: string;
  sentAt: string;
  editedAt?: string;
  source: "youtube" | "instagram" | "facebook" | "tiktok";
  kind: "primary" | "additional";
};

export type Comment = {
  id: string;
  source: "youtube" | "instagram" | "facebook" | "tiktok";
  externalId?: string;
  importSignature?: string;
  videoId?: string;
  videoTitle?: string;
  mediaThumbnailUrl?: string;
  mediaUrl?: string;
  mediaPermalink?: string;
  authorName: string;
  authorAvatarUrl?: string;
  text: string;
  likes: number;
  likedByOrg?: boolean;
  externalReplies?: CommentExternalReply[];
  response?: string;
  responseExternalId?: string;
  responseHistory?: CommentResponseHistoryItem[];
  status: CommentStatus;
  addedToBank: boolean;
  bankQuestionId?: string;
  publishedAt?: string;
  retentionUntil?: string;
  processedAt?: string;
  isRelevant?: boolean;
  classificationStatus?: CommentClassificationStatus;
  classificationReason?: string;
  suggestedReply?: string;
  createdAt: string;
};

export type AutoFilterMatchType = "contains" | "startsWith" | "exact";

export type AutoFilter = {
  id: string;
  keyword: string;
  matchType: AutoFilterMatchType;
  active: boolean;
  createdAt: string;
};

export type KnowledgeChatSessionStatus = "active" | "archived";

export type KnowledgeChatSession = {
  id: string;
  organizationId: string;
  userId: string;
  dateKey: string;
  status: KnowledgeChatSessionStatus;
  title: string;
  archivedAt?: string;
  expiresAt?: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeChatMessageRole = "user" | "ai" | "system" | "error";

export type KnowledgeChatMessage = {
  id: string;
  sessionId: string;
  organizationId: string;
  userId: string;
  role: KnowledgeChatMessageRole;
  content: string;
  provider?: string;
  model?: string;
  unknown: boolean;
  confidence?: number;
  reason?: string;
  gapId?: string;
  errorMessage?: string;
  createdAt: string;
};

export type KnowledgeChatMatch = {
  id: string;
  sessionId: string;
  messageId: string;
  questionId: string;
  confidence?: number;
  reason?: string;
  createdAt: string;
};

export type KnowledgeGapStatus = "aguardando_resposta" | "convertido" | "ignorado" | "erro";

export type KnowledgeGap = {
  id: string;
  organizationId: string;
  sessionId: string;
  userId: string;
  questionText: string;
  status: KnowledgeGapStatus;
  customerQuestionId?: string;
  answeredAt?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
};

// ── Vendas — Clientes ─────────────────────────────────────────────────────────

export type SalesClientStatus = "lead" | "cliente" | "inativo";
export type SalesClientSource = "instagram" | "youtube" | "indicacao" | "site" | "manual" | "outros";

export type SalesFunnelStage = {
  id: string;
  name: string;
  color: string;
  emoji: string;
  order: number;
  halfWidth: boolean;
};

export type SalesProposal = {
  id: string;
  title: string;
  value: number;
  status: "rascunho" | "enviada" | "negociacao" | "ganha" | "perdida" | "expirada";
  createdAt: string;
  notes: string;
};

export type SalesClient = {
  id: string;
  externalCode: string;
  name: string;
  clientType: string;
  cpf?: string;
  cnpj?: string;
  email: string;
  phone: string;
  company: string;
  segment: string;
  stateUf: string;
  city: string;
  lastPurchaseAt: string;
  lastPurchaseValue?: number;
  status: SalesClientStatus;
  source: SalesClientSource;
  sourceCustom?: string;
  assignedTo: string;
  notes: string;
  proposals: SalesProposal[];
  salesFunnelStage: string;
  createdAt: string;
};

// ── Vendas — Ligações ─────────────────────────────────────────────────────────

export type CallFrequency = "daily" | "weekly" | "biweekly" | "monthly";

export type CallLog = {
  id: string;
  date: string;
  notes: string;
  outcome: string;
};

export type CallSchedule = {
  id: string;
  clientId: string;
  clientName: string;
  phone: string;
  frequency: CallFrequency;
  nextCallAt: string;
  lastCallAt?: string;
  callHistory: CallLog[];
  assignedTo: string;
  createdBy: string;
  active: boolean;
  paused?: boolean;
  archived?: boolean;
  manualDate?: boolean;
  notes: string;
};

// ── Feedback ──────────────────────────────────────────────────────────────────

export type FeedbackKind = "duvida" | "problema" | "ideia";
export type FeedbackStatus = "novo" | "visto" | "resolvido";

export type AppFeedback = {
  id: string;
  organizationId: string;
  createdBy: string;
  kind: FeedbackKind;
  description: string;
  attachments: FileAttachment[];
  status: FeedbackStatus;
  createdAt: string;
  reply?: string;
  repliedBy?: string;
  repliedAt?: string;
};


