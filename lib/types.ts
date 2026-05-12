export type Role = "admin" | "gestor" | "colaborador";

export type Profile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  bio: string;
  role: Role;
  avatarUrl: string;
  active: boolean;
  notificationSound: boolean;
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

export type PostStatus = string;

export type EditorialPost = {
  id: string;
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
  order?: number;
  publishAt: string;
  description: string;
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
  title: string;
  productLineId: string;
  vehicleTypeId: string;
  contentTypeId: string;
  type: "Postagem" | "Melhoria" | "Sistema" | "Outros";
  channelId: string;
  funnelStageId: string;
  createdBy: string;
  priority: string;
  order: number;
};

export type TaskPriority = string;
export type TaskProgress = string;

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

export type TaskAttachment = {
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
};

export type PostMetric = {
  id: string;
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
};

export type Notification = {
  id: string;
  userId: string;
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  targetKind: "post" | "task" | "review";
  targetId: string;
};


