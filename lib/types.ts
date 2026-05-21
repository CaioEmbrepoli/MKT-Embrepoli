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

export type ReviewAssetStatus = "Aguardando revisão" | "Aprovado" | "Ajustes solicitados";

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

export type Notification = {
  id: string;
  userId: string;
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  targetKind: "post" | "task" | "review" | "idea" | "campaign" | "metric" | "calendar" | "system";
  targetId: string;
};

export type CommentStatus = "novo" | "respondido" | "ignorado";

export type Comment = {
  id: string;
  source: "youtube" | "instagram" | "facebook" | "tiktok";
  externalId?: string;
  videoId?: string;
  videoTitle?: string;
  authorName: string;
  text: string;
  likes: number;
  response?: string;
  status: CommentStatus;
  addedToBank: boolean;
  bankQuestionId?: string;
  publishedAt?: string;
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


