"use client";

import {
  closestCorners,
  DndContext,
  DragEndEvent,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";
import {
  BarChart3,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  File,
  FileImage,
  FileUp,
  FileText,
  FileVideo,
  Download,
  Folder,
  GripVertical,
  HardDrive,
  HelpCircle,
  Bell,
  Eye,
  EyeOff,
  KanbanSquare,
  Lightbulb,
  LogOut,
  Megaphone,
  MessageSquare,
  Plus,
  Minus,
  Search,
  Send,
  Settings,
  Trash2,
  UserRound,
  Users,
  X,
  Youtube,
  Wand2,
  Phone,
  Target,
  Pencil,
  Clock,
  Pause,
  Play,
  Columns2,
  type LucideIcon
} from "lucide-react";
import type { Dispatch, FormEvent, ReactNode, RefObject, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import {
  campaignAudiences as seedCampaignAudiences,
  profileAreas as seedProfileAreas,
  profileModulePermissions as seedProfileModulePermissions
} from "@/lib/seed-data";
import {
  appAreas,
  marketingModules,
  moduleActions,
  salesModules
} from "@/lib/modules";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { classifyLocal } from "@/lib/classify";
import { disconnectGoogleConnection, fetchDriveThumbnailObjectUrl, getGoogleStatus, listDriveFolder, listMyYouTubeChannelVideos, listVideoComments, listYouTubeVideoComments, searchYouTube, startGoogleConnection, type DriveFile, type DriveItem, type GoogleConnectionStatus, type GoogleService, type YouTubeChannelVideo, type YouTubeCommentItem, type YouTubeCommentResult, type YouTubeImportProgress, type YouTubeVideo } from "@/lib/google-api";
import { disconnectTikTokConnection, getTikTokStatus, listTikTokVideos, startTikTokConnection, type TikTokConnectionStatus } from "@/lib/tiktok-api";
import {
  type AppData,
  deleteCampaign,
  deleteCampaignAudience,
  deleteCalendarDate,
  deleteChannel,
  deleteContentType,
  deleteFunnelStage,
  deleteIdea,
  deleteMetric,
  deleteNotification,
  deletePost,
  deletePostReviewAsset as deletePostReviewAssetRecord,
  deletePostTemplate,
  deleteProductLine,
  deleteProfile,
  deleteProfileArea,
  deleteProfileModulePermission,
  deleteTask,
  deleteTaskBoard,
  deleteTaskColumn,
  deleteVehicleType,
  ensureCurrentProfile,
  loadAppData,
  saveCampaign,
  saveCampaignAudience,
  saveCalendarDate,
  saveChannel,
  saveContentType,
  saveFunnelStage,
  saveIdea,
  saveMetric,
  saveMetricSnapshots,
  replaceMetrics,
  replaceCustomerQuestions,
  insertCustomerQuestions,
  saveCustomerQuestion,
  deleteCustomerQuestion,
  saveComment,
  deleteComment,
  insertComments,
  saveAutoFilter,
  deleteAutoFilter,
  saveSalesClient,
  deleteSalesClient,
  saveSalesFunnelStage,
  deleteSalesFunnelStage,
  saveCallSchedule,
  deleteCallSchedule,
  saveNotification,
  savePost,
  savePostReviewAsset,
  savePostTemplate,
  saveProductLine,
  saveProfile,
  saveProfileArea,
  saveProfileModulePermission,
  saveTask,
  saveTaskBoard,
  saveTaskColumn,
  saveVehicleType
} from "@/lib/supabase-data";
import type {
  AutoFilter,
  AppArea,
  Campaign,
  CampaignAudience,
  CalendarDate,
  Channel,
  ChecklistItem,
  Comment,
  CommentStatus,
  ContentType,
  EditorialPost,
  FileAttachment,
  FunnelStage,
  Idea,
  Notification,
  CustomerQuestion,
  CustomerQuestionStatus,
  CustomerQuestionSource,
  KnowledgeChatMessage,
  KnowledgeChatSession,
  KnowledgeGap,
  PostReviewAsset,
  PostReviewComment,
  ReviewAssetStatus,
  PostMetric,
  PostMetricSnapshot,
  PostTemplate,
  PostChannelEntry,
  PostStatus,
  ProductLine,
  Profile,
  ProfileArea,
  ProfileModulePermission,
  Role,
  Task,
  TaskAttachment,
  TaskBoard,
  TaskColumn,
  TaskPriority,
  TaskProgress,
  TaskResetFrequency,
  VehicleType,
  SalesClient,
  SalesClientStatus,
  SalesClientSource,
  SalesProposal,
  SalesFunnelStage,
  CallSchedule,
  CallFrequency,
  CallLog
} from "@/lib/types";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type ModalState =
  | { kind: "post"; id?: string; date?: Date; ideaId?: string }
  | { kind: "idea"; id?: string }
  | { kind: "campaign"; id?: string }
  | { kind: "metric"; id?: string }
  | { kind: "task"; id: string }
  | { kind: "profile" }
  | { kind: "teamMember"; id: string }
  | { kind: "publish"; postId: string }
  | null;

type MediaPreviewItem = Pick<FileAttachment, "name" | "type" | "source" | "url" | "previewUrl" | "mimeType">;

type AuthMode = "login" | "signup" | "forgot" | "reset" | "checkEmail" | "pending";
type BadgeTone = "blue" | "cyan" | "slate" | "red" | "green" | "amber" | "purple";

type ConfigTab = "Equipe" | "Funil" | "Filtros" | "Modelos" | "Datas" | "Conta e Permissões";
type MenuItem = { sectionId: string; moduleId: string; area: AppArea; label: string; icon: LucideIcon };

const moduleIcons: Record<string, LucideIcon> = {
  painel: BarChart3,
  calendario: CalendarDays,
  ideias: Lightbulb,
  tarefas: KanbanSquare,
  revisoes: CheckCircle2,
  campanhas: Megaphone,
  metricas: ClipboardList,
  comentarios: MessageSquare,
  "banco-duvidas": HelpCircle,
  configuracoes: Settings,
  clientes: Users,
  ligacoes: Phone,
  "funil-comercial": KanbanSquare,
  atividades: ClipboardList,
  metas: Target
};

const marketingMenu: MenuItem[] = marketingModules.map((item) => ({ ...item, icon: moduleIcons[item.moduleId] ?? Settings }));
const salesMenu: MenuItem[] = salesModules.map((item) => ({ ...item, icon: moduleIcons[item.moduleId] ?? Settings }));

const menu = [...marketingMenu, ...salesMenu];
const marketingConfigTabs: ConfigTab[] = ["Equipe", "Funil", "Filtros", "Modelos", "Datas", "Conta e Permissões"];
const salesConfigTabs: ConfigTab[] = ["Equipe", "Conta e Permissões"];

const postStatuses: PostStatus[] = ["Ideia", "Produção", "Revisão", "Aprovado", "Agendado", "Publicado"];
const campaignAudienceOptions = seedCampaignAudiences.map((audience) => audience.name);
const fallbackPostFormats = ["Post", "Vídeo", "Story"];
const priorities: TaskPriority[] = ["Alta", "Média", "Baixa"];
const progresses: TaskProgress[] = ["Bloqueada", "No prazo", "Atenção", "Finalizando"];
const resetFrequencies: { value: TaskResetFrequency; label: string }[] = [
  { value: "none", label: "Nenhum" },
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
  { value: "quarterly", label: "Trimestral" }
];

const goalsBoardId = "metas";

function findMetasBoardId(taskBoards: TaskBoard[]): string {
  return (
    taskBoards.find((b) => b.id === "metas")?.id ??
    taskBoards.find((b) => normalizeText(b.name) === "metas")?.id ??
    "metas"
  );
}

function isMetasBoardId(boardId: string | undefined, taskBoards: TaskBoard[]): boolean {
  if (!boardId) return false;
  if (boardId === "metas" || boardId === "vendas-metas") return true;
  const board = taskBoards.find((b) => b.id === boardId);
  return Boolean(board && normalizeText(board.name) === "metas");
}

const GOALS_VIRTUAL_COLUMNS: { id: string; boardId: string; name: string; color: string; frequency: TaskResetFrequency; order: number }[] = [
  { id: "goals-daily", boardId: goalsBoardId, name: "Diárias", color: "#dbeafe", frequency: "daily", order: 1 },
  { id: "goals-weekly", boardId: goalsBoardId, name: "Semanais", color: "#dcfce7", frequency: "weekly", order: 2 },
  { id: "goals-monthly", boardId: goalsBoardId, name: "Mensais", color: "#fef3c7", frequency: "monthly", order: 3 },
  { id: "goals-quarterly", boardId: goalsBoardId, name: "Trimestrais", color: "#e9d5ff", frequency: "quarterly", order: 4 },
  { id: "goals-none", boardId: goalsBoardId, name: "Únicas", color: "#f1f5f9", frequency: "none", order: 5 }
];
const goalsColumnByFrequency = new Map(GOALS_VIRTUAL_COLUMNS.map((c) => [c.frequency, c]));
const goalsColumnIds = new Set(GOALS_VIRTUAL_COLUMNS.map((c) => c.id));

const VENDAS_GOALS_VIRTUAL_COLUMNS: { id: string; name: string; color: string; frequency: TaskResetFrequency; order: number }[] = [
  { id: "vendas-goals-daily",     name: "Diárias",     color: "#dbeafe", frequency: "daily",     order: 1 },
  { id: "vendas-goals-weekly",    name: "Semanais",    color: "#dcfce7", frequency: "weekly",    order: 2 },
  { id: "vendas-goals-monthly",   name: "Mensais",     color: "#fef3c7", frequency: "monthly",   order: 3 },
  { id: "vendas-goals-quarterly", name: "Trimestrais", color: "#e9d5ff", frequency: "quarterly", order: 4 },
  { id: "vendas-goals-none",      name: "Únicas",      color: "#f1f5f9", frequency: "none",      order: 5 },
];
const vendasGoalsColumnIds = new Set(VENDAS_GOALS_VIRTUAL_COLUMNS.map((c) => c.id));

function isGoalColumn(columnId: string | undefined) {
  return columnId ? (goalsColumnIds.has(columnId) || vendasGoalsColumnIds.has(columnId)) : false;
}

function computeGoalStatus(task: Task): { kind: "atingida" | "quase" | "atrasada" | "progresso"; pct: number } {
  const target = task.targetValue ?? 0;
  const current = task.currentValue ?? 0;
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  if (target > 0 && current >= target) return { kind: "atingida", pct: 100 };
  if (task.nextResetAt && task.lastResetAt) {
    const start = new Date(task.lastResetAt).getTime();
    const end = new Date(task.nextResetAt).getTime();
    if (end > start) {
      const timePct = (Date.now() - start) / (end - start);
      const progressPct = target > 0 ? current / target : 0;
      if (timePct > 0.8 && progressPct >= 0.9) return { kind: "quase", pct };
      if (timePct > 0.5 && progressPct < 0.5) return { kind: "atrasada", pct };
    }
  }
  return { kind: "progresso", pct };
}

function goalStatusColors(kind: "atingida" | "quase" | "atrasada" | "progresso") {
  if (kind === "atingida") return { bar: "#16a34a", badge: "green" as const, label: "Atingida" };
  if (kind === "quase") return { bar: "#f59e0b", badge: "amber" as const, label: "Quase lá" };
  if (kind === "atrasada") return { bar: "#dc2626", badge: "red" as const, label: "Atrasada" };
  return { bar: "#2563eb", badge: "blue" as const, label: "Em progresso" };
}
const weekDays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const priorityToneMap: Record<string, BadgeTone> = { Alta: "red", Média: "amber", Baixa: "blue" };
const progressToneMap: Record<string, BadgeTone> = { Bloqueada: "red", "No prazo": "blue", Atenção: "amber", Finalizando: "green" };
const postStatusConfig: Record<string, { tone: BadgeTone; label: string }> = {
  "Ideia":     { tone: "slate",   label: "Ideia" },
  "Produção":  { tone: "blue",    label: "Produção" },
  "Revisão":   { tone: "amber",   label: "Revisão" },
  "Aprovado":  { tone: "purple",  label: "Aprovado" },
  "Agendado":  { tone: "cyan",    label: "Agendado" },
  "Publicado": { tone: "green",   label: "Publicado" },
};
const roles: Role[] = ["admin", "gestor", "colaborador"];
const ideaTypes: Idea["type"][] = ["Postagem", "Melhoria", "Sistema", "Outros"];
const calendarTaskBoardId = "__calendar_posts__";
type SaveStatus = "idle" | "saving" | "saved" | "error";
const maxImageBytes = 2 * 1024 * 1024;
const maxVideoBytes = 100 * 1024 * 1024;
const maxImageDimension = 1920;

type PreparedUploadFile = {
  file: File;
  originalSize: number;
  compressedSize: number;
  notice: string;
};

function postFormatOptionsForChannel(channel?: Channel) {
  const normalized = normalizeText(channel?.name ?? "");
  if (normalized.includes("instagram")) return ["Feed", "Story", "Reels"];
  if (normalized.includes("youtube")) return ["Vídeo", "Shorts"];
  if (normalized.includes("tiktok")) return ["Vídeo", "Story", "Live", "Feed"];
  if (normalized.includes("facebook")) return ["Feed", "Story", "Reels"];
  if (normalized.includes("linkedin")) return ["Post", "Artigo", "Vídeo"];
  if (normalized.includes("blog") || normalized.includes("site")) return ["Artigo", "Infográfico"];
  if (normalized.includes("email") || normalized.includes("e-mail")) return ["Newsletter"];
  if (normalized.includes("whatsapp")) return ["Status", "Mensagem"];
  return fallbackPostFormats;
}

function defaultPostFormatForChannel(channel?: Channel) {
  const normalized = normalizeText(channel?.name ?? "");
  if (normalized.includes("youtube")) return "Shorts";
  if (normalized.includes("instagram")) return "Reels";
  if (normalized.includes("tiktok")) return "Feed";
  if (normalized.includes("facebook")) return "Feed";
  if (normalized.includes("linkedin")) return "Post";
  if (normalized.includes("blog") || normalized.includes("site")) return "Artigo";
  if (normalized.includes("email") || normalized.includes("e-mail")) return "Newsletter";
  if (normalized.includes("whatsapp")) return "Status";
  return postFormatOptionsForChannel(channel)[0] ?? "Post";
}

function authRedirectUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const baseUrl = configuredUrl || (typeof window !== "undefined" ? window.location.origin : "");
  return `${baseUrl.replace(/\/$/, "")}/`;
}

function defaultTaskResetFields(): Pick<Task, "resetFrequency" | "resetTime" | "resetMonthLastDay"> {
  return { resetFrequency: "none", resetTime: "23:59", resetMonthLastDay: false };
}

function saoPauloLocalDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  return { year: part("year"), month: part("month"), day: part("day") };
}

function localSaoPauloToUtcIso(year: number, month: number, day: number, time: string) {
  const [hour = 23, minute = 59] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour + 3, minute, 0, 0)).toISOString();
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function calculateNextResetAt(task: Pick<Task, "resetFrequency" | "resetTime" | "resetWeekday" | "resetMonthDay" | "resetMonthLastDay">, from = new Date()) {
  if (!task.resetFrequency || task.resetFrequency === "none") return "";
  const local = saoPauloLocalDate(from);
  const time = task.resetTime || "23:59";
  const candidates: string[] = [];

  if (task.resetFrequency === "daily") {
    candidates.push(localSaoPauloToUtcIso(local.year, local.month, local.day, time));
    const tomorrow = new Date(Date.UTC(local.year, local.month - 1, local.day + 1, 12));
    const next = saoPauloLocalDate(tomorrow);
    candidates.push(localSaoPauloToUtcIso(next.year, next.month, next.day, time));
  }

  if (task.resetFrequency === "weekly") {
    const target = task.resetWeekday ?? 0;
    const base = new Date(Date.UTC(local.year, local.month - 1, local.day, 12));
    for (let offset = 0; offset <= 7; offset += 1) {
      const candidate = new Date(base);
      candidate.setUTCDate(base.getUTCDate() + offset);
      if (candidate.getUTCDay() === target) {
        const next = saoPauloLocalDate(candidate);
        candidates.push(localSaoPauloToUtcIso(next.year, next.month, next.day, time));
      }
    }
  }

  if (task.resetFrequency === "monthly") {
    for (let offset = 0; offset <= 1; offset += 1) {
      const month = local.month + offset;
      const year = local.year + Math.floor((month - 1) / 12);
      const normalizedMonth = ((month - 1) % 12) + 1;
      const day = task.resetMonthLastDay
        ? lastDayOfMonth(year, normalizedMonth)
        : Math.min(task.resetMonthDay ?? 1, lastDayOfMonth(year, normalizedMonth));
      candidates.push(localSaoPauloToUtcIso(year, normalizedMonth, day, time));
    }
  }

  if (task.resetFrequency === "quarterly") {
    const currentQuarterStartMonth = Math.floor((local.month - 1) / 3) * 3 + 1;
    for (let offset = 0; offset <= 4; offset += 3) {
      const month = currentQuarterStartMonth + 3 + offset;
      const year = local.year + Math.floor((month - 1) / 12);
      const normalizedMonth = ((month - 1) % 12) + 1;
      candidates.push(localSaoPauloToUtcIso(year, normalizedMonth, 1, time));
    }
  }

  return candidates.filter((candidate) => new Date(candidate).getTime() > from.getTime()).sort()[0] ?? "";
}

function resetScheduleLabel(task: Task) {
  if (!task.resetFrequency || task.resetFrequency === "none") return "Sem reset automático";
  if (task.resetFrequency === "daily") return `Diário às ${task.resetTime || "23:59"}`;
  if (task.resetFrequency === "weekly") return `Semanal: ${weekDays[task.resetWeekday ?? 0]} às ${task.resetTime || "23:59"}`;
  if (task.resetFrequency === "quarterly") return `Trimestral: primeiro dia do trimestre às ${task.resetTime || "23:59"}`;
  const day = task.resetMonthLastDay ? "último dia do mês" : `dia ${task.resetMonthDay ?? 1}`;
  return `Mensal: ${day} às ${task.resetTime || "23:59"}`;
}

function stableCollisionDetection(args: Parameters<typeof pointerWithin>[0]) {
  const pointerHits = pointerWithin(args);
  return pointerHits.length ? pointerHits : closestCorners(args);
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 MB";
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 1024 * 1024 ? 1 : 2)} MB`;
}

function fileKind(file: File): "arquivo" | "foto" | "video" {
  return file.type.startsWith("image/") ? "foto" : file.type.startsWith("video/") ? "video" : "arquivo";
}

function sanitizeFileName(name: string): string {
  // Remove acentos (ç→c, ã→a, etc.) e substitui caracteres inválidos por _
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_(?=\.)$/g, "");
}

async function prepareUploadFile(file: File): Promise<PreparedUploadFile> {
  if (file.type.startsWith("video/") && file.size > maxVideoBytes) {
    throw new Error(`Vídeos podem ter no máximo ${formatBytes(maxVideoBytes)}. Para arquivos maiores, adicione um link do Google Drive.`);
  }
  if (!file.type.startsWith("image/") || file.size <= maxImageBytes) {
    return { file, originalSize: file.size, compressedSize: file.size, notice: "" };
  }
  const compressed = await compressImageFile(file);
  if (compressed.size > maxImageBytes) {
    throw new Error(`Não foi possível reduzir a imagem para menos de ${formatBytes(maxImageBytes)}. Tente enviar uma imagem menor.`);
  }
  return {
    file: compressed,
    originalSize: file.size,
    compressedSize: compressed.size,
    notice: `Imagem comprimida de ${formatBytes(file.size)} para ${formatBytes(compressed.size)}.`
  };
}

async function compressImageFile(file: File) {
  const image = await loadImage(file);
  let width = image.naturalWidth;
  let height = image.naturalHeight;
  const ratio = Math.min(1, maxImageDimension / Math.max(width, height));
  width = Math.max(1, Math.round(width * ratio));
  height = Math.max(1, Math.round(height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a compressão da imagem.");
  context.drawImage(image, 0, 0, width, height);
  URL.revokeObjectURL(image.src);

  let quality = 0.82;
  let blob = await canvasToBlob(canvas, "image/jpeg", quality);
  while (blob.size > maxImageBytes && quality > 0.42) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
  }
  return new globalThis.File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível ler a imagem enviada."));
    image.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Não foi possível comprimir a imagem.")), type, quality);
  });
}

function drivePreviewUrl(url: string) {
  const trimmed = url.trim();
  const youtube = youtubePreviewUrl(trimmed);
  if (youtube) return youtube;
  const match = trimmed.match(/drive\.google\.com\/file\/d\/([^/]+)/) ?? trimmed.match(/[?&]id=([^&]+)/);
  if (!match?.[1]) return "";
  return `https://drive.google.com/file/d/${match[1]}/preview`;
}

function youtubePreviewUrl(url: string) {
  const trimmed = url.trim();
  const match = trimmed.match(/youtu\.be\/([^?&/]+)/)
    ?? trimmed.match(/[?&]v=([^?&/]+)/)
    ?? trimmed.match(/youtube\.com\/shorts\/([^?&/]+)/)
    ?? trimmed.match(/youtube\.com\/embed\/([^?&/]+)/);
  return match?.[1] ? `https://www.youtube.com/embed/${match[1]}` : "";
}

const OFFICE_AND_PDF_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/rtf",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "text/csv",
  "text/plain"
]);
const OFFICE_EXT_RE = /\.(pdf|docx?|xlsx?|pptx?|rtf|csv|txt|odt|ods|odp)(\?.*)?$/i;

function isDocumentFile(item: { mimeType?: string; name?: string; url?: string }): boolean {
  if (item.mimeType && OFFICE_AND_PDF_MIMES.has(item.mimeType)) return true;
  return OFFICE_EXT_RE.test(item.name || item.url || "");
}

function extractDriveFileId(url: string): string | null {
  const match = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/) ?? url.match(/[?&]id=([^&]+)/);
  return match?.[1] ?? null;
}

function buildOnlineViewerUrl(item: { url: string; source: "upload" | "external" }): string {
  if (item.source === "external") {
    const id = extractDriveFileId(item.url);
    return id ? `https://drive.google.com/file/d/${id}/view` : item.url;
  }
  return `https://docs.google.com/viewer?url=${encodeURIComponent(item.url)}`;
}

function buildEmbeddedViewerUrl(item: { url: string; previewUrl?: string; source: "upload" | "external" }): string {
  if (item.source === "external") return item.previewUrl || item.url;
  return `https://docs.google.com/viewer?url=${encodeURIComponent(item.url)}&embedded=true`;
}

function buildDownloadUrl(item: { url: string; source: "upload" | "external" }): string {
  if (item.source === "external") {
    const id = extractDriveFileId(item.url);
    if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  }
  return item.url;
}

class AnyButtonPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent: event }: any, { onActivation }: any) => {
        if (!event.isPrimary || (event.button !== 0 && event.button !== 2)) return false;
        onActivation?.({ event });
        return true;
      }
    }
  ];
}

const roleLabel: Record<Role, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  colaborador: "Colaborador"
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: value.includes("T") ? "2-digit" : undefined,
    minute: value.includes("T") ? "2-digit" : undefined
  }).format(new Date(value.includes("T") ? value : `${value}T12:00:00`));

const formatNumber = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

const formatPercent = (value: number) => `${value.toFixed(1).replace(".", ",")}%`;

const formatDuration = (seconds: number) => {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const remainingSeconds = safe % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return `${hours}h ${String(restMinutes).padStart(2, "0")}min`;
  }
  return `${minutes}min ${String(remainingSeconds).padStart(2, "0")}s`;
};

const metricEngagement = (metric: PostMetric) => metric.likes + metric.comments + metric.shares;

const metricEngagementRate = (metric: PostMetric) => metric.reach ? (metricEngagement(metric) / metric.reach) * 100 : 0;

const metricConversionRate = (metric: PostMetric) => metric.clicks ? (metric.leads / metric.clicks) * 100 : 0;

function thumbnailFor(metric: PostMetric): string | null {
  if (metric.thumbnailUrl) return proxiedThumbnailUrl(metric.thumbnailUrl);
  const ext = metric.externalId;
  if (ext?.startsWith("yt:")) return `https://i.ytimg.com/vi/${ext.slice(3)}/mqdefault.jpg`;
  return null;
}

function proxiedThumbnailUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const shouldProxy = ["tiktok", "tiktokcdn", "muscdn", "byteimg"].some((part) => host.includes(part));
    if (shouldProxy) return `/api/tiktok/thumb?url=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
  return url;
}

function metricMatchesFilter(value: string | undefined, filter: string): boolean {
  return filter === "all" || !value || value === filter;
}

type MetricTotals = {
  reach: number;
  engagement: number;
  clicks: number;
  leads: number;
  likes: number;
  comments: number;
  shares: number;
  watchTimeMinutes: number;
  averageViewDurationSeconds: number;
  averageViewPercentage: number;
  subscribersGained: number;
  subscribersLost: number;
  impressions: number;
  impressionClickThroughRate: number;
  analyticsCount: number;
  impressionCount: number;
};

function computeMetricTotals(items: PostMetric[]): MetricTotals {
  return items.reduce<MetricTotals>((acc, metric) => {
    const hasAnalytics = metric.averageViewDurationSeconds != null || metric.averageViewPercentage != null || metric.watchTimeMinutes != null;
    const hasImpressions = metric.impressions != null || metric.impressionClickThroughRate != null;
    return {
      reach: acc.reach + metric.reach,
      engagement: acc.engagement + metricEngagement(metric),
      clicks: acc.clicks + metric.clicks,
      leads: acc.leads + metric.leads,
      likes: acc.likes + metric.likes,
      comments: acc.comments + metric.comments,
      shares: acc.shares + metric.shares,
      watchTimeMinutes: acc.watchTimeMinutes + (metric.watchTimeMinutes ?? 0),
      averageViewDurationSeconds: acc.averageViewDurationSeconds + (metric.averageViewDurationSeconds ?? 0),
      averageViewPercentage: acc.averageViewPercentage + (metric.averageViewPercentage ?? 0),
      subscribersGained: acc.subscribersGained + (metric.subscribersGained ?? 0),
      subscribersLost: acc.subscribersLost + (metric.subscribersLost ?? 0),
      impressions: acc.impressions + (metric.impressions ?? 0),
      impressionClickThroughRate: acc.impressionClickThroughRate + (metric.impressionClickThroughRate ?? 0),
      analyticsCount: acc.analyticsCount + (hasAnalytics ? 1 : 0),
      impressionCount: acc.impressionCount + (hasImpressions ? 1 : 0),
    };
  }, {
    reach: 0,
    engagement: 0,
    clicks: 0,
    leads: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    watchTimeMinutes: 0,
    averageViewDurationSeconds: 0,
    averageViewPercentage: 0,
    subscribersGained: 0,
    subscribersLost: 0,
    impressions: 0,
    impressionClickThroughRate: 0,
    analyticsCount: 0,
    impressionCount: 0
  });
}

type MetricBreakdownItem = { id: string; name: string; value: number; color: string };

function aggregateMetricBreakdown(
  items: PostMetric[],
  groupBy: keyof PostMetric,
  labels: Map<string, { name: string; color?: string }>,
  getValue: (metric: PostMetric) => number
): MetricBreakdownItem[] {
  return Object.entries(items.reduce<Record<string, number>>((acc, metric) => {
    const id = String(metric[groupBy] ?? "") || "__uncategorized";
    acc[id] = (acc[id] ?? 0) + getValue(metric);
    return acc;
  }, {}))
    .map(([id, value]) => ({
      id,
      name: labels.get(id)?.name ?? "Sem categoria",
      value,
      color: labels.get(id)?.color ?? "#2563eb"
    }))
    .sort((a, b) => b.value - a.value);
}

type ChannelKpi = { label: string; value: string };

function channelKpiConfig(channelId: string, totals: MetricTotals, count: number): ChannelKpi[] {
  if (channelId === "youtube") {
    const avgViews = count ? Math.round(totals.reach / count) : 0;
    const likeRate = totals.reach ? (totals.likes / totals.reach) * 100 : 0;
    const avgDuration = totals.analyticsCount ? totals.averageViewDurationSeconds / totals.analyticsCount : 0;
    const avgPercent = totals.analyticsCount ? totals.averageViewPercentage / totals.analyticsCount : 0;
    const avgCtr = totals.impressionCount ? totals.impressionClickThroughRate / totals.impressionCount : 0;
    return [
      { label: "Visualizações",       value: formatNumber(totals.reach) },
      { label: "Vídeos publicados",   value: formatNumber(count) },
      { label: "Média views/vídeo",   value: formatNumber(avgViews) },
      { label: "Tempo assistido",     value: `${formatNumber(Math.round(totals.watchTimeMinutes))} min` },
      { label: "Duração média",       value: formatDuration(avgDuration) },
      { label: "Retenção média",      value: formatPercent(avgPercent) },
      { label: "Impressões",          value: totals.impressions ? formatNumber(totals.impressions) : "—" },
      { label: "CTR impressões",      value: totals.impressionCount ? formatPercent(avgCtr) : "—" },
      { label: "Inscritos líquidos",  value: formatNumber(totals.subscribersGained - totals.subscribersLost) },
      { label: "Taxa de curtidas",    value: formatPercent(likeRate) },
    ];
  }
  return [
    { label: "Alcance",       value: formatNumber(totals.reach) },
    { label: "Engajamento",   value: formatNumber(totals.engagement) },
    { label: "Cliques",       value: formatNumber(totals.clicks) },
    { label: "Leads",         value: formatNumber(totals.leads) },
    { label: "Taxa engaj.",   value: formatPercent(totals.reach ? (totals.engagement / totals.reach) * 100 : 0) },
    { label: "Taxa conv.",    value: formatPercent(totals.clicks ? (totals.leads / totals.clicks) * 100 : 0) },
  ];
}

function deltaPercent(current: number, previous: number): { pct: number; positive: boolean } | null {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  return { pct: Math.abs(pct), positive: pct >= 0 };
}

const slug = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const todayIso = () => new Date().toISOString().slice(0, 10);

function addDaysIso(dateLike: string | undefined, days: number) {
  const date = dateLike ? new Date(dateLike) : new Date();
  if (Number.isNaN(date.getTime())) date.setTime(Date.now());
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function normalizeCommentPart(value: string | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function commentImportSignature(comment: Pick<Comment, "source" | "videoId" | "authorName" | "text" | "publishedAt">) {
  return [
    comment.source,
    comment.videoId ?? "",
    normalizeCommentPart(comment.authorName),
    normalizeCommentPart(comment.text),
    comment.publishedAt ?? ""
  ].join("|");
}

function commentStableKey(comment: Pick<Comment, "source" | "externalId" | "videoId" | "authorName" | "text" | "publishedAt">) {
  if (comment.externalId) return `${comment.source}:external:${comment.externalId}`;
  return `${comment.source}:signature:${commentImportSignature(comment)}`;
}

function mergeImportedComment(existing: Comment | undefined, incoming: Comment): Comment {
  if (!existing) return incoming;
  const addedToBank = existing.addedToBank || incoming.addedToBank;
  return {
    ...existing,
    source: incoming.source,
    externalId: existing.externalId ?? incoming.externalId,
    importSignature: existing.importSignature ?? incoming.importSignature,
    videoId: incoming.videoId ?? existing.videoId,
    videoTitle: incoming.videoTitle ?? existing.videoTitle,
    authorName: incoming.authorName || existing.authorName,
    text: incoming.text || existing.text,
    likes: incoming.likes,
    response: incoming.response ?? existing.response,
    status: existing.status === "respondido" && incoming.status !== "respondido" ? existing.status : incoming.status,
    addedToBank,
    bankQuestionId: existing.bankQuestionId ?? incoming.bankQuestionId,
    publishedAt: incoming.publishedAt ?? existing.publishedAt,
    retentionUntil: existing.retentionUntil ?? incoming.retentionUntil,
    processedAt: existing.processedAt ?? incoming.processedAt,
    isRelevant: existing.isRelevant ?? incoming.isRelevant ?? addedToBank,
    classificationStatus: existing.classificationStatus && existing.classificationStatus !== "pendente" ? existing.classificationStatus : incoming.classificationStatus,
    classificationReason: existing.classificationReason ?? incoming.classificationReason,
    createdAt: existing.createdAt
  };
}

function dateId(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function dateFromId(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function canSeeItem(user: Profile, createdBy: string, assignedTo: string[]) {
  return user.role !== "colaborador" || user.id === createdBy || assignedTo.includes(user.id);
}

function menusForArea(area: AppArea) {
  return area === "marketing" ? marketingMenu : salesMenu;
}

function profileAreaId(profileId: string, area: AppArea) {
  return `${profileId}:${area}`;
}

function profilePermissionId(profileId: string, area: AppArea, moduleId: string) {
  return `${profileId}:${area}:${moduleId}`;
}

function permissionFlag(action: (typeof moduleActions)[number]["key"]) {
  return `can${action.charAt(0).toUpperCase()}${action.slice(1)}` as keyof Pick<ProfileModulePermission, "canView" | "canCreate" | "canEdit" | "canDelete" | "canApprove" | "canManage">;
}

function roleDefaultPermission(profile: Profile, area: AppArea, moduleId: string, action: (typeof moduleActions)[number]["key"]) {
  if (profile.role === "admin") return true;
  if (area !== "marketing") return false;
  if (profile.role === "gestor") return true;
  const collaboratorModules = new Set(["painel", "calendario", "ideias", "tarefas", "campanhas", "metricas", "comentarios", "banco-duvidas", "configuracoes"]);
  return collaboratorModules.has(moduleId) && ["view", "create", "edit"].includes(action);
}

function hasAreaAccess(profile: Profile, area: AppArea, profileAreas: ProfileArea[], permissions: ProfileModulePermission[]) {
  if (!profile.id || !profile.active) return false;
  if (profile.role === "admin") return true;
  if (profileAreas.some((item) => item.profileId === profile.id && item.area === area && item.active)) return true;
  return permissions.some((item) => item.profileId === profile.id && item.area === area && item.canView);
}

function hasModulePermission(
  profile: Profile,
  area: AppArea,
  moduleId: string,
  action: (typeof moduleActions)[number]["key"],
  profileAreas: ProfileArea[],
  permissions: ProfileModulePermission[]
) {
  if (!hasAreaAccess(profile, area, profileAreas, permissions)) return false;
  if (profile.role === "admin") return true;
  const permission = permissions.find((item) => item.profileId === profile.id && item.area === area && item.moduleId === moduleId);
  if (permission) return Boolean(permission[permissionFlag(action)]);
  return roleDefaultPermission(profile, area, moduleId, action);
}

function allowedAreasForProfile(profile: Profile, profileAreas: ProfileArea[], permissions: ProfileModulePermission[]) {
  return appAreas.filter((area) => hasAreaAccess(profile, area.id, profileAreas, permissions)).map((area) => area.id);
}

function preferredSectionForArea(
  profile: Profile,
  area: AppArea,
  profileAreas: ProfileArea[],
  permissions: ProfileModulePermission[]
) {
  const preferredPanel = `${area}-painel`;
  const panelItem = menusForArea(area).find((item) => item.sectionId === preferredPanel);
  if (panelItem && hasModulePermission(profile, area, panelItem.moduleId, "view", profileAreas, permissions)) {
    return panelItem.sectionId;
  }
  return menusForArea(area).find((item) => hasModulePermission(profile, item.area, item.moduleId, "view", profileAreas, permissions))?.sectionId ?? `${area}-configuracoes`;
}

function defaultLandingForProfile(profile: Profile, profileAreas: ProfileArea[], permissions: ProfileModulePermission[]) {
  const allowedAreas = allowedAreasForProfile(profile, profileAreas, permissions);
  if (allowedAreas.includes("marketing")) {
    return { area: "marketing" as const, sectionId: preferredSectionForArea(profile, "marketing", profileAreas, permissions) };
  }
  const area = allowedAreas[0] ?? "marketing";
  return { area, sectionId: preferredSectionForArea(profile, area, profileAreas, permissions) };
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function formatDateOnly(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(value);
}

function toDateTimeLocalValue(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    oscillator.type = "sine";
    gain.gain.value = 0.05;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
  } catch {
    // Navegadores podem bloquear áudio até alguma interação do usuário.
  }
}

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  // Em dev: começa false (sem spinner) para evitar travamento do bypass local
  // Em produção: começa true (mostra spinner) para evitar flash da tela de login
  const [initializing, setInitializing] = useState(process.env.NODE_ENV !== "development");
  const [realtimeSyncing, setRealtimeSyncing] = useState(false);
  const [activeArea, setActiveArea] = useState<AppArea>("marketing");
  const [activeSection, setActiveSection] = useState("marketing-painel");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileAreas, setProfileAreas] = useState<ProfileArea[]>(seedProfileAreas);
  const [profileModulePermissions, setProfileModulePermissions] = useState<ProfileModulePermission[]>(seedProfileModulePermissions);
  const [currentUserId, setCurrentUserId] = useState("");
  const [sessionUserId, setSessionUserId] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [funnelStages, setFunnelStages] = useState<FunnelStage[]>([]);
  const [taskBoards, setTaskBoards] = useState<TaskBoard[]>([]);
  const [activeTaskBoardId, setActiveTaskBoardId] = useState("");
  const [taskColumns, setTaskColumns] = useState<TaskColumn[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignAudiences, setCampaignAudiences] = useState<CampaignAudience[]>([]);
  const [postTemplates, setPostTemplates] = useState<PostTemplate[]>([]);
  const [posts, setPosts] = useState<EditorialPost[]>([]);
  const [postReviewAssets, setPostReviewAssets] = useState<PostReviewAsset[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [calendarDates, setCalendarDates] = useState<CalendarDate[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [metrics, setMetrics] = useState<PostMetric[]>([]);
  const [customerQuestions, setCustomerQuestions] = useState<CustomerQuestion[]>([]);
  const [ytComments, setYtComments] = useState<Comment[]>([]);
  const [autoFilters, setAutoFilters] = useState<AutoFilter[]>([]);
  const [salesClients, setSalesClients] = useState<SalesClient[]>([]);
  const [salesFunnelStages, setSalesFunnelStages] = useState<SalesFunnelStage[]>([]);
  const [callSchedules, setCallSchedules] = useState<CallSchedule[]>([]);
  const [salesClientFilter, setSalesClientFilter] = useState<"todos" | SalesClientStatus>("todos");
  const [salesClientSearch, setSalesClientSearch] = useState("");
  const [salesCallFilter, setSalesCallFilter] = useState<"all" | "today" | "overdue">("all");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [pendingSignupEmail, setPendingSignupEmail] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<MediaPreviewItem | null>(null);
  const [calendarMode, setCalendarMode] = useState<"Semana" | "Mês" | "Ano">("Mês");
  const [visibleMonth, setVisibleMonth] = useState(new Date());
  const [marketingConfigTab, setMarketingConfigTab] = useState<ConfigTab>("Equipe");
  const [salesConfigTab, setSalesConfigTab] = useState<ConfigTab>("Equipe");
  const [ideasView, setIdeasView] = useState<"Quadro" | "Lista">("Quadro");
  const [ideasTab, setIdeasTab] = useState<"Todos" | "Estatísticas" | Idea["type"]>("Todos");
  const realtimeReloading = useRef(false);
  const pendingSaveCount = useRef(0);
  const realtimeReloadTimer = useRef<number | null>(null);
  const remoteReady = useRef(false);
  const lastLocalSaveAt = useRef(0);
  const initialLandingAppliedFor = useRef("");

  const emptyUser: Profile = { id: "", organizationId: "", role: "colaborador", name: "", email: "", phone: "", bio: "", active: false, notificationSound: false, avatarUrl: "" };
  const currentUser = profiles.find((profile) => profile.id === currentUserId)
    ?? profiles.find((profile) => profile.id === sessionUserId)
    ?? (!isSupabaseConfigured ? profiles[0] : undefined)
    ?? emptyUser;
  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const channelById = useMemo(() => new Map(channels.map((channel) => [channel.id, channel])), [channels]);
  const lineById = useMemo(() => new Map(productLines.map((line) => [line.id, line])), [productLines]);
  const vehicleTypeById = useMemo(() => new Map(vehicleTypes.map((item) => [item.id, item])), [vehicleTypes]);
  const contentTypeById = useMemo(() => new Map(contentTypes.map((item) => [item.id, item])), [contentTypes]);
  const funnelById = useMemo(() => new Map(funnelStages.map((stage) => [stage.id, stage])), [funnelStages]);
  const campaignById = useMemo(() => new Map(campaigns.map((campaign) => [campaign.id, campaign])), [campaigns]);
  const columnById = useMemo(() => new Map(taskColumns.map((column) => [column.id, column])), [taskColumns]);
  const primaryTaskBoardId = useMemo(
    () =>
      taskBoards.find((board) => board.id === "tarefas")?.id ??
      taskBoards.find((board) => normalizeText(board.name) === "tarefas")?.id ??
      "tarefas",
    [taskBoards]
  );

  useEffect(() => {
    if (!taskBoards.length) return;
    const exists = taskBoards.some((b) => b.id === activeTaskBoardId);
    if (!exists && activeTaskBoardId !== calendarTaskBoardId) {
      const isVendasSection = activeSection.startsWith("vendas-");
      if (isVendasSection) {
        const firstVendasBoard = taskBoards.find((b) => b.id.startsWith("vendas-"));
        setActiveTaskBoardId(firstVendasBoard?.id ?? primaryTaskBoardId);
      } else {
        setActiveTaskBoardId(primaryTaskBoardId);
      }
    }
  }, [taskBoards, primaryTaskBoardId, activeTaskBoardId, activeSection]);
  const allowedAreas = useMemo(() => allowedAreasForProfile(currentUser, profileAreas, profileModulePermissions), [currentUser, profileAreas, profileModulePermissions]);
  const activeConfigTab = activeArea === "marketing" ? marketingConfigTab : salesConfigTab;
  const setActiveConfigTab = activeArea === "marketing" ? setMarketingConfigTab : setSalesConfigTab;
  const visibleMenu = useMemo(
    () => menusForArea(activeArea).filter((item) => hasModulePermission(currentUser, item.area, item.moduleId, "view", profileAreas, profileModulePermissions)),
    [activeArea, currentUser, profileAreas, profileModulePermissions]
  );
  const canReviewAssets = hasModulePermission(currentUser, "marketing", "revisoes", "approve", profileAreas, profileModulePermissions);
  const canManageTeam = hasModulePermission(currentUser, activeArea, "configuracoes", "manage", profileAreas, profileModulePermissions);
  const userHasNoTeam = loggedIn && currentUser.active && currentUser.role !== "admin" && allowedAreas.length === 0;
  const pendingReviewAssets = postReviewAssets.filter((asset) => asset.status === "Aguardando revisão");
  const pendingApprovalsCount = canManageTeam ? profiles.filter((p) => !p.active).length : 0;

  const visiblePosts = posts.filter((post) => canSeeItem(currentUser, post.createdBy, post.assignedTo));
  const visibleTasks = tasks.filter((task) => canSeeItem(currentUser, task.createdBy, task.assignedTo) && !task.parentTaskId);
  const visibleIdeas = ideas.filter((idea) => currentUser.role !== "colaborador" || idea.createdBy === currentUser.id);
  const visibleCampaigns = campaigns.filter((campaign) => canSeeItem(currentUser, campaign.createdBy, campaign.assignedTo));
  const today = todayIso();
  const derivedTaskNotifications = useMemo(
    () =>
      visibleTasks
        .filter((task) => task.assignedTo.includes(currentUser.id))
        .map((task): Notification => ({
          id: `task-assigned:${task.id}:${currentUser.id}`,
          userId: currentUser.id,
          title: "Tarefa atribuída",
          description: task.title,
          createdAt: task.dueDate ? `${task.dueDate}T12:00:00` : new Date().toISOString(),
          read: false,
          targetKind: "task",
          targetId: task.id
        })),
    [visibleTasks, currentUser.id]
  );
  const derivedPostNotifications = useMemo(
    () =>
      visiblePosts
        .filter((post) => post.assignedTo.includes(currentUser.id))
        .map((post): Notification => ({
          id: `post-assigned:${post.id}:${currentUser.id}`,
          userId: currentUser.id,
          title: "Post atribuído",
          description: post.title,
          createdAt: post.publishAt || new Date().toISOString(),
          read: false,
          targetKind: "post",
          targetId: post.id
        })),
    [visiblePosts, currentUser.id]
  );
  const derivedCampaignNotifications = useMemo(
    () =>
      visibleCampaigns
        .filter((campaign) => campaign.assignedTo.includes(currentUser.id))
        .map((campaign): Notification => ({
          id: `campaign-assigned:${campaign.id}:${currentUser.id}`,
          userId: currentUser.id,
          title: "Campanha atribuída",
          description: campaign.name,
          createdAt: campaign.startDate ? `${campaign.startDate}T09:00:00` : new Date().toISOString(),
          read: false,
          targetKind: "campaign",
          targetId: campaign.id
        })),
    [visibleCampaigns, currentUser.id]
  );
  const derivedDeadlineNotifications = useMemo(
    () =>
      visibleTasks
        .filter((task) => task.assignedTo.includes(currentUser.id) && task.dueDate && !columnById.get(task.columnId)?.name.toLowerCase().includes("conclu"))
        .filter((task) => {
          const diffDays = Math.ceil((new Date(`${task.dueDate}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86400000);
          return diffDays <= 1;
        })
        .map((task): Notification => {
          const overdue = task.dueDate < today;
          return {
            id: `task-deadline:${task.id}:${currentUser.id}:${task.dueDate}`,
            userId: currentUser.id,
            title: overdue ? "Tarefa vencida" : "Tarefa próxima do prazo",
            description: task.title,
            createdAt: `${task.dueDate}T08:00:00`,
            read: false,
            targetKind: "task",
            targetId: task.id
          };
        }),
    [visibleTasks, columnById, currentUser.id, today]
  );
  const derivedCalendarNotifications = useMemo(
    () =>
      visiblePosts
        .filter((post) => post.publishAt?.slice(0, 10) === today)
        .map((post): Notification => ({
          id: `post-today:${post.id}:${currentUser.id}:${today}`,
          userId: currentUser.id,
          title: "Post agendado para hoje",
          description: post.title,
          createdAt: post.publishAt,
          read: false,
          targetKind: "calendar",
          targetId: post.id
        })),
    [visiblePosts, currentUser.id, today]
  );
  const currentNotifications = useMemo(() => {
    const merged = new Map<string, Notification>();
    const derived = [
      ...derivedTaskNotifications,
      ...derivedPostNotifications,
      ...derivedCampaignNotifications,
      ...derivedDeadlineNotifications,
      ...derivedCalendarNotifications
    ];
    for (const item of derived) merged.set(item.id, item);
    for (const item of notifications.filter((notification) => notification.userId === currentUser.id)) {
      merged.set(item.id, item);
    }
    return Array.from(merged.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications, derivedTaskNotifications, derivedPostNotifications, derivedCampaignNotifications, derivedDeadlineNotifications, derivedCalendarNotifications, currentUser.id]);
  const seenNotificationIds = useRef<Set<string>>(new Set());
  const recentQuickTaskSignature = useRef<{ signature: string; at: number } | null>(null);
  const recentSubtaskSignature = useRef<{ signature: string; at: number } | null>(null);

  useEffect(() => {
    if (!loggedIn) {
      initialLandingAppliedFor.current = "";
      return;
    }
    if (userHasNoTeam || !currentUser.id || !currentUser.active) return;
    const landingKey = `${currentUser.id}:${allowedAreas.join("|")}`;
    if (initialLandingAppliedFor.current === landingKey) return;
    const landing = defaultLandingForProfile(currentUser, profileAreas, profileModulePermissions);
    setActiveArea(landing.area);
    setActiveSection(landing.sectionId);
    initialLandingAppliedFor.current = landingKey;
  }, [loggedIn, userHasNoTeam, currentUser, allowedAreas, profileAreas, profileModulePermissions]);

  useEffect(() => {
    const unreadIds = currentNotifications.filter((item) => !item.read).map((item) => item.id);
    const fresh = unreadIds.some((id) => !seenNotificationIds.current.has(id));
    if (seenNotificationIds.current.size && fresh && currentUser.notificationSound) {
      playNotificationSound();
    }
    seenNotificationIds.current = new Set(unreadIds);
  }, [currentNotifications, currentUser.notificationSound]);

  useEffect(() => {
    if (!loggedIn || userHasNoTeam) return;
    const nextArea = allowedAreas.includes(activeArea) ? activeArea : allowedAreas[0] ?? "marketing";
    if (nextArea !== activeArea) {
      setActiveArea(nextArea);
      setActiveSection(preferredSectionForArea(currentUser, nextArea, profileAreas, profileModulePermissions));
      return;
    }
    const currentItem = menu.find((item) => item.sectionId === activeSection);
    const allowedItem = currentItem && currentItem.area === activeArea && hasModulePermission(currentUser, currentItem.area, currentItem.moduleId, "view", profileAreas, profileModulePermissions);
    if (!allowedItem) {
      setActiveSection(preferredSectionForArea(currentUser, activeArea, profileAreas, profileModulePermissions));
    }
  }, [loggedIn, userHasNoTeam, allowedAreas, activeArea, activeSection, currentUser, profileAreas, profileModulePermissions, visibleMenu]);

  function openSection(sectionId: string) {
    const item = menu.find((entry) => entry.sectionId === sectionId || entry.moduleId === sectionId);
    if (!item) return;
    setActiveArea(item.area);
    setActiveSection(item.sectionId);
    if (item.moduleId === "tarefas") setActiveTaskBoardId(primaryTaskBoardId);
    if (item.moduleId === "atividades" && item.area === "vendas") setActiveTaskBoardId("vendas-atividades");
    if (item.moduleId === "metas" && item.area === "vendas") setActiveTaskBoardId("vendas-metas");
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("embrepoli-marketing:v1");
    }
  }, []);

  function scheduleRealtimeReload() {
    if (typeof window === "undefined") return;
    if (realtimeReloadTimer.current) window.clearTimeout(realtimeReloadTimer.current);
    realtimeReloadTimer.current = window.setTimeout(() => {
      if (pendingSaveCount.current > 0) {
        scheduleRealtimeReload();
        return;
      }
      void reloadFromSupabase();
    }, 500);
  }

  async function reloadFromSupabase() {
    if (!supabase || !isSupabaseConfigured) return;
    if (pendingSaveCount.current > 0) {
      scheduleRealtimeReload();
      return;
    }
    realtimeReloading.current = true;
    setRealtimeSyncing(true);
    const data = await loadAppData(supabase);
    if (pendingSaveCount.current > 0) {
      realtimeReloading.current = false;
      setRealtimeSyncing(false);
      scheduleRealtimeReload();
      return;
    }
    setProfiles(data.profiles);
    setProfileAreas(data.profileAreas);
    setProfileModulePermissions(data.profileModulePermissions);
    setChannels(data.channels);
    setProductLines(data.productLines);
    setVehicleTypes(data.vehicleTypes);
    setContentTypes(data.contentTypes);
    setFunnelStages(data.funnelStages);
    setTaskBoards(data.taskBoards);
    setTaskColumns(data.taskColumns);
    setCampaigns(data.campaigns);
    setCampaignAudiences(data.campaignAudiences);
    setPostTemplates(data.postTemplates);
    setPosts(data.posts);
    setPostReviewAssets(data.postReviewAssets);
    setIdeas(data.ideas);
    setCalendarDates(data.calendarDates);
    setTasks(data.tasks);
    setMetrics(data.metrics);
    setCustomerQuestions(data.customerQuestions);
    setYtComments(data.ytComments);
    setAutoFilters(data.autoFilters);
    setSalesClients(data.salesClients);
    setSalesFunnelStages(data.salesFunnelStages);
    setCallSchedules(data.callSchedules);
    setNotifications(data.notifications);
    const { data: authData } = await supabase.auth.getUser();
    const authUserId = authData.user?.id ?? sessionUserId;
    if (authUserId) {
      setSessionUserId(authUserId);
      const current = data.profiles.find((profile) => profile.id === authUserId);
      setCurrentUserId(current?.id ?? authUserId);
    }
    remoteReady.current = true;
    // Seed default sales funnel stages if none exist
    if (data.salesFunnelStages.length === 0) {
      syncSalesFunnelStages(DEFAULT_SALES_FUNNEL_STAGES);
    }
    setRealtimeSyncing(false);
    window.setTimeout(() => {
      realtimeReloading.current = false;
    }, 0);
  }

  useEffect(() => {
    if (!loggedIn || !supabase || !isSupabaseConfigured) return;
    void reloadFromSupabase();
    const orgId = currentUser.organizationId;
    const tables = [
      "profiles",
      "profile_areas",
      "profile_module_permissions",
      "channels",
      "product_lines",
      "vehicle_types",
      "content_types",
      "funnel_stages",
      "task_boards",
      "task_columns",
      "campaigns",
      "campaign_audiences",
      "post_templates",
      "campaign_assignees",
      "posts",
      "post_assignees",
      "post_review_assets",
      "post_review_comments",
      "ideas",
      "idea_attachments",
      "calendar_dates",
      "tasks",
      "task_assignees",
      "task_checklist_items",
      "task_comments",
      "task_attachments",
      "post_metrics",
      "notifications",
      "comments",
      "auto_filters"
    ];
    const channel = supabase.channel("embrepoli-marketing-realtime");
    tables.forEach((table) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          ...(orgId ? { filter: `organization_id=eq.${orgId}` } : {})
        },
        () => {
          // Anti-eco: ignorar eventos disparados pelo próprio save recente
          if (Date.now() - lastLocalSaveAt.current < 2000) return;
          scheduleRealtimeReload();
        }
      );
    });
    channel.subscribe();
    // Fallback: reload periódico a cada 60s caso eventos WebSocket sejam perdidos
    const fallbackInterval = window.setInterval(() => {
      scheduleRealtimeReload();
    }, 60_000);
    return () => {
      if (realtimeReloadTimer.current) window.clearTimeout(realtimeReloadTimer.current);
      window.clearInterval(fallbackInterval);
      void supabase?.removeChannel(channel);
    };
  }, [loggedIn]);

  async function persistArrayChanges<T extends { id: string }>(
    previous: T[],
    next: T[],
    save: (item: T, previousItem?: T) => Promise<void>,
    remove: (id: string, previousItem: T) => Promise<void>
  ) {
    const previousById = new Map(previous.map((item) => [item.id, item]));
    const nextById = new Map(next.map((item) => [item.id, item]));
    const deletedItems = previous.filter((item) => !nextById.has(item.id));
    const changedItems = next.filter((item) => JSON.stringify(item) !== JSON.stringify(previousById.get(item.id)));
    await Promise.all([
      ...deletedItems.map((item) => remove(item.id, item)),
      ...changedItems.map((item) => save(item, previousById.get(item.id)))
    ]);
  }

  function syncState<K extends keyof AppData>(key: K, setter: Dispatch<SetStateAction<AppData[K]>>, persist: (previous: AppData[K], next: AppData[K]) => Promise<void>) {
    return (action: SetStateAction<AppData[K]>) => {
      setter((current) => {
        const next = typeof action === "function" ? (action as (value: AppData[K]) => AppData[K])(current) : action as AppData[K];
        if (supabase && isSupabaseConfigured && remoteReady.current) {
          setSaveStatus("saving");
          setSaveError("");
          pendingSaveCount.current += 1;
          void persist(current, next)
            .then(() => setSaveStatus("saved"))
            .catch((error) => {
              console.error(`Erro ao salvar ${String(key)} no Supabase`, error);
              setSaveStatus("error");
              setSaveError(friendlySaveError(error));
              scheduleRealtimeReload();
            })
            .finally(() => {
              lastLocalSaveAt.current = Date.now();
              pendingSaveCount.current = Math.max(0, pendingSaveCount.current - 1);
            });
        }
        return next;
      });
    };
  }

  function friendlySaveError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (/column .* does not exist|schema cache|could not find .*column|relationship .* does not exist/i.test(message)) {
      return "Erro ao salvar: o banco precisa ser atualizado. Rode a migração do Supabase e tente novamente.";
    }
    if (/row-level security|violates row-level security|permission denied/i.test(message)) {
      return "Erro ao salvar: sua conta não tem permissão para esta ação ou as políticas do Supabase precisam ser ajustadas.";
    }
    if (/foreign key|violates .*constraint/i.test(message)) {
      return "Erro ao salvar: algum vínculo selecionado não existe mais. Recarregue a página e tente novamente.";
    }
    return "Erro ao salvar. Verifique a conexão e tente novamente.";
  }

  const syncProfiles = syncState("profiles", setProfiles, (previous, next) => persistArrayChanges(previous, next, (item) => saveProfile(supabase!, item), (id) => deleteProfile(supabase!, id)));
  const syncProfileAreas = syncState("profileAreas", setProfileAreas, (previous, next) => persistArrayChanges(previous, next, (item) => saveProfileArea(supabase!, item), (id) => deleteProfileArea(supabase!, id)));
  const syncProfileModulePermissions = syncState("profileModulePermissions", setProfileModulePermissions, (previous, next) => persistArrayChanges(previous, next, (item) => saveProfileModulePermission(supabase!, item), (id) => deleteProfileModulePermission(supabase!, id)));
  const syncChannels = syncState("channels", setChannels, (previous, next) => persistArrayChanges(previous, next, (item) => saveChannel(supabase!, item), (id) => deleteChannel(supabase!, id)));
  const syncProductLines = syncState("productLines", setProductLines, (previous, next) => persistArrayChanges(previous, next, (item) => saveProductLine(supabase!, item), (id) => deleteProductLine(supabase!, id)));
  const syncVehicleTypes = syncState("vehicleTypes", setVehicleTypes, (previous, next) => persistArrayChanges(previous, next, (item) => saveVehicleType(supabase!, item), (id) => deleteVehicleType(supabase!, id)));
  const syncContentTypes = syncState("contentTypes", setContentTypes, (previous, next) => persistArrayChanges(previous, next, (item) => saveContentType(supabase!, item), (id) => deleteContentType(supabase!, id)));
  const syncFunnelStages = syncState("funnelStages", setFunnelStages, (previous, next) => persistArrayChanges(previous, next, (item) => saveFunnelStage(supabase!, item), (id) => deleteFunnelStage(supabase!, id)));
  const syncTaskBoards = syncState("taskBoards", setTaskBoards, (previous, next) => persistArrayChanges(previous, next, (item) => saveTaskBoard(supabase!, item), (id) => deleteTaskBoard(supabase!, id)));
  const syncTaskColumns = syncState("taskColumns", setTaskColumns, (previous, next) => persistArrayChanges(previous, next, (item) => saveTaskColumn(supabase!, item), (id) => deleteTaskColumn(supabase!, id)));
  const syncCampaigns = syncState("campaigns", setCampaigns, (previous, next) => persistArrayChanges(previous, next, (item) => saveCampaign(supabase!, item), (id) => deleteCampaign(supabase!, id)));
  const syncCampaignAudiences = syncState("campaignAudiences", setCampaignAudiences, (previous, next) => persistArrayChanges(previous, next, (item) => saveCampaignAudience(supabase!, item), (id) => deleteCampaignAudience(supabase!, id)));
  const syncPostTemplates = syncState("postTemplates", setPostTemplates, (previous, next) => persistArrayChanges(previous, next, (item) => savePostTemplate(supabase!, item), (id) => deletePostTemplate(supabase!, id)));
  const syncPosts = syncState("posts", setPosts, (previous, next) => persistArrayChanges(previous, next, (item) => savePost(supabase!, item), (id) => deletePost(supabase!, id)));
  const syncPostReviewAssets = syncState("postReviewAssets", setPostReviewAssets, (previous, next) => persistArrayChanges(previous, next, (item) => savePostReviewAsset(supabase!, item), (id) => deletePostReviewAssetRecord(supabase!, id)));
  const syncIdeas = syncState("ideas", setIdeas, (previous, next) => persistArrayChanges(previous, next, (item) => saveIdea(supabase!, item), (id) => deleteIdea(supabase!, id)));
  const syncCalendarDates = syncState("calendarDates", setCalendarDates, (previous, next) => persistArrayChanges(previous, next, (item) => saveCalendarDate(supabase!, item), (id) => deleteCalendarDate(supabase!, id)));
  const syncTasks = syncState("tasks", setTasks, (previous, next) => persistArrayChanges(previous, next, (item) => saveTask(supabase!, item), (id) => deleteTask(supabase!, id)));
  const syncMetrics = syncState("metrics", setMetrics, (previous, next) => persistArrayChanges(previous, next, (item) => saveMetric(supabase!, item), (id) => deleteMetric(supabase!, id)));
  const syncNotifications = syncState("notifications", setNotifications, (previous, next) => persistArrayChanges(previous, next, (item) => saveNotification(supabase!, item), (id) => deleteNotification(supabase!, id)));
  const syncSalesClients = syncState("salesClients", setSalesClients, (previous, next) => persistArrayChanges(previous, next, (item) => saveSalesClient(supabase!, item), (id) => deleteSalesClient(supabase!, id)));
  const syncSalesFunnelStages = syncState("salesFunnelStages", setSalesFunnelStages, (previous, next) => persistArrayChanges(previous, next, (item) => saveSalesFunnelStage(supabase!, item), (id) => deleteSalesFunnelStage(supabase!, id)));
  const syncCallSchedules = syncState("callSchedules", setCallSchedules, (previous, next) => persistArrayChanges(previous, next, (item) => saveCallSchedule(supabase!, item), (id) => deleteCallSchedule(supabase!, id)));

  async function loadCurrentSession() {
    console.log("[auth] loadCurrentSession: start");
    if (!supabase || !isSupabaseConfigured) {
      console.warn("[auth] supabase not configured — abort", { hasSupabase: !!supabase, isSupabaseConfigured });
      setInitializing(false);
      return;
    }
    try {
      const recoveryUrl = `${window.location.search}${window.location.hash}`;
      if (recoveryUrl.includes("type=recovery")) {
        console.log("[auth] recovery URL detected — switching to reset mode");
        setAuthMode("reset");
        return;
      }

      let { data } = await supabase.auth.getSession();
      console.log("[auth] existing session?", !!data.session?.user);

      // ── Dev bypass: auto-login no localhost sem mostrar a tela de login ──
      if (!data.session?.user && process.env.NODE_ENV === "development") {
        console.log("[auth] dev bypass: requesting /api/dev-login");
        try {
          const res = await fetch("/api/dev-login", { method: "POST" });
          console.log("[auth] /api/dev-login status:", res.status);
          if (res.ok) {
            const tokens = await res.json() as { access_token: string; refresh_token: string };
            const { data: sessionData, error: setErr } = await supabase.auth.setSession(tokens);
            console.log("[auth] setSession result:", { error: setErr?.message, hasSession: !!sessionData.session });
            data = { session: sessionData.session };
          } else {
            const errBody = await res.text();
            console.error("[auth] dev bypass failed:", errBody);
          }
        } catch (err) {
          console.error("[auth] dev bypass exception:", err);
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      if (!data.session?.user) {
        console.warn("[auth] no session after bypass — staying on login screen");
        setSessionUserId("");
        setCurrentUserId("");
        return;
      }
      setSessionUserId(data.session.user.id);
      console.log("[auth] fetching profile…");
      const profile = await ensureCurrentProfile(supabase);
      console.log("[auth] profile:", profile);
      if (!profile) {
        console.error("[auth] ensureCurrentProfile returned null — provavelmente problema de RLS na tabela profiles");
        if (process.env.NODE_ENV === "development") {
          console.warn("[auth] DEV: entrando sem profile válido — verifique RLS da tabela profiles");
          setAuthError("DEV: profile não encontrado, mas entrando mesmo assim. Veja console.");
          setLoggedIn(true);
          setAuthMode("login");
        } else {
          setAuthError("Não foi possível carregar o perfil. Veja o console para detalhes.");
        }
        return;
      }
      setCurrentUserId(profile.id);
      if (profile.active) {
        console.log("[auth] profile active — entering app");
        setLoggedIn(true);
        setAuthMode("login");
      } else {
        console.log("[auth] profile inactive — pending approval");
        setLoggedIn(false);
        setAuthMode("pending");
        setAuthMessage("Email confirmado! ✓ Agora um Gestor ou Administrador precisa liberar seu acesso.");
        void notifyManagersOfPendingSignup(profile);
      }
    } finally {
      setInitializing(false);
    }
  }

  async function notifyManagersOfPendingSignup(profile: Profile) {
    if (!supabase) return;
    const flagKey = `signup_notified_${profile.id}`;
    if (typeof window !== "undefined" && localStorage.getItem(flagKey)) {
      console.log("[auth] signup notification already sent — skip");
      return;
    }
    try {
      // Busca o organization_id do próprio profile (não vem no tipo Profile)
      const { data: ownRow, error: ownErr } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", profile.id)
        .maybeSingle();
      if (ownErr || !ownRow?.organization_id) {
        console.error("[auth] could not fetch own organization_id:", ownErr?.message);
        return;
      }
      const organizationId = ownRow.organization_id as string;

      const { data: managers, error: queryErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("organization_id", organizationId)
        .in("role", ["admin", "gestor"])
        .eq("active", true);
      if (queryErr) {
        console.error("[auth] could not fetch managers:", queryErr.message);
        return;
      }
      if (!managers || managers.length === 0) {
        console.warn("[auth] no active managers found — nobody to notify");
        return;
      }
      const now = new Date().toISOString();
      const rows = managers.map((m: { id: string }) => ({
        id: crypto.randomUUID(),
        organization_id: organizationId,
        user_id: m.id,
        title: "Novo cadastro aguardando aprovação",
        description: `${profile.name} (${profile.email}) criou uma conta e precisa ser aprovado em Configurações → Equipe.`,
        created_at: now,
        read: false,
        target_kind: "system",
        target_id: profile.id
      }));
      const { error: insertErr } = await supabase.from("notifications").insert(rows);
      if (insertErr) {
        console.error("[auth] failed to insert notifications:", insertErr.message);
        return;
      }
      if (typeof window !== "undefined") localStorage.setItem(flagKey, "1");
      console.log(`[auth] notified ${managers.length} manager(s) about signup`);
    } catch (err) {
      console.error("[auth] notifyManagersOfPendingSignup exception:", err);
    }
  }

  useEffect(() => {
    // ── Porta de emergência: ?reset=1 limpa todos os tokens Supabase do localStorage ──
    if (
      typeof window !== "undefined" &&
      process.env.NODE_ENV === "development" &&
      window.location.search.includes("reset=1")
    ) {
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("sb-") || k.toLowerCase().includes("supabase"))
          .forEach((k) => localStorage.removeItem(k));
        console.log("[auth] localStorage limpo via ?reset=1");
        window.history.replaceState({}, "", "/");
      } catch (err) {
        console.error("[auth] falha ao limpar localStorage:", err);
      }
    }
    // Fallback: garante que o spinner nunca trava indefinidamente
    const fallbackTimer = setTimeout(() => {
      console.warn("[auth] fallback timer: forçando fim do initializing após 6s");
      setInitializing(false);
    }, 6000);
    void loadCurrentSession().finally(() => clearTimeout(fallbackTimer));
    if (!supabase || !isSupabaseConfigured) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[auth] onAuthStateChange:", event, "hasSession:", !!session?.user);
      if (event === "PASSWORD_RECOVERY") {
        setLoggedIn(false);
        setAuthMode("reset");
        setAuthMessage("Digite sua nova senha para concluir a recuperação.");
      }
      if (event === "SIGNED_OUT") {
        setSessionUserId("");
        setCurrentUserId("");
        setLoggedIn(false);
      }
      // Quando user volta da confirmação de email, dispara reload de sessão
      if (event === "SIGNED_IN" && session?.user) {
        void loadCurrentSession();
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function handleLogin(email: string, password: string) {
    setAuthLoading(true);
    setAuthError("");
    setAuthMessage("");
    if (supabase && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data.user) {
          setAuthError(error?.message === "Email not confirmed"
            ? "Email ainda não confirmado. Verifique sua caixa de entrada."
            : "Email ou senha incorretos. Verifique os dados e tente novamente.");
          setAuthLoading(false);
          return;
        }
        setSessionUserId(data.user.id);
        const profile = await ensureCurrentProfile(supabase);
        if (!profile?.active) {
          setCurrentUserId(profile?.id ?? data.user.id);
          setAuthMode("pending");
          setAuthMessage("Sua conta está aguardando aprovação de um Gestor ou Administrador.");
          if (profile) void notifyManagersOfPendingSignup(profile);
          setAuthLoading(false);
          return;
        }
        setCurrentUserId(profile.id);
        setAuthLoading(false);
        setAuthMode("login");
        setLoggedIn(true);
      } catch (err) {
        setAuthError(`Erro ao conectar: ${err instanceof Error ? err.message : "tente novamente."}`);
        setAuthLoading(false);
      }
      return;
    }

    const fallback = profiles.find((profile) => profile.email.toLowerCase() === email.toLowerCase());
    if (fallback) {
      setSessionUserId(fallback.id);
      setCurrentUserId(fallback.id);
      setAuthLoading(false);
      setLoggedIn(true);
      return;
    }
    setAuthError("Conta não encontrada no modo local de demonstração.");
    setAuthLoading(false);
  }

  async function handleSignup(name: string, email: string, password: string) {
    setAuthLoading(true);
    setAuthError("");
    setAuthMessage("");
    if (supabase && isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: authRedirectUrl()
        }
      });
      if (error) {
        setAuthError(error.message.includes("already") ? "Este email já está cadastrado. Tente entrar ou recuperar a senha." : error.message);
        setAuthLoading(false);
        return;
      }
      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          organization_id: "00000000-0000-0000-0000-000000000001",
          name,
          email,
          phone: "",
          bio: "",
          role: "colaborador",
          avatar_url: "",
          active: false,
          notification_sound: true
        });
      }
      setPendingSignupEmail(email);
      setAuthMode("checkEmail");
      setAuthMessage("");
      setAuthLoading(false);
      return;
    }

    setProfiles((current) => [{ id: crypto.randomUUID(), organizationId: current[0]?.organizationId ?? "", name, email, phone: "", bio: "", role: "colaborador", avatarUrl: "", active: false, notificationSound: true }, ...current]);
    setPendingSignupEmail(email);
    setAuthMode("checkEmail");
    setAuthMessage("");
    setAuthLoading(false);
  }

  async function handleResendConfirmation() {
    if (!pendingSignupEmail) return;
    setAuthLoading(true);
    setAuthError("");
    setAuthMessage("");
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingSignupEmail,
        options: { emailRedirectTo: authRedirectUrl() }
      });
      if (error) {
        setAuthError(`Não foi possível reenviar: ${error.message}`);
        setAuthLoading(false);
        return;
      }
      setAuthMessage("Email de confirmação reenviado. Verifique sua caixa de entrada e spam.");
      setAuthLoading(false);
      return;
    }
    setAuthMessage("No modo local não há email para reenviar.");
    setAuthLoading(false);
  }

  async function handleForgotPassword(email: string) {
    setAuthLoading(true);
    setAuthError("");
    setAuthMessage("");
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: authRedirectUrl()
      });
      if (error) {
        setAuthError("Não foi possível enviar o email de recuperação. Verifique o endereço informado.");
        setAuthLoading(false);
        return;
      }
      setAuthMessage("Enviamos um link de recuperação de senha para seu email.");
      setAuthLoading(false);
      return;
    }
    setAuthMessage("No modo local, a recuperação de senha fica disponível quando o Supabase estiver configurado.");
    setAuthLoading(false);
  }

  async function sendPasswordResetForProfile(profile: Profile) {
    if (!profile.email.trim()) throw new Error("Este membro não tem email cadastrado.");
    if (!supabase || !isSupabaseConfigured) throw new Error("Redefinição disponível apenas com Supabase configurado.");
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: authRedirectUrl()
    });
    if (error) {
      if (/rate limit|too many|exceeded/i.test(error.message)) {
        throw new Error("Limite de envio de emails atingido. Aguarde alguns minutos e tente novamente.");
      }
      throw new Error("Não foi possível enviar o email de redefinição. Verifique o email do membro e tente novamente.");
    }
  }

  async function handleResetPassword(password: string) {
    setAuthLoading(true);
    setAuthError("");
    setAuthMessage("");
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setAuthError("Não foi possível redefinir a senha. Abra novamente o link de recuperação.");
        setAuthLoading(false);
        return;
      }
      setAuthMode("login");
      setAuthMessage("Senha redefinida. Entre novamente com a nova senha.");
      window.history.replaceState({}, document.title, window.location.pathname);
      await supabase.auth.signOut();
      setAuthLoading(false);
      return;
    }
    setAuthMode("login");
    setAuthMessage("Senha redefinida no modo local.");
    setAuthLoading(false);
  }

  async function handleLogout() {
    if (supabase && isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setSessionUserId("");
    setCurrentUserId("");
    setLoggedIn(false);
    setProfileOpen(false);
    setAuthMode("login");
  }

  async function handleRetryApproval() {
    setAuthLoading(true);
    setAuthError("");
    await loadCurrentSession();
    setAuthLoading(false);
  }

  function changeAuthMode(mode: AuthMode) {
    setAuthMode(mode);
    setAuthError("");
    setAuthMessage("");
  }

  /*
  async function handleLegacyLogin(email: string, password: string) {
    if (supabase && isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data.user) {
        setLoggedIn(true);
        return;
      }
    }

    const fallback = profiles.find((profile) => profile.email.toLowerCase() === email.toLowerCase()) ?? profiles[0];
    setCurrentUserId(fallback.id);
    setLoggedIn(true);
  }
  */

  async function uploadProfilePhoto(profileId: string, file: File) {
    setSaveStatus("saving");
    setSaveError(file.size > maxImageBytes ? "Comprimindo imagem..." : "");
    try {
      const prepared = await prepareUploadFile(file);
      let avatarUrl = URL.createObjectURL(prepared.file);
      if (supabase) {
        const path = `avatars/${profileId}-${Date.now()}-${sanitizeFileName(prepared.file.name)}`;
        const { error } = await supabase.storage.from("profile-avatars").upload(path, prepared.file, { upsert: true });
        if (!error) {
          avatarUrl = supabase.storage.from("profile-avatars").getPublicUrl(path).data.publicUrl;
        }
      }
      if (prepared.notice) setSaveError(prepared.notice);
      syncProfiles((current) => current.map((profile) => (profile.id === profileId ? { ...profile, avatarUrl } : profile)));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao enviar imagem.";
      setSaveStatus("error");
      setSaveError(message);
      window.alert(message);
    }
  }

  async function uploadFileToStorage(bucket: string, path: string, file: File) {
    if (!supabase) return URL.createObjectURL(file);
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  async function removeFileFromStorage(bucket: string, url: string) {
    if (!supabase || !url.includes("/storage/v1/object/public/")) return;
    const marker = `/storage/v1/object/public/${bucket}/`;
    const path = decodeURIComponent(url.split(marker)[1] ?? "");
    if (!path || path === url) return;
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) console.warn("Não foi possível remover arquivo do Storage", error);
  }

  async function prepareIdeaAttachment(ideaId: string, file: File) {
    setSaveStatus("saving");
    setSaveError(file.type.startsWith("image/") && file.size > maxImageBytes ? "Comprimindo imagem..." : "");
    const prepared = await prepareUploadFile(file);
    const type = fileKind(prepared.file);
    const path = `${ideaId}/${Date.now()}-${sanitizeFileName(prepared.file.name)}`;
    const url = await uploadFileToStorage("idea-attachments", path, prepared.file);
    if (prepared.notice) setSaveError(prepared.notice);
    return { id: crypto.randomUUID(), name: prepared.file.name, type, source: "upload" as const, url, previewUrl: url, originalSize: prepared.originalSize, compressedSize: prepared.compressedSize, mimeType: prepared.file.type };
  }

  async function addTaskAttachment(taskId: string, file: File) {
    setSaveStatus("saving");
    setSaveError(file.type.startsWith("image/") && file.size > maxImageBytes ? "Comprimindo imagem..." : "");
    try {
      const prepared = await prepareUploadFile(file);
      const type = fileKind(prepared.file);
      const path = `${taskId}/${Date.now()}-${sanitizeFileName(prepared.file.name)}`;
      const url = await uploadFileToStorage("task-attachments", path, prepared.file);
      const attachment: TaskAttachment = { id: crypto.randomUUID(), name: prepared.file.name, type, source: "upload", url, previewUrl: url, originalSize: prepared.originalSize, compressedSize: prepared.compressedSize, mimeType: prepared.file.type };
      if (prepared.notice) setSaveError(prepared.notice);
      updateTask(taskId, (task) => ({ ...task, attachments: [attachment, ...task.attachments] }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao enviar arquivo.";
      setSaveStatus("error");
      setSaveError(message);
      window.alert(message);
    }
  }

  async function deleteTaskAttachment(taskId: string, attachment: TaskAttachment) {
    if (!window.confirm(`Excluir o anexo "${attachment.name}"?`)) return;
    if (attachment.source === "upload") await removeFileFromStorage("task-attachments", attachment.url);
    updateTask(taskId, (task) => ({ ...task, attachments: task.attachments.filter((item) => item.id !== attachment.id) }));
  }

  function addTaskExternalLink(taskId: string, url: string) {
    const previewUrl = drivePreviewUrl(url);
    if (!previewUrl) {
      window.alert("Link inválido. Use um link de compartilhamento do Google Drive ou YouTube.");
      return;
    }
    const attachment: TaskAttachment = { id: crypto.randomUUID(), name: youtubePreviewUrl(url) ? "Vídeo do YouTube" : "Vídeo do Google Drive", type: "video", source: "external", url, previewUrl, originalSize: 0, compressedSize: 0, mimeType: "text/html" };
    updateTask(taskId, (task) => ({ ...task, attachments: [attachment, ...task.attachments] }));
  }

  async function addIdeaAttachment(ideaId: string, file: File) {
    setSaveStatus("saving");
    setSaveError(file.type.startsWith("image/") && file.size > maxImageBytes ? "Comprimindo imagem..." : "");
    try {
      const attachment = await prepareIdeaAttachment(ideaId, file);
      syncIdeas((current) => current.map((idea) => idea.id === ideaId ? { ...idea, attachments: [attachment, ...(idea.attachments ?? [])] } : idea));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao enviar arquivo.";
      setSaveStatus("error");
      setSaveError(message);
      window.alert(message);
    }
  }

  function addIdeaExternalLink(ideaId: string, url: string) {
    const previewUrl = drivePreviewUrl(url);
    if (!previewUrl) {
      window.alert("Link inválido. Use um link de compartilhamento do Google Drive ou YouTube.");
      return;
    }
    const attachment: TaskAttachment = { id: crypto.randomUUID(), name: youtubePreviewUrl(url) ? "Exemplo do YouTube" : "Exemplo do Google Drive", type: "video", source: "external", url, previewUrl, originalSize: 0, compressedSize: 0, mimeType: "text/html" };
    syncIdeas((current) => current.map((idea) => idea.id === ideaId ? { ...idea, attachments: [attachment, ...(idea.attachments ?? [])] } : idea));
  }

  function updateTask(taskId: string, updater: (task: Task) => Task) {
    syncTasks((current) => current.map((task) => (task.id === taskId ? updater(task) : task)));
  }

  function createNotifications(userIds: string[], title: string, description: string, targetKind: Notification["targetKind"], targetId: string) {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    if (!uniqueUserIds.length) return;
    const createdAt = new Date().toISOString();
    const newNotifications = uniqueUserIds.map((userId): Notification => ({
      id: `notification:${targetKind}:${targetId}:${slug(title)}:${userId}`,
      userId,
      title,
      description,
      createdAt,
      read: false,
      targetKind,
      targetId
    }));
    syncNotifications((current) => [...newNotifications.filter((item) => !current.some((existing) => existing.id === item.id)), ...current]);
  }

  function reviewRecipients(post: EditorialPost) {
    const assignedManagers = post.assignedTo.filter((profileId) => {
      const role = profileById.get(profileId)?.role;
      return role === "admin" || role === "gestor";
    });
    const fallbackManagers = profiles.filter((profile) => profile.role === "admin" || profile.role === "gestor").map((profile) => profile.id);
    return (assignedManagers.length ? assignedManagers : fallbackManagers).filter((profileId) => profileId !== currentUser.id);
  }

  async function addPostReviewAssets(post: EditorialPost, files: FileList | File[], isCover = false) {
    const uploaded: PostReviewAsset[] = [];
    for (const file of Array.from(files)) {
      setSaveStatus("saving");
      setSaveError(file.type.startsWith("image/") && file.size > maxImageBytes ? "Comprimindo imagem..." : "");
      try {
        const prepared = await prepareUploadFile(file);
        const type = fileKind(prepared.file);
        const path = `${post.id}/${Date.now()}-${sanitizeFileName(prepared.file.name)}`;
        const url = await uploadFileToStorage("post-review-assets", path, prepared.file);
        if (prepared.notice) setSaveError(prepared.notice);
        uploaded.push({
          id: crypto.randomUUID(),
          postId: post.id,
          name: prepared.file.name,
          type,
          source: "upload",
          url,
          previewUrl: url,
          originalSize: prepared.originalSize,
          compressedSize: prepared.compressedSize,
          mimeType: prepared.file.type,
          status: "Aguardando revisão",
          uploadedBy: currentUser.id,
          reviewedBy: "",
          uploadedAt: new Date().toISOString(),
          reviewedAt: "",
          comments: [],
          isCover,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao enviar arquivo.";
        setSaveStatus("error");
        setSaveError(message);
        window.alert(message);
      }
    }
    if (!uploaded.length) return;
    syncPostReviewAssets((current) => [...uploaded, ...current]);
    if (!isCover) {
      syncPosts((current) => current.map((item) => item.id === post.id ? { ...item, status: "Revisão" } : item));
      createNotifications(reviewRecipients(post), "Nova arte para revisar", post.title, "review", uploaded[0].id);
    }
  }

  function addPostReviewExternalAsset(post: EditorialPost, url: string, previewUrlOverride?: string, mimeType?: string, isCover?: boolean) {
    const isYoutube = Boolean(youtubePreviewUrl(url));
    const previewUrl = previewUrlOverride ?? drivePreviewUrl(url);
    if (!previewUrl) {
      window.alert("Link inválido. Use um link de compartilhamento do Google Drive ou YouTube.");
      return;
    }
    let type: "arquivo" | "foto" | "video";
    if (isYoutube) {
      type = "video";
    } else if (mimeType) {
      type = mimeType.startsWith("video/") ? "video" : mimeType.startsWith("image/") ? "foto" : "arquivo";
    } else {
      type = "arquivo";
    }
    const name = isYoutube ? "Vídeo do YouTube"
      : type === "video" ? "Vídeo do Drive"
      : type === "foto" ? "Imagem do Drive"
      : "Arquivo do Drive";
    const asset: PostReviewAsset = {
      id: crypto.randomUUID(),
      postId: post.id,
      name,
      type,
      source: "external",
      url,
      previewUrl,
      originalSize: 0,
      compressedSize: 0,
      mimeType: mimeType ?? "text/html",
      status: "Aguardando revisão",
      uploadedBy: currentUser.id,
      reviewedBy: "",
      uploadedAt: new Date().toISOString(),
      reviewedAt: "",
      comments: [],
      isCover: isCover ?? false,
    };
    syncPostReviewAssets((current) => [asset, ...current]);
    if (!isCover) {
      syncPosts((current) => current.map((item) => item.id === post.id ? { ...item, status: "Revisão" } : item));
      createNotifications(reviewRecipients(post), "Nova arte para revisar", post.title, "review", asset.id);
    }
  }

  function updatePostReviewAsset(assetId: string, updater: (asset: PostReviewAsset) => PostReviewAsset) {
    syncPostReviewAssets((current) => current.map((asset) => (asset.id === assetId ? updater(asset) : asset)));
  }

  function deletePostReviewAsset(assetId: string) {
    syncPostReviewAssets((current) => current.filter((asset) => asset.id !== assetId));
  }

  function setReviewAssetStatus(assetId: string, status: ReviewAssetStatus, message = "") {
    const asset = postReviewAssets.find((item) => item.id === assetId);
    const post = asset ? posts.find((item) => item.id === asset.postId) : undefined;
    if (!asset || !post) return;
    updatePostReviewAsset(assetId, (current) => ({
      ...current,
      status,
      reviewedBy: currentUser.id,
      reviewedAt: new Date().toISOString(),
      comments: message
        ? [{ id: crypto.randomUUID(), assetId, authorId: currentUser.id, message, createdAt: new Date().toISOString() }, ...current.comments]
        : current.comments
    }));
    syncPosts((current) => current.map((item) => item.id === post.id ? { ...item, status: status === "Aprovado" ? "Aprovado" : "Revisão" } : item));
    createNotifications([asset.uploadedBy].filter((id) => id !== currentUser.id), status === "Aprovado" ? "Arte aprovada" : "Ajustes solicitados", post.title, "review", asset.id);
  }

  function addReviewComment(assetId: string, message: string) {
    if (!message.trim()) return;
    updatePostReviewAsset(assetId, (asset) => ({
      ...asset,
      comments: [{ id: crypto.randomUUID(), assetId, authorId: currentUser.id, message: message.trim(), createdAt: new Date().toISOString() }, ...asset.comments]
    }));
  }

  function addQuickTask(columnId: string, title: string) {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const signature = `${columnId}:${normalizeText(cleanTitle)}`;
    const now = Date.now();
    if (recentQuickTaskSignature.current?.signature === signature && now - recentQuickTaskSignature.current.at < 800) return;
    recentQuickTaskSignature.current = { signature, at: now };
    const taskId = crypto.randomUUID();
    const goalCol = isGoalColumn(columnId) ? GOALS_VIRTUAL_COLUMNS.find((c) => c.id === columnId) : undefined;
    const resetFields = defaultTaskResetFields();
    const baseTask: Task = {
      id: taskId,
      title: cleanTitle,
      columnId,
      order: tasks.filter((item) => item.columnId === columnId && !item.parentTaskId).length + 1,
      priority: "Média",
      progress: "No prazo",
      createdBy: currentUser.id,
      assignedTo: [],
      relatedTo: "",
      funnelStageId: funnelStages[0]?.id ?? "",
      dueDate: todayIso(),
      description: "",
      checklist: [],
      comments: [],
      attachments: [],
      ...resetFields
    };
    if (goalCol) {
      baseTask.resetFrequency = goalCol.frequency;
      baseTask.currentValue = 0;
      if (goalCol.frequency !== "none") {
        baseTask.nextResetAt = calculateNextResetAt({
          resetFrequency: goalCol.frequency,
          resetTime: baseTask.resetTime || "23:59",
          resetWeekday: baseTask.resetWeekday ?? 0,
          resetMonthDay: baseTask.resetMonthDay ?? 1,
          resetMonthLastDay: baseTask.resetMonthLastDay ?? false
        });
      }
    }
    syncTasks((current) => current.some((item) => item.id === taskId) ? current : [...current, baseTask]);
  }

  function addSubtask(parentTask: Task, title = "Novo subtópico") {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const signature = `${parentTask.id}:${normalizeText(cleanTitle)}`;
    const now = Date.now();
    if (recentSubtaskSignature.current?.signature === signature && now - recentSubtaskSignature.current.at < 800) return;
    recentSubtaskSignature.current = { signature, at: now };
    const subtask: Task = {
      id: crypto.randomUUID(),
      title: cleanTitle,
      columnId: parentTask.columnId,
      order: tasks.filter((task) => task.parentTaskId === parentTask.id).length + 1,
      priority: "Média",
      progress: "No prazo",
      createdBy: currentUser.id,
      assignedTo: [],
      relatedTo: parentTask.title,
      funnelStageId: parentTask.funnelStageId,
      parentTaskId: parentTask.id,
      dueDate: todayIso(),
      description: "",
      checklist: [],
      comments: [],
      attachments: [],
      ...defaultTaskResetFields()
    };
    syncTasks((current) => current.some((item) => item.id === subtask.id) ? current : [...current, subtask]);
  }

  if (initializing) {
    return (
      <div className="grid min-h-screen place-items-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <img
            src="/embrepoli-logo.png"
            alt="Embrepoli"
            className="h-12 w-auto opacity-70"
          />
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <LoginScreen
        profiles={profiles}
        mode={authMode}
        setMode={changeAuthMode}
        loading={authLoading}
        message={authMessage}
        error={authError}
        pendingSignupEmail={pendingSignupEmail}
        onLogin={handleLogin}
        onSignup={handleSignup}
        onForgotPassword={handleForgotPassword}
        onResetPassword={handleResetPassword}
        onRetryApproval={handleRetryApproval}
        onResendConfirmation={handleResendConfirmation}
        onLogout={handleLogout}
      />
    );
  }

  if (userHasNoTeam) {
    return <NoTeamScreen onRetry={() => void reloadFromSupabase()} onLogout={handleLogout} />;
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[276px_1fr]">
        <aside className="border-r border-slate-200 bg-white px-5 py-5">
          <div className="flex items-center gap-3">
            <Image src="/embrepoli-logo.png" alt="Logo Embrepoli" width={58} height={58} className="h-14 w-14 object-contain" priority />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Embrepoli</p>
              <h1 className="text-xl font-black">Gestão</h1>
            </div>
          </div>
          {allowedAreas.length > 1 && (
            <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              {allowedAreas.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => {
                    setActiveArea(area);
                    setActiveSection(preferredSectionForArea(currentUser, area, profileAreas, profileModulePermissions));
                  }}
                  className={`rounded-xl px-3 py-2 text-sm font-black transition ${activeArea === area ? "bg-blue-700 text-white shadow-sm" : "text-slate-500 hover:bg-white"}`}
                >
                  {appAreas.find((item) => item.id === area)?.label}
                </button>
              ))}
            </div>
          )}
          <nav className="mt-8 space-y-2">
            {visibleMenu.map((item) => {
              if (item.moduleId === "revisoes" && !canReviewAssets) return null;
              const Icon = item.icon;
              const selected = activeSection === item.sectionId;
              const showPendingBadge = item.moduleId === "configuracoes" && pendingApprovalsCount > 0;
              return (
                <button
                  key={item.sectionId}
                  onClick={() => openSection(item.sectionId)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition ${
                    selected ? "bg-blue-700 text-white shadow-lg shadow-blue-700/20" : "text-slate-600 hover:bg-blue-50 hover:text-blue-800"
                  }`}
                >
                  <Icon size={18} />
                  <span className="flex-1">{item.label}</span>
                  {showPendingBadge && (
                    <span className={`flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-black ${selected ? "bg-white text-blue-700" : "bg-amber-500 text-white"}`}>
                      {pendingApprovalsCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 px-4 py-5 md:px-8">
          <Header
            activeSection={activeSection}
            activeArea={activeArea}
            currentUser={currentUser}
            profileOpen={profileOpen}
            setProfileOpen={setProfileOpen}
            uploadProfilePhoto={uploadProfilePhoto}
            setModal={setModal}
            openSection={openSection}
            notifications={currentNotifications}
            notificationsOpen={notificationsOpen}
            setNotificationsOpen={setNotificationsOpen}
            setNotifications={syncNotifications}
            postReviewAssets={postReviewAssets}
            pendingReviewCount={pendingReviewAssets.length}
            canReviewAssets={canReviewAssets}
            saveStatus={saveStatus}
            saveError={saveError}
            logout={handleLogout}
            realtimeSyncing={realtimeSyncing}
          />

          {activeSection === "marketing-painel" && (
            <Dashboard posts={visiblePosts} tasks={visibleTasks} campaigns={visibleCampaigns} metrics={metrics} ideas={visibleIdeas} postReviewAssets={postReviewAssets} openSection={openSection} channels={channels} channelById={channelById} />
          )}
          {activeSection === "marketing-calendario" && (
            <EditorialCalendar
              posts={visiblePosts}
              setPosts={syncPosts}
              channels={channels}
              campaigns={campaigns}
              productLines={productLines}
              vehicleTypes={vehicleTypes}
              contentTypes={contentTypes}
              funnelStages={funnelStages}
              profiles={profiles}
              calendarDates={calendarDates}
              channelById={channelById}
              funnelById={funnelById}
              calendarMode={calendarMode}
              setCalendarMode={setCalendarMode}
              visibleMonth={visibleMonth}
              setVisibleMonth={setVisibleMonth}
              setModal={setModal}
            />
          )}
          {activeSection === "marketing-ideias" && (
            <Ideas ideas={visibleIdeas} posts={posts} setIdeas={syncIdeas} view={ideasView} setView={setIdeasView} activeTab={ideasTab} setActiveTab={setIdeasTab} channelById={channelById} lineById={lineById} vehicleTypeById={vehicleTypeById} contentTypeById={contentTypeById} funnelById={funnelById} profileById={profileById} setModal={setModal} />
          )}
          {activeSection === "marketing-tarefas" && (
            <Tasks
              areaScope="marketing"
              tasks={visibleTasks}
              allTasks={tasks}
              setTasks={syncTasks}
              taskBoards={taskBoards}
              setTaskBoards={syncTaskBoards}
              posts={posts}
              setPosts={syncPosts}
              ideas={ideas}
              currentUser={currentUser}
              campaigns={campaigns}
              channels={channels}
              activeTaskBoardId={activeTaskBoardId}
              setActiveTaskBoardId={setActiveTaskBoardId}
              taskColumns={taskColumns}
              setTaskColumns={syncTaskColumns}
              profileById={profileById}
              channelById={channelById}
              funnelById={funnelById}
              setModal={setModal}
              createNotifications={createNotifications}
              addQuickTask={addQuickTask}
            />
          )}
          {activeSection === "marketing-revisoes" && canReviewAssets && (
            <ReviewsPage
              assets={postReviewAssets}
              posts={posts}
              profiles={profiles}
              profileById={profileById}
              channelById={channelById}
              setModal={setModal}
              openMediaPreview={setMediaPreview}
              setReviewAssetStatus={setReviewAssetStatus}
              addReviewComment={addReviewComment}
              deletePostReviewAsset={deletePostReviewAsset}
            />
          )}
          {activeSection === "marketing-campanhas" && (
            <Campaigns campaigns={visibleCampaigns} lineById={lineById} vehicleTypeById={vehicleTypeById} funnelById={funnelById} profileById={profileById} setModal={setModal} />
          )}
          {activeSection === "marketing-metricas" && (
            <Metrics
              metrics={metrics}
              setMetrics={syncMetrics}
              posts={posts}
              campaigns={campaigns}
              channels={channels}
              productLines={productLines}
              vehicleTypes={vehicleTypes}
              contentTypes={contentTypes}
              funnelStages={funnelStages}
              currentUser={currentUser}
              taskColumns={taskColumns}
              setTasks={syncTasks}
              setIdeas={syncIdeas}
              channelById={channelById}
              lineById={lineById}
              vehicleTypeById={vehicleTypeById}
              contentTypeById={contentTypeById}
              funnelById={funnelById}
              setModal={setModal}
              reloadData={reloadFromSupabase}
            />
          )}
          {activeSection === "marketing-comentarios" && hasModulePermission(currentUser, "marketing", "comentarios", "view", profileAreas, profileModulePermissions) && (
            <ComentariosSection
              comments={ytComments}
              setComments={(next) => {
                setYtComments(next);
              }}
              autoFilters={autoFilters}
              setAutoFilters={(next) => {
                setAutoFilters(next);
              }}
              questions={customerQuestions}
              setQuestions={(next) => {
                const prev = customerQuestions;
                setCustomerQuestions(next);
                replaceCustomerQuestions(supabase!, next, prev).catch(() => setCustomerQuestions(prev));
              }}
              currentUser={currentUser}
            />
          )}
          {activeSection === "marketing-banco-duvidas" && hasModulePermission(currentUser, "marketing", "banco-duvidas", "view", profileAreas, profileModulePermissions) && (
            <BancoDeDuvidas
              questions={customerQuestions}
              setQuestions={(next) => {
                const prev = customerQuestions;
                setCustomerQuestions(next);
                replaceCustomerQuestions(supabase!, next, prev).catch(() => setCustomerQuestions(prev));
              }}
              currentUser={currentUser}
            />
          )}
          {activeSection === "vendas-painel" && (
            <PainelVendas
              salesClients={salesClients}
              callSchedules={callSchedules}
              tasks={tasks}
              salesFunnelStages={salesFunnelStages}
              openSection={openSection}
              openClients={(filter) => {
                setSalesClientFilter(filter);
                setSalesClientSearch("");
                openSection("vendas-clientes");
              }}
              openCalls={(filter) => {
                setSalesCallFilter(filter);
                openSection("vendas-ligacoes");
              }}
            />
          )}
          {activeSection === "vendas-clientes" && (
            <ClientesSection
              salesClients={salesClients}
              setSalesClients={syncSalesClients}
              callSchedules={callSchedules}
              setCallSchedules={syncCallSchedules}
              profiles={profiles}
              currentUser={currentUser}
              filter={salesClientFilter}
              setFilter={setSalesClientFilter}
              search={salesClientSearch}
              setSearch={setSalesClientSearch}
            />
          )}
          {activeSection === "vendas-ligacoes" && (
            <LigacoesSection
              callSchedules={callSchedules}
              setCallSchedules={syncCallSchedules}
              salesClients={salesClients}
              currentUser={currentUser}
              initialFilter={salesCallFilter}
              onFilterApplied={() => setSalesCallFilter("all")}
            />
          )}
          {activeSection === "vendas-funil-comercial" && (
            <FunilComercialSection
              salesClients={salesClients}
              setSalesClients={syncSalesClients}
              salesFunnelStages={salesFunnelStages}
              setSalesFunnelStages={syncSalesFunnelStages}
              callSchedules={callSchedules}
              setCallSchedules={syncCallSchedules}
              profiles={profiles}
              currentUser={currentUser}
            />
          )}
          {activeSection === "vendas-atividades" && (
            <Tasks
              areaScope="vendas"
              tasks={tasks.filter((t) => {
                if (!t.columnId.startsWith("vendas-atividades")) return true;
                if (!t.isPrivate) return true;
                return t.createdBy === currentUser?.id;
              })}
              allTasks={tasks}
              setTasks={syncTasks}
              taskBoards={taskBoards}
              setTaskBoards={syncTaskBoards}
              posts={posts}
              setPosts={syncPosts}
              ideas={ideas}
              currentUser={currentUser}
              campaigns={campaigns}
              channels={channels}
              activeTaskBoardId={activeTaskBoardId}
              setActiveTaskBoardId={setActiveTaskBoardId}
              taskColumns={taskColumns}
              setTaskColumns={syncTaskColumns}
              profileById={profileById}
              channelById={channelById}
              funnelById={funnelById}
              setModal={setModal}
              createNotifications={createNotifications}
              addQuickTask={addQuickTask}
            />
          )}
          {activeSection === "vendas-metas" && (
            <VendasMetasSection
              tasks={tasks}
              setTasks={syncTasks}
              currentUser={currentUser}
              profileById={profileById}
              setModal={setModal}
            />
          )}
          {(activeSection === "marketing-configuracoes" || activeSection === "vendas-configuracoes") && (
            <SettingsPanel
              activeArea={activeArea}
              currentUser={currentUser}
              profiles={profiles}
              profileAreas={profileAreas}
              profileModulePermissions={profileModulePermissions}
              channels={channels}
              campaignAudiences={campaignAudiences}
              postTemplates={postTemplates}
              productLines={productLines}
              vehicleTypes={vehicleTypes}
              contentTypes={contentTypes}
              funnelStages={funnelStages}
              configTab={activeConfigTab}
              setConfigTab={setActiveConfigTab}
              setProfiles={syncProfiles}
              setProfileAreas={syncProfileAreas}
              setProfileModulePermissions={syncProfileModulePermissions}
              setChannels={syncChannels}
              setCampaignAudiences={syncCampaignAudiences}
              setPostTemplates={syncPostTemplates}
              setProductLines={syncProductLines}
              setVehicleTypes={syncVehicleTypes}
              setContentTypes={syncContentTypes}
              calendarDates={calendarDates}
              setCalendarDates={syncCalendarDates}
              setFunnelStages={syncFunnelStages}
              uploadProfilePhoto={uploadProfilePhoto}
              sendPasswordResetForProfile={sendPasswordResetForProfile}
              setModal={setModal}
            />
          )}
        </section>
      </div>

      <EntityModal
        modal={modal}
        setModal={setModal}
        currentUser={currentUser}
        profiles={profiles}
        profileAreas={profileAreas}
        profileModulePermissions={profileModulePermissions}
        profileById={profileById}
        channels={channels}
        productLines={productLines}
        vehicleTypes={vehicleTypes}
        contentTypes={contentTypes}
        funnelStages={funnelStages}
        campaigns={campaigns}
        campaignAudiences={campaignAudiences}
        postTemplates={postTemplates}
        posts={posts}
        setPosts={syncPosts}
        postReviewAssets={postReviewAssets}
        addPostReviewAssets={addPostReviewAssets}
        addPostReviewExternalAsset={addPostReviewExternalAsset}
        deletePostReviewAsset={deletePostReviewAsset}
        setReviewAssetStatus={setReviewAssetStatus}
        addReviewComment={addReviewComment}
        ideas={ideas}
        setIdeas={syncIdeas}
        addIdeaAttachment={addIdeaAttachment}
        addIdeaExternalLink={addIdeaExternalLink}
        prepareIdeaAttachment={prepareIdeaAttachment}
        openMediaPreview={setMediaPreview}
        createNotifications={createNotifications}
        setCampaigns={syncCampaigns}
        metrics={metrics}
        setMetrics={syncMetrics}
        setProfiles={syncProfiles}
        setProfileAreas={syncProfileAreas}
        setProfileModulePermissions={syncProfileModulePermissions}
        uploadProfilePhoto={uploadProfilePhoto}
        tasks={tasks}
        setTasks={syncTasks}
        taskColumns={taskColumns}
        taskBoards={taskBoards}
        updateTask={updateTask}
        addTaskAttachment={addTaskAttachment}
        deleteTaskAttachment={deleteTaskAttachment}
        addTaskExternalLink={addTaskExternalLink}
        addSubtask={addSubtask}
      />
      {mediaPreview && <MediaPreviewModal item={mediaPreview} close={() => setMediaPreview(null)} />}
    </main>
  );
}

function LoginScreen({
  profiles,
  mode,
  setMode,
  loading,
  message,
  error,
  pendingSignupEmail,
  onLogin,
  onSignup,
  onForgotPassword,
  onResetPassword,
  onRetryApproval,
  onResendConfirmation,
  onLogout
}: {
  profiles: Profile[];
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  loading: boolean;
  message: string;
  error: string;
  pendingSignupEmail: string;
  onLogin: (email: string, password: string) => void;
  onSignup: (name: string, email: string, password: string) => void;
  onForgotPassword: (email: string) => void;
  onResetPassword: (password: string) => void;
  onRetryApproval: () => void;
  onResendConfirmation: () => void;
  onLogout: () => void;
}) {
  const [localError, setLocalError] = useState("");
  const [emailValue, setEmailValue] = useState(!isSupabaseConfigured && mode === "login" ? profiles[0]?.email ?? "" : "");
  const [passwordValue, setPasswordValue] = useState(!isSupabaseConfigured && mode === "login" ? "embrepoli" : "");
  const [nameValue, setNameValue] = useState("");
  const [confirmPasswordValue, setConfirmPasswordValue] = useState("");

  function handleSubmit() {
    setLocalError("");
    if (mode === "login" && (!emailValue.trim() || !passwordValue)) {
      setLocalError("Preencha email e senha antes de continuar.");
      return;
    }
    if (mode === "signup" && (!nameValue.trim() || !emailValue.trim() || !passwordValue)) {
      setLocalError("Preencha nome, email e senha antes de continuar.");
      return;
    }
    if (mode === "signup" && passwordValue !== confirmPasswordValue) {
      setLocalError("As senhas não conferem.");
      return;
    }
    if (mode === "forgot" && !emailValue.trim()) {
      setLocalError("Informe o email para receber o link de recuperação.");
      return;
    }
    if (mode === "reset" && !passwordValue) {
      setLocalError("Digite uma nova senha.");
      return;
    }
    console.log("[auth] handleSubmit:", { mode, email: emailValue, hasPassword: !!passwordValue });
    if (mode === "login") onLogin(emailValue, passwordValue);
    if (mode === "signup") onSignup(nameValue, emailValue, passwordValue);
    if (mode === "forgot") onForgotPassword(emailValue);
    if (mode === "reset") onResetPassword(passwordValue);
  }

  const title = mode === "signup" ? "Criar conta"
    : mode === "forgot" ? "Recuperar senha"
    : mode === "reset" ? "Nova senha"
    : mode === "checkEmail" ? "Confirme seu email"
    : mode === "pending" ? "Aguardando aprovação"
    : "Entrar";
  const subtitle = mode === "checkEmail"
    ? "Enviamos um link de confirmação. Clique nele para ativar sua conta."
    : mode === "pending"
      ? "Sua conta já existe, mas precisa ser aprovada por um Gestor ou Administrador."
      : mode === "signup"
        ? "Crie sua conta. O acesso completo será liberado após aprovação."
        : mode === "forgot"
          ? "Informe seu email para receber o link de recuperação."
          : mode === "reset"
            ? "Digite uma nova senha para sua conta."
            : "Entre com sua conta da equipe para acessar o sistema.";

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4">
      <section className="w-full max-w-md rounded-[34px] bg-white p-8 shadow-2xl shadow-blue-950/10">
        <Image src="/embrepoli-logo.png" alt="Logo Embrepoli" width={110} height={110} className="mx-auto h-28 w-28 object-contain" priority />
        <h1 className="mt-5 text-center text-3xl font-black">Gestão Embrepoli</h1>
        <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
          <button type="button" onClick={() => setMode("login")} className={`rounded-xl px-3 py-2 text-sm font-black ${mode === "login" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>Entrar</button>
          <button type="button" onClick={() => setMode("signup")} className={`rounded-xl px-3 py-2 text-sm font-black ${mode === "signup" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>Criar conta</button>
        </div>
        <h2 className="mt-6 text-xl font-black">{title}</h2>
        <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        {message && <p className="mt-4 rounded-2xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">{message}</p>}
        {(error || localError) && <p className="mt-4 rounded-2xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{error || localError}</p>}

        {mode === "checkEmail" ? (
          <div className="mt-6 space-y-3">
            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Email enviado para</p>
              <p className="mt-1 text-base font-black text-blue-900 break-all">{pendingSignupEmail || "—"}</p>
            </div>
            <p className="text-sm text-slate-600">
              Abra seu email e clique no link de confirmação. Após confirmar, um Gestor ou Administrador precisará liberar seu acesso.
            </p>
            <p className="text-xs font-bold text-slate-400">Não esqueça de verificar a pasta de spam.</p>
            <button
              type="button"
              onClick={onResendConfirmation}
              disabled={loading}
              className="w-full rounded-2xl bg-blue-700 px-4 py-2 font-black text-white transition hover:bg-slate-950 disabled:opacity-60"
            >
              {loading ? "Reenviando..." : "Reenviar email de confirmação"}
            </button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className="w-full rounded-2xl bg-slate-100 px-4 py-2 font-black text-slate-600"
            >
              Voltar ao login
            </button>
          </div>
        ) : mode === "pending" ? (
          <div className="mt-6 space-y-3">
            <button type="button" onClick={onRetryApproval} disabled={loading} className="w-full rounded-2xl bg-blue-700 px-4 py-2 font-black text-white transition hover:bg-slate-950 disabled:opacity-60">
              {loading ? "Verificando..." : "Verificar aprovação"}
            </button>
            <button type="button" onClick={onLogout} className="w-full rounded-2xl bg-slate-100 px-4 py-2 font-black text-slate-600">Sair desta conta</button>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {mode === "signup" && (
              <label className="block text-sm font-bold text-slate-600">
                Nome
                <input type="text" required autoComplete="name" value={nameValue} onChange={(e) => setNameValue(e.target.value)} spellCheck autoCorrect="on" autoCapitalize="words" className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-950 outline-none focus:border-blue-500" />
              </label>
            )}
            {mode !== "reset" && (
              <label className="block text-sm font-bold text-slate-600">
                Email
                <input type="email" required autoComplete="email" value={emailValue} onChange={(e) => setEmailValue(e.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-950 outline-none focus:border-blue-500" />
              </label>
            )}
            {mode !== "forgot" && (
              <PasswordInput
                label={mode === "reset" ? "Nova senha" : "Senha"}
                autoComplete="current-password"
                value={passwordValue}
                onChange={setPasswordValue}
              />
            )}
            {mode === "signup" && (
              <PasswordInput
                label="Confirmar senha"
                autoComplete="new-password"
                value={confirmPasswordValue}
                onChange={setConfirmPasswordValue}
              />
            )}
            <button
              type="button"
              disabled={loading}
              onClick={handleSubmit}
              className="w-full inline-flex items-center justify-center rounded-2xl bg-blue-700 px-4 py-2 font-black text-white transition hover:bg-slate-950 disabled:opacity-60"
            >
              {loading ? "Aguarde..." : mode === "signup" ? "Criar conta" : mode === "forgot" ? "Enviar link" : mode === "reset" ? "Salvar nova senha" : "Entrar"}
            </button>
          </div>
        )}

        {mode === "login" && <button type="button" onClick={() => setMode("forgot")} className="mt-4 w-full text-center text-sm font-black text-blue-700">Esqueci minha senha</button>}
        {(mode === "forgot" || mode === "reset") && <button type="button" onClick={() => setMode("login")} className="mt-4 w-full text-center text-sm font-black text-blue-700">Voltar para entrar</button>}
        {!isSupabaseConfigured && <p className="mt-4 text-center text-xs text-slate-400">Sem Supabase configurado, o login usa as contas locais de demonstração.</p>}
      </section>
    </main>
  );
}

function PasswordInput({ name, label, required, defaultValue, autoComplete, value, onChange }: { name?: string; label: string; required?: boolean; defaultValue?: string; autoComplete?: string; value?: string; onChange?: (v: string) => void }) {
  const [visible, setVisible] = useState(false);
  const controlled = value !== undefined && onChange !== undefined;
  return (
    <label className="block text-sm font-bold text-slate-600">
      {label}
      <span className="mt-1 flex rounded-2xl border border-slate-200 bg-white focus-within:border-blue-500">
        {controlled
          ? <input type={visible ? "text" : "password"} required={required} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 rounded-2xl px-3 py-2 text-slate-950 outline-none" />
          : <input name={name} type={visible ? "text" : "password"} required={required} defaultValue={defaultValue} autoComplete={autoComplete} className="min-w-0 flex-1 rounded-2xl px-3 py-2 text-slate-950 outline-none" />
        }
        <button type="button" onClick={() => setVisible((value) => !value)} className="px-3 text-slate-500" aria-label={visible ? "Ocultar senha" : "Mostrar senha"}>
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}

function NoTeamScreen({ onRetry, onLogout }: { onRetry: () => void; onLogout: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-white px-4">
      <section className="w-full max-w-xl rounded-[36px] border border-slate-100 bg-white p-8 text-center shadow-2xl shadow-blue-950/10">
        <Image src="/embrepoli-logo.png" alt="Logo Embrepoli" width={130} height={130} className="mx-auto h-32 w-32 object-contain" priority />
        <h1 className="mt-5 text-3xl font-black">Gestão Embrepoli</h1>
        <p className="mt-4 text-base font-bold text-slate-600">
          Seu cadastro ainda não pertence a nenhuma equipe. Aguarde um Gestor ou Administrador selecionar sua equipe.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={onRetry} className="rounded-2xl bg-blue-700 px-4 py-2 font-black text-white transition hover:bg-blue-800">Tentar novamente</button>
          <button type="button" onClick={onLogout} className="rounded-2xl bg-slate-100 px-4 py-2 font-black text-slate-600 transition hover:bg-slate-200">Sair da conta</button>
        </div>
      </section>
    </main>
  );
}

function SalesPlaceholder({ section }: { section: string }) {
  return (
    <Panel title={section}>
      <div className="grid min-h-80 place-items-center rounded-[30px] border border-dashed border-blue-200 bg-blue-50/60 p-8 text-center">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">Área de Vendas</p>
          <h3 className="mt-2 text-2xl font-black">Estrutura preparada</h3>
          <p className="mx-auto mt-3 max-w-xl text-sm font-bold text-slate-600">
            Esta tela já está isolada da área de Marketing e pronta para receber os fluxos de vendas nas próximas fases.
          </p>
        </div>
      </div>
    </Panel>
  );
}

// ─── Vendas — helpers ─────────────────────────────────────────────────────────

function nextCallDate(from: Date, freq: CallFrequency): string {
  const d = new Date(from);
  const days = freq === "daily" ? 1 : freq === "weekly" ? 7 : freq === "biweekly" ? 14 : 30;
  d.setDate(d.getDate() + days);
  // Ajusta para próximo dia útil (pula sáb/dom)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function callUrgency(nextCallAt: string): "overdue" | "today" | "upcoming" {
  const today = new Date().toISOString().slice(0, 10);
  if (nextCallAt < today) return "overdue";
  if (nextCallAt === today) return "today";
  return "upcoming";
}

function formatCallDate(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return "hoje";
  if (dateStr === tomorrow) return "amanhã";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const callFrequencyLabel: Record<CallFrequency, string> = {
  daily: "Diário",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal"
};

const salesClientStatusLabel: Record<SalesClientStatus, string> = {
  lead: "Lead",
  cliente: "Cliente",
  inativo: "Inativo"
};

const salesSourceLabel: Record<SalesClientSource, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  indicacao: "Indicação",
  site: "Site",
  manual: "Manual",
  outros: "Outros"
};

const CLIENT_IMPORT_SHEET = "Page1";
const CLIENT_IMPORT_HEADERS = ["Código", "Nome Cliente", "Tipo", "Telefone", "UF", "Municipio", "Ultima Compra"] as const;

type ImportedSalesClientRow = {
  rowNumber: number;
  externalCode: string;
  name: string;
  clientType: string;
  phone: string;
  stateUf: string;
  city: string;
  lastPurchaseAt: string;
};

type SalesClientImportResult = {
  rows: number;
  created: number;
  updated: number;
  unchanged: number;
  updatedFields: number;
};

function cleanImportCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\u00a0/g, " ").trim().replace(/^'/, "");
}

function salesClientImportKey(client: Pick<SalesClient, "externalCode" | "name" | "phone">): string {
  const code = cleanImportCell(client.externalCode);
  if (code) return `code:${code}`;
  const digits = cleanImportCell(client.phone).replace(/\D/g, "");
  return `fallback:${cleanImportCell(client.name).toLocaleLowerCase("pt-BR")}:${digits}`;
}

function parseClientImportDate(value: unknown, rowNumber: number): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) throw new Error(`Linha ${rowNumber}: data de última compra inválida.`);
    const month = String(parsed.m).padStart(2, "0");
    const day = String(parsed.d).padStart(2, "0");
    return `${parsed.y}-${month}-${day}`;
  }
  const raw = cleanImportCell(value);
  if (!raw || raw === "01/01/0001") return "";
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) throw new Error(`Linha ${rowNumber}: data de última compra precisa estar em DD/MM/AAAA.`);
  const [, dd, mm, yyyy] = match;
  if (yyyy === "0001") return "";
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function formatSalesClientDate(date: string): string {
  if (!date) return "Sem compra registrada";
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
}

async function parseSalesClientsWorkbook(file: File): Promise<ImportedSalesClientRow[]> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new Error("Importe somente arquivo .xlsx no mesmo formato do arquivo de clientes enviado.");
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  if (workbook.SheetNames.length !== 1 || workbook.SheetNames[0] !== CLIENT_IMPORT_SHEET) {
    throw new Error(`Arquivo inválido. A planilha precisa ter somente a aba "${CLIENT_IMPORT_SHEET}".`);
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[CLIENT_IMPORT_SHEET], {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false
  });
  const header = rows[0]?.map(cleanImportCell) ?? [];
  const hasExactHeaders = CLIENT_IMPORT_HEADERS.length === header.length && CLIENT_IMPORT_HEADERS.every((h, i) => header[i] === h);
  if (!hasExactHeaders) {
    throw new Error(`Arquivo inválido. Cabeçalhos esperados: ${CLIENT_IMPORT_HEADERS.join(", ")}.`);
  }

  const seenCodes = new Set<string>();
  const imported: ImportedSalesClientRow[] = [];
  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const extraValues = row.slice(CLIENT_IMPORT_HEADERS.length).some((cell) => cleanImportCell(cell));
    if (extraValues) throw new Error(`Linha ${rowNumber}: o arquivo tem colunas extras e foi recusado.`);
    const values = row.slice(0, CLIENT_IMPORT_HEADERS.length).map(cleanImportCell);
    if (values.every((value) => !value)) return;
    const [externalCode, name, clientType, phone, stateUf, city] = values;
    if (!externalCode) throw new Error(`Linha ${rowNumber}: Código é obrigatório.`);
    if (!name) throw new Error(`Linha ${rowNumber}: Nome Cliente é obrigatório.`);
    if (seenCodes.has(externalCode)) throw new Error(`Código duplicado no arquivo: ${externalCode}.`);
    seenCodes.add(externalCode);
    imported.push({
      rowNumber,
      externalCode,
      name,
      clientType,
      phone,
      stateUf: stateUf.toUpperCase(),
      city,
      lastPurchaseAt: parseClientImportDate(row[6], rowNumber)
    });
  });

  if (!imported.length) throw new Error("Nenhum cliente encontrado no arquivo.");
  return imported;
}

function importedRowToSalesClient(row: ImportedSalesClientRow): SalesClient {
  return {
    id: crypto.randomUUID(),
    externalCode: row.externalCode,
    name: row.name,
    clientType: row.clientType,
    email: "",
    phone: row.phone,
    company: "",
    segment: "",
    stateUf: row.stateUf,
    city: row.city,
    lastPurchaseAt: row.lastPurchaseAt,
    status: "lead",
    source: "manual",
    assignedTo: "",
    notes: "",
    proposals: [],
    salesFunnelStage: "lead",
    createdAt: new Date().toISOString()
  };
}

function normalizeSalesClient(client: SalesClient): SalesClient {
  return {
    ...client,
    externalCode: client.externalCode ?? "",
    clientType: client.clientType ?? "",
    stateUf: client.stateUf ?? "",
    city: client.city ?? "",
    lastPurchaseAt: client.lastPurchaseAt ?? "",
    salesFunnelStage: client.salesFunnelStage ?? "lead"
  };
}

function mergeImportedSalesClients(current: SalesClient[], imported: ImportedSalesClientRow[]): { next: SalesClient[]; result: SalesClientImportResult } {
  const result: SalesClientImportResult = { rows: imported.length, created: 0, updated: 0, unchanged: 0, updatedFields: 0 };
  const next = current.map(normalizeSalesClient);
  const indexByKey = new Map(next.map((client, index) => [salesClientImportKey(client), index]));
  const importFields: (keyof Pick<SalesClient, "externalCode" | "name" | "clientType" | "phone" | "stateUf" | "city" | "lastPurchaseAt">)[] = [
    "externalCode",
    "name",
    "clientType",
    "phone",
    "stateUf",
    "city",
    "lastPurchaseAt"
  ];

  imported.forEach((row) => {
    const importedClient = importedRowToSalesClient(row);
    const key = salesClientImportKey(importedClient);
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      next.push(importedClient);
      indexByKey.set(key, next.length - 1);
      result.created += 1;
      return;
    }

    const existing = next[existingIndex];
    const patch: Partial<SalesClient> = {};
    importFields.forEach((field) => {
      if (cleanImportCell(existing[field]) !== cleanImportCell(importedClient[field])) {
        patch[field] = importedClient[field] as never;
      }
    });

    const changedFields = Object.keys(patch).length;
    if (!changedFields) {
      result.unchanged += 1;
      return;
    }

    next[existingIndex] = { ...existing, ...patch };
    result.updated += 1;
    result.updatedFields += changedFields;
  });

  return { next, result };
}

const proposalStatusLabel: Record<SalesProposal["status"], string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  negociacao: "Negociação",
  ganha: "Ganha",
  perdida: "Perdida",
  expirada: "Expirada"
};

// ─── Painel ───────────────────────────────────────────────────────────────────

function MiniMetric({ label, value, tone = "blue" }: { label: string; value: string | number; tone?: "blue" | "green" | "amber" | "red" | "slate" }) {
  const toneClasses = {
    blue: "text-blue-700",
    green: "text-emerald-700",
    amber: "text-amber-700",
    red: "text-rose-700",
    slate: "text-slate-700"
  } satisfies Record<"blue" | "green" | "amber" | "red" | "slate", string>;

  return (
    <div className="rounded-2xl bg-white p-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${toneClasses[tone]}`}>{value}</p>
    </div>
  );
}

function PainelVendas({ salesClients, callSchedules, tasks, salesFunnelStages, openSection, openClients, openCalls }: {
  salesClients: SalesClient[];
  callSchedules: CallSchedule[];
  tasks: Task[];
  salesFunnelStages: SalesFunnelStage[];
  openSection: (sectionId: string) => void;
  openClients: (filter: "todos" | SalesClientStatus) => void;
  openCalls: (filter: "all" | "today" | "overdue") => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const clientesAtivos = salesClients.filter((c) => c.status === "cliente").length;
  const leads = salesClients.filter((c) => c.status === "lead").length;
  const activeCalls = callSchedules.filter((c) => c.active && !c.archived);
  const ligacoesHoje = activeCalls.filter((c) => c.nextCallAt === today).length;
  const ligacoesAtrasadas = activeCalls.filter((c) => c.nextCallAt < today).length;
  const ligacoesSemHistorico = activeCalls.filter((c) => c.callHistory.length === 0).length;

  const salesActivities = tasks.filter((task) => !task.parentTaskId && task.columnId.startsWith("vendas-atividades"));
  const atividadesAbertas = salesActivities.filter((task) => !task.columnId.endsWith("-done")).length;
  const atividadesHoje = salesActivities.filter((task) => task.dueDate === today).length;
  const atividadesAtrasadas = salesActivities.filter((task) => task.dueDate && task.dueDate < today && !task.columnId.endsWith("-done")).length;

  const salesGoals = tasks.filter((task) => !task.parentTaskId && vendasGoalsColumnIds.has(task.columnId));
  const goalsWithTarget = salesGoals.filter((task) => (task.targetValue ?? 0) > 0);
  const metasAtingidas = goalsWithTarget.filter((task) => (task.currentValue ?? 0) >= (task.targetValue ?? 0)).length;
  const metasEmAndamento = salesGoals.filter((task) => !((task.targetValue ?? 0) > 0 && (task.currentValue ?? 0) >= (task.targetValue ?? 0))).length;
  const metasEmAtencao = goalsWithTarget.filter((task) => computeGoalStatus(task).kind === "atrasada").length;
  const progressoMedioMetas = goalsWithTarget.length
    ? Math.round(goalsWithTarget.reduce((sum, task) => sum + computeGoalStatus(task).pct, 0) / goalsWithTarget.length)
    : 0;
  const taxaMetasAtingidas = goalsWithTarget.length ? Math.round((metasAtingidas / goalsWithTarget.length) * 100) : 0;

  const sortedStages = [...salesFunnelStages].sort((a, b) => a.order - b.order);
  const activeClients = salesClients.filter((client) => client.status !== "inativo");
  const pipelineStageIds = sortedStages.slice(0, Math.max(sortedStages.length - 2, 1)).map((stage) => stage.id);
  const pipelineClients = activeClients.filter((client) => pipelineStageIds.includes(clientFunnelStage(client)));
  const pipelineTotal = pipelineClients.reduce((sum, client) => sum + clientBestProposalValue(client), 0);
  const stageSummaries = sortedStages.map((stage) => {
    const clients = activeClients.filter((client) => clientFunnelStage(client) === stage.id);
    return { stage, clients, total: clients.reduce((sum, client) => sum + clientBestProposalValue(client), 0) };
  });
  const topStage = stageSummaries.reduce<typeof stageSummaries[number] | null>((best, item) => {
    if (!best || item.clients.length > best.clients.length) return item;
    return best;
  }, null);

  const summaryCards = [
    { label: "Clientes ativos", value: clientesAtivos, helper: `${salesClients.length} clientes no total`, color: "emerald", onClick: () => openClients("cliente") },
    { label: "Leads em aberto", value: leads, helper: "Aguardando avanço no funil", color: "amber", onClick: () => openClients("lead") },
    { label: "Ligações para hoje", value: ligacoesHoje, helper: `${ligacoesSemHistorico} sem histórico`, color: "blue", onClick: () => openCalls("today") },
    { label: "Ligações atrasadas", value: ligacoesAtrasadas, helper: "Precisam de retorno", color: "rose", onClick: () => openCalls("overdue") },
    { label: "Atividades abertas", value: atividadesAbertas, helper: `${atividadesHoje} para hoje`, color: "purple", onClick: () => openSection("vendas-atividades") },
    { label: "Metas em andamento", value: metasEmAndamento, helper: `${progressoMedioMetas}% de progresso médio`, color: "cyan", onClick: () => openSection("vendas-metas") },
    { label: "Pipeline em aberto", value: brl(pipelineTotal), helper: `${pipelineClients.length} clientes no pipeline`, color: "green", onClick: () => openSection("vendas-funil-comercial") },
    { label: "Taxa de metas atingidas", value: `${taxaMetasAtingidas}%`, helper: `${metasAtingidas}/${goalsWithTarget.length || 0} metas com alvo`, color: "slate", onClick: () => openSection("vendas-metas") }
  ] as const;

  const colorClasses: Record<typeof summaryCards[number]["color"], string> = {
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    rose: "border-rose-100 bg-rose-50 text-rose-700",
    purple: "border-purple-100 bg-purple-50 text-purple-700",
    cyan: "border-cyan-100 bg-cyan-50 text-cyan-700",
    green: "border-green-100 bg-green-50 text-green-700",
    slate: "border-slate-100 bg-slate-50 text-slate-700"
  };

  const shortcutButton = (label: string, sectionId: string) => (
    <button type="button" onClick={() => openSection(sectionId)} className="rounded-2xl bg-blue-700 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-800">
      {label}
    </button>
  );

  return (
    <Panel title="Painel">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <button type="button" key={card.label} onClick={card.onClick} className={`rounded-3xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${colorClasses[card.color]}`}>
            <p className="text-sm font-bold text-slate-500">{card.label}</p>
            <p className="mt-1 text-3xl font-black">{card.value}</p>
            <p className="mt-2 text-xs font-bold text-slate-500">{card.helper}</p>
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-slate-900">Atividades</h3>
              <p className="text-sm font-bold text-slate-500">Resumo das tarefas comerciais</p>
            </div>
            {shortcutButton("Ver atividades", "vendas-atividades")}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniMetric label="Abertas" value={atividadesAbertas} />
            <MiniMetric label="Para hoje" value={atividadesHoje} />
            <MiniMetric label="Atrasadas" value={atividadesAtrasadas} tone="red" />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-slate-900">Metas</h3>
              <p className="text-sm font-bold text-slate-500">Acompanhamento das metas de vendas</p>
            </div>
            {shortcutButton("Ver metas", "vendas-metas")}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniMetric label="Atingidas" value={metasAtingidas} tone="green" />
            <MiniMetric label="Em atenção" value={metasEmAtencao} tone="amber" />
            <MiniMetric label="Progresso médio" value={`${progressoMedioMetas}%`} />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-slate-900">Ligações</h3>
              <p className="text-sm font-bold text-slate-500">Agenda ativa e retornos pendentes</p>
            </div>
            {shortcutButton("Ver ligações", "vendas-ligacoes")}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniMetric label="Hoje" value={ligacoesHoje} />
            <MiniMetric label="Atrasadas" value={ligacoesAtrasadas} tone="red" />
            <MiniMetric label="Sem histórico" value={ligacoesSemHistorico} tone="slate" />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-slate-900">Funil</h3>
              <p className="text-sm font-bold text-slate-500">Pipeline comercial por etapa</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {shortcutButton("Ver funil", "vendas-funil-comercial")}
              {shortcutButton("Ver clientes", "vendas-clientes")}
            </div>
          </div>
          {sortedStages.length ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-white p-3">
                <span className="text-sm font-bold text-slate-500">Etapa com mais clientes</span>
                <span className="text-sm font-black text-slate-900">{topStage ? `${topStage.stage.name} · ${topStage.clients.length}` : "Sem clientes"}</span>
              </div>
              <div className="space-y-2">
                {stageSummaries.slice(0, 5).map(({ stage, clients, total }) => (
                  <div key={stage.id}>
                    <div className="mb-1 flex items-center justify-between text-xs font-black text-slate-500">
                      <span>{stage.emoji} {stage.name}</span>
                      <span>{clients.length} · {brl(total)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full" style={{ width: `${activeClients.length ? Math.max(8, (clients.length / activeClients.length) * 100) : 0}%`, background: stage.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm font-bold text-slate-400">
              Nenhuma etapa do funil comercial cadastrada ainda.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}

// ─── Clientes ─────────────────────────────────────────────────────────────────

function ClientesSection({ salesClients, setSalesClients, callSchedules, setCallSchedules, profiles, currentUser, filter, setFilter, search, setSearch }: {
  salesClients: SalesClient[];
  setSalesClients: Dispatch<SetStateAction<SalesClient[]>>;
  callSchedules: CallSchedule[];
  setCallSchedules: Dispatch<SetStateAction<CallSchedule[]>>;
  profiles: Profile[];
  currentUser: Profile | null;
  filter: "todos" | SalesClientStatus;
  setFilter: Dispatch<SetStateAction<"todos" | SalesClientStatus>>;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
}) {
  const [editing, setEditing] = useState<SalesClient | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [schedulingClient, setSchedulingClient] = useState<SalesClient | null>(null);

  const filtered = salesClients.filter((c) => {
    if (filter !== "todos" && c.status !== filter) return false;
    const term = search.toLowerCase();
    if (search && ![c.externalCode, c.name, c.company, c.phone, c.email, c.city, c.stateUf].some((value) => (value ?? "").toLowerCase().includes(term))) return false;
    return true;
  });

  function openNew() {
    setEditing({
      id: crypto.randomUUID(),
      externalCode: "",
      name: "", email: "", phone: "", company: "", segment: "",
      clientType: "", stateUf: "", city: "", lastPurchaseAt: "",
      status: "lead", source: "manual", assignedTo: currentUser?.id ?? "",
      notes: "", proposals: [], salesFunnelStage: "lead", createdAt: new Date().toISOString()
    });
    setShowModal(true);
  }

  function openEdit(client: SalesClient) {
    setEditing(normalizeSalesClient(client));
    setShowModal(true);
  }

  function save(client: SalesClient) {
    const normalized = normalizeSalesClient(client);
    setSalesClients((prev) => {
      const exists = prev.find((c) => c.id === normalized.id);
      return exists ? prev.map((c) => c.id === normalized.id ? normalized : c) : [...prev, normalized];
    });
    setShowModal(false);
    setEditing(null);
  }

  function importClients(rows: ImportedSalesClientRow[]): SalesClientImportResult {
    let result: SalesClientImportResult = { rows: rows.length, created: 0, updated: 0, unchanged: 0, updatedFields: 0 };
    setSalesClients((prev) => {
      const merged = mergeImportedSalesClients(prev, rows);
      result = merged.result;
      return merged.next;
    });
    return result;
  }

  function remove(id: string) {
    setSalesClients((prev) => prev.filter((c) => c.id !== id));
  }

  function addToCallSchedule(client: SalesClient, freq: CallFrequency) {
    const already = callSchedules.find((s) => s.clientId === client.id && s.active);
    if (already) return;
    const today = new Date().toISOString().slice(0, 10);
    const schedule: CallSchedule = {
      id: crypto.randomUUID(),
      clientId: client.id,
      clientName: client.name,
      phone: client.phone,
      frequency: freq,
      nextCallAt: today,
      callHistory: [],
      assignedTo: currentUser?.id ?? "",
      createdBy: currentUser?.id ?? "",
      active: true,
      paused: false,
      notes: ""
    };
    setCallSchedules((prev) => [...prev, schedule]);
  }

  function saveSchedule(schedule: CallSchedule) {
    setCallSchedules((prev) => [...prev, schedule]);
    setSchedulingClient(null);
  }

  const filterCounts = {
    todos: salesClients.length,
    lead: salesClients.filter((c) => c.status === "lead").length,
    cliente: salesClients.filter((c) => c.status === "cliente").length,
    inativo: salesClients.filter((c) => c.status === "inativo").length
  };

  return (
    <Panel title="Clientes">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {(["todos", "lead", "cliente", "inativo"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)}
              className={`rounded-2xl px-4 py-2 text-sm font-black transition ${filter === f ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"}`}>
              {f === "todos" ? "Todos" : salesClientStatusLabel[f]} <span className="opacity-70">{filterCounts[f]}</span>
            </button>
          ))}
        </div>
        <input
          type="search" placeholder="Buscar nome, código, cidade ou telefone..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
        />
        <button type="button" aria-label="Importar clientes XLSX" onClick={() => setShowImportModal(true)} className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-blue-50 hover:text-blue-700">
          <FileUp size={16} /> Importar XLSX
        </button>
        <button type="button" aria-label="Novo cliente" onClick={openNew} className="flex items-center gap-2 rounded-2xl bg-blue-700 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-800">
          <Plus size={16} /> Novo
        </button>
      </div>
      <div className="grid gap-3">
        {filtered.map((client) => {
          const hasSchedule = callSchedules.some((s) => s.clientId === client.id && s.active);
          const openValue = clientOpenProposalTotal(client);
          return (
            <div key={client.id} className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-black text-blue-700">
                {client.name.charAt(0).toUpperCase() || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{client.name || <span className="italic text-slate-400">Sem nome</span>}</p>
                  {client.externalCode && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">Código {client.externalCode}</span>}
                  <Badge tone={client.status === "cliente" ? "green" : client.status === "lead" ? "amber" : "slate"}>
                    {salesClientStatusLabel[client.status]}
                  </Badge>
                  {client.clientType && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-black text-blue-700">{client.clientType}</span>}
                </div>
                {client.company && <p className="text-sm font-bold text-slate-600">{client.company}</p>}
                <p className="text-xs font-bold text-slate-400">
                  {client.phone && <span className="mr-3">📞 {client.phone}</span>}
                  {client.email && <span className="mr-3">✉️ {client.email}</span>}
                  {(client.city || client.stateUf) && <span className="mr-3">{[client.city, client.stateUf].filter(Boolean).join(" / ")}</span>}
                  {client.lastPurchaseAt && <span className="mr-3">Última compra: {formatSalesClientDate(client.lastPurchaseAt)}</span>}
                  {client.segment && <span>{client.segment}</span>}
                  {client.source !== "manual" && <span className="ml-3 opacity-70">via {salesSourceLabel[client.source]}</span>}
                </p>
                {openValue > 0 && (
                  <p className="mt-1 text-xs font-black text-blue-700">Valor em aberto: {formatCurrency(openValue)}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {!hasSchedule && client.phone && (
                  <div className="relative group">
                    <button type="button" aria-label={`Agendar ligação para ${client.name}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setSchedulingClient(client); }}
                      className="rounded-2xl bg-emerald-100 px-3 py-2 text-sm font-black text-emerald-700 transition hover:bg-emerald-200">
                      <Phone size={14} className="inline mr-1" />Agendar ligação
                    </button>
                  </div>
                )}
                {hasSchedule && <span className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-600">✓ Na agenda</span>}
                <button type="button" aria-label={`Editar cliente ${client.name}`} onClick={() => openEdit(client)} className="rounded-2xl bg-blue-100 px-3 py-2 text-sm font-black text-blue-700">editar</button>
                <button type="button" aria-label={`Excluir cliente ${client.name}`} onClick={() => remove(client.id)} className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600">excluir</button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="rounded-3xl bg-slate-50 p-8 text-center text-sm font-bold text-slate-400">
            {salesClients.length === 0 ? "Nenhum cliente cadastrado ainda. Clique em \"Novo\" para começar." : "Nenhum resultado para este filtro."}
          </p>
        )}
      </div>
      {showModal && editing && (
        <ClienteModal
          client={editing}
          profiles={profiles}
          callSchedules={callSchedules}
          onSave={save}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onRequestSchedule={(client) => setSchedulingClient(normalizeSalesClient(client))}
        />
      )}
      {schedulingClient && (
        <QuickScheduleModal
          client={schedulingClient}
          currentUser={currentUser}
          profiles={profiles}
          onSave={saveSchedule}
          onClose={() => setSchedulingClient(null)}
        />
      )}
      {showImportModal && (
        <ClienteImportModal
          onImport={importClients}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </Panel>
  );
}

function QuickScheduleModal({ client, currentUser, profiles, onSave, onClose }: {
  client: SalesClient;
  currentUser: Profile | null;
  profiles: Profile[];
  onSave: (schedule: CallSchedule) => void;
  onClose: () => void;
}) {
  const [frequency, setFrequency] = useState<CallFrequency>("weekly");
  const [nextDate, setNextDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [assignedTo, setAssignedTo] = useState(client.assignedTo || currentUser?.id || "");

  function save() {
    onSave({
      id: crypto.randomUUID(),
      clientId: client.id,
      clientName: client.name,
      phone: client.phone,
      frequency,
      nextCallAt: nextDate,
      callHistory: [],
      assignedTo,
      createdBy: currentUser?.id ?? "",
      active: true,
      archived: false,
      notes
    });
  }

  return (
    <CenteredModal close={onClose} variant="compact" panelClassName="rounded-[32px] border-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Vendas · Ligações</p>
          <h2 className="text-xl font-black">Agendar ligação</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">{client.name}{client.phone ? ` · ${client.phone}` : ""}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-2xl p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
      </div>
      <div className="mt-5 space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-600 mb-2">Frequência</label>
          <div className="flex flex-wrap gap-2">
            {(["daily", "weekly", "biweekly", "monthly"] as CallFrequency[]).map((item) => (
              <button key={item} type="button" onClick={() => setFrequency(item)}
                className={`rounded-2xl px-3 py-2 text-sm font-black transition ${frequency === item ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50"}`}>
                {callFrequencyLabel[item]}
              </button>
            ))}
          </div>
        </div>
        <label className="block text-sm font-bold text-slate-600">Próxima ligação
          <input type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
        </label>
        <label className="block text-sm font-bold text-slate-600">Responsável
          <select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-blue-500">
            <option value="">Sem responsável</option>
            {profiles.filter((profile) => profile.active).map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.name || profile.email}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-bold text-slate-600">Observação inicial
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3}
            placeholder="Ex: ligar para confirmar interesse, orçamento ou retorno..."
            className="mt-1 w-full resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-2xl bg-slate-100 px-4 py-2 font-black text-slate-600 transition hover:bg-slate-200">Cancelar</button>
        <button type="button" disabled={!client.name.trim() || !nextDate} onClick={save} className="rounded-2xl bg-blue-700 px-4 py-2 font-black text-white transition hover:bg-blue-800 disabled:opacity-50">Agendar</button>
      </div>
    </CenteredModal>
  );
}

function ClienteImportModal({ onImport, onClose }: {
  onImport: (rows: ImportedSalesClientRow[]) => SalesClientImportResult;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SalesClientImportResult | null>(null);

  async function runImport() {
    if (!file) {
      setError("Selecione um arquivo .xlsx para importar.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const rows = await parseSalesClientsWorkbook(file);
      setResult(onImport(rows));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível importar o arquivo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CenteredModal close={onClose} variant="compact" panelClassName="rounded-[32px] border-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-blue-700">Vendas · Clientes</p>
          <h2 className="text-xl font-black">Importar clientes XLSX</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">
            Aceita somente a planilha com aba Page1 e os cabeçalhos exatamente iguais ao arquivo enviado.
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-2xl p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
      </div>

      <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50/60 px-6 py-8 text-center transition hover:border-blue-500 hover:bg-blue-50">
        <FileUp className="mb-2 text-blue-700" size={28} />
        <span className="text-sm font-black text-blue-800">{file ? file.name : "Selecionar arquivo .xlsx"}</span>
        <span className="mt-1 text-xs font-bold text-slate-500">Page1 · Código, Nome Cliente, Tipo, Telefone, UF, Municipio, Ultima Compra</span>
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError("");
            setResult(null);
          }}
        />
      </label>

      {error && <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}
      {result && (
        <div className="mt-4 rounded-3xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          <p className="font-black">Importação concluída</p>
          <p>{result.rows} linhas processadas · {result.created} novos · {result.updated} atualizados · {result.unchanged} ignorados iguais.</p>
          {result.updatedFields > 0 && <p>{result.updatedFields} campos diferentes foram atualizados.</p>}
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-2xl bg-slate-100 px-4 py-2 font-black text-slate-600 transition hover:bg-slate-200">Cancelar</button>
        <button type="button" disabled={loading} onClick={runImport} className="rounded-2xl bg-blue-700 px-4 py-2 font-black text-white transition hover:bg-blue-800 disabled:opacity-60">
          {loading ? "Importando..." : "Importar"}
        </button>
      </div>
    </CenteredModal>
  );
}

function ClienteModal({ client, profiles, callSchedules, onSave, onClose, onRequestSchedule }: {
  client: SalesClient;
  profiles: Profile[];
  callSchedules: CallSchedule[];
  onSave: (c: SalesClient) => void;
  onClose: () => void;
  onRequestSchedule: (c: SalesClient) => void;
}) {
  const [tab, setTab] = useState<"dados" | "propostas">("dados");
  const [form, setForm] = useState(normalizeSalesClient(client));
  const hasSchedule = callSchedules.some((s) => s.clientId === client.id && s.active);
  const bestProposal = clientBestProposalValue(form);
  const openProposalTotal = clientOpenProposalTotal(form);
  const bestProposalItem = form.proposals.reduce<SalesProposal | null>((best, proposal) => {
    if (!best || (proposal.value ?? 0) > (best.value ?? 0)) return proposal;
    return best;
  }, null);

  function addProposal() {
    const p: SalesProposal = { id: crypto.randomUUID(), title: "", value: 0, status: "rascunho", createdAt: new Date().toISOString(), notes: "" };
    setForm((f) => ({ ...f, proposals: [...f.proposals, p] }));
  }

  function updateProposal(id: string, patch: Partial<SalesProposal>) {
    setForm((f) => ({ ...f, proposals: f.proposals.map((p) => p.id === id ? { ...p, ...patch } : p) }));
  }

  function removeProposal(id: string) {
    setForm((f) => ({ ...f, proposals: f.proposals.filter((p) => p.id !== id) }));
  }

  return (
    <CenteredModal close={onClose} panelClassName="rounded-[32px] border-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black">{form.name || "Novo cliente"}</h2>
          <button type="button" onClick={onClose} className="rounded-2xl p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
        </div>
        <div className="flex gap-2 mb-4">
          {(["dados", "propostas"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`rounded-2xl px-4 py-2 text-sm font-black transition ${tab === t ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}>
              {t === "dados" ? "Dados" : `Propostas (${form.proposals.length})`}
            </button>
          ))}
        </div>
        <div className="mb-4 grid gap-3 rounded-3xl border border-blue-100 bg-blue-50/70 p-4 md:grid-cols-3">
          <div>
            <p className="text-xs font-black uppercase text-blue-600">Maior proposta</p>
            <p className="text-lg font-black text-slate-900">{bestProposal > 0 ? formatCurrency(bestProposal) : "Sem proposta"}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-blue-600">Total em aberto</p>
            <p className="text-lg font-black text-slate-900">{openProposalTotal > 0 ? formatCurrency(openProposalTotal) : "R$ 0,00"}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-blue-600">Status principal</p>
            <p className="text-lg font-black text-slate-900">{bestProposalItem ? proposalStatusLabel[bestProposalItem.status] : "Sem proposta"}</p>
          </div>
        </div>
        {tab === "dados" && (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">Código</label>
              <input value={form.externalCode} onChange={(e) => setForm((f) => ({ ...f, externalCode: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" placeholder="000343" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">Tipo</label>
              <input value={form.clientType} onChange={(e) => setForm((f) => ({ ...f, clientType: e.target.value.toUpperCase() }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" placeholder="PJ ou PF" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-600 mb-1">Nome Cliente *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" placeholder="Nome do contato" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">Empresa</label>
              <input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" placeholder="Nome da empresa / oficina" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">Telefone</label>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" placeholder="(41) 9xxxx-xxxx" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">E-mail</label>
              <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" placeholder="email@exemplo.com" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">Segmento</label>
              <input value={form.segment} onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" placeholder="ex: Diesel veicular, Agrícola..." />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">UF</label>
              <input value={form.stateUf} onChange={(e) => setForm((f) => ({ ...f, stateUf: e.target.value.toUpperCase() }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" maxLength={2} placeholder="RS" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">Município</label>
              <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" placeholder="Carazinho" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">Última Compra</label>
              <input type="date" value={form.lastPurchaseAt} onChange={(e) => setForm((f) => ({ ...f, lastPurchaseAt: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as SalesClientStatus }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 bg-white">
                {(["lead", "cliente", "inativo"] as SalesClientStatus[]).map((s) => (
                  <option key={s} value={s}>{salesClientStatusLabel[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">Origem</label>
              <select value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as SalesClientSource }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 bg-white">
                {(["instagram", "youtube", "indicacao", "site", "manual", "outros"] as SalesClientSource[]).map((s) => (
                  <option key={s} value={s}>{salesSourceLabel[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">Responsável</label>
              <select value={form.assignedTo} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 bg-white">
                <option value="">Sem responsável</option>
                {profiles.filter((p) => p.active).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-600 mb-1">Observações</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 resize-none" placeholder="Anotações sobre este cliente..." />
            </div>
            {!hasSchedule && form.phone && (
              <div className="md:col-span-2 rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="font-black text-emerald-800 text-sm">Adicionar à Agenda de Ligações</p>
                <button type="button"
                  onClick={() => { onSave({ ...form }); onRequestSchedule({ ...form }); }}
                  className="mt-2 rounded-2xl bg-white border border-emerald-200 px-3 py-2 text-sm font-black text-emerald-700 hover:bg-emerald-100 transition">
                  Agendar ligação
                </button>
              </div>
            )}
          </div>
        )}
        {tab === "propostas" && (
          <div className="space-y-3">
            {form.proposals.map((p) => (
              <div key={p.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <div className="grid gap-2 md:grid-cols-2">
                  <input value={p.title} onChange={(e) => updateProposal(p.id, { title: e.target.value })}
                    placeholder="Título da proposta" className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
                  <input type="number" value={p.value || ""} onChange={(e) => updateProposal(p.id, { value: Number(e.target.value) })}
                    placeholder="Valor (R$)" className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
                  <select value={p.status} onChange={(e) => updateProposal(p.id, { status: e.target.value as SalesProposal["status"] })}
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 bg-white">
                    {(Object.keys(proposalStatusLabel) as SalesProposal["status"][]).map((s) => (
                      <option key={s} value={s}>{proposalStatusLabel[s]}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => removeProposal(p.id)} className="rounded-2xl bg-rose-50 px-3 py-2 text-sm font-black text-rose-600 hover:bg-rose-100 transition">Remover</button>
                  <div className="md:col-span-2">
                    <textarea value={p.notes} onChange={(e) => updateProposal(p.id, { notes: e.target.value })} rows={2}
                      placeholder="Observações da proposta..." className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 resize-none" />
                  </div>
                </div>
              </div>
            ))}
            <button type="button" aria-label="Adicionar proposta" onClick={addProposal} className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-black text-slate-500 hover:border-blue-400 hover:text-blue-600 transition w-full justify-center">
              <Plus size={16} /> Adicionar proposta
            </button>
          </div>
        )}
        <div className="mt-5 flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="rounded-2xl bg-slate-100 px-4 py-2 font-black text-slate-600 transition hover:bg-slate-200">Cancelar</button>
          <button type="button" onClick={() => onSave(form)} className="rounded-2xl bg-blue-700 px-4 py-2 font-black text-white transition hover:bg-blue-800">Salvar</button>
        </div>
    </CenteredModal>
  );
}

// ─── Ligações ─────────────────────────────────────────────────────────────────

type CallViewMode = "frequency" | "urgency" | "outcome";

const CALL_COLUMNS: { id: string; name: string; frequency: CallFrequency; color: string }[] = [
  { id: "calls-daily",    name: "Diário",    frequency: "daily",    color: "#dbeafe" },
  { id: "calls-weekly",   name: "Semanal",   frequency: "weekly",   color: "#dcfce7" },
  { id: "calls-biweekly", name: "Quinzenal", frequency: "biweekly", color: "#fef3c7" },
  { id: "calls-monthly",  name: "Mensal",    frequency: "monthly",  color: "#e9d5ff" }
];

const URGENCY_COLUMNS: { id: string; name: string; color: string; emoji: string }[] = [
  { id: "overdue", name: "Atrasado",       color: "#fee2e2", emoji: "🔴" },
  { id: "today",   name: "Hoje",           color: "#fef3c7", emoji: "🟡" },
  { id: "week",    name: "Próximos 7 dias",color: "#dcfce7", emoji: "🟢" },
  { id: "future",  name: "Futuros",        color: "#dbeafe", emoji: "📅" },
];

const OUTCOME_COLUMNS: { id: string; name: string; color: string; outcomes: string[] }[] = [
  { id: "none",    name: "Nunca ligado",  color: "#f1f5f9", outcomes: [] },
  { id: "no-ans",  name: "Não atendeu",  color: "#fee2e2", outcomes: ["Não atendeu"] },
  { id: "think",   name: "Vai pensar",   color: "#fef3c7", outcomes: ["Vai pensar"] },
  { id: "return",  name: "Retornar",     color: "#e0f2fe", outcomes: ["Retornar"] },
  { id: "inter",   name: "Interessado",  color: "#dcfce7", outcomes: ["Interessado"] },
  { id: "closed",  name: "Fechou pedido",color: "#e9d5ff", outcomes: ["Fechou pedido"] },
];

function callDaysDiff(dateStr: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const ms = new Date(dateStr + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime();
  return Math.round(ms / 86400000);
}

function urgencyColumnId(nextCallAt: string): string {
  const diff = callDaysDiff(nextCallAt);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 7) return "week";
  return "future";
}

function outcomeColumnId(schedule: CallSchedule): string {
  if (schedule.callHistory.length === 0) return "none";
  const last = schedule.callHistory[0].outcome;
  if (last === "Não atendeu") return "no-ans";
  if (last === "Vai pensar") return "think";
  if (last === "Retornar") return "return";
  if (last === "Interessado") return "inter";
  if (last === "Fechou pedido") return "closed";
  return "none";
}

// ─── Funil Comercial — constantes e helpers ───────────────────────────────────

const DEFAULT_SALES_FUNNEL_STAGES: SalesFunnelStage[] = [
  { id: "lead",     name: "Lead",          color: "#64748b", emoji: "🎯", order: 1, halfWidth: false },
  { id: "contato",  name: "Contato feito", color: "#3b82f6", emoji: "📞", order: 2, halfWidth: false },
  { id: "proposta", name: "Proposta",      color: "#f59e0b", emoji: "📋", order: 3, halfWidth: false },
  { id: "fechado",  name: "Fechado",       color: "#22c55e", emoji: "✅", order: 4, halfWidth: true  },
  { id: "perdido",  name: "Perdido",       color: "#ef4444", emoji: "❌", order: 5, halfWidth: true  },
];

function clientFunnelStage(client: SalesClient): string {
  return client.salesFunnelStage || "lead";
}

function clientBestProposalValue(client: SalesClient): number {
  if (!client.proposals.length) return 0;
  return Math.max(...client.proposals.map((p) => p.value ?? 0));
}

function clientOpenProposalTotal(client: SalesClient): number {
  return client.proposals
    .filter((proposal) => proposal.status !== "perdida")
    .reduce((sum, proposal) => sum + (proposal.value ?? 0), 0);
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function SalesPipelineClientCard({ client, onOpen }: { client: SalesClient; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `sales-client:${client.id}` });
  const value = clientBestProposalValue(client);
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`w-full min-w-0 rounded-2xl bg-white px-3 py-2.5 text-left shadow-sm cursor-grab active:cursor-grabbing transition hover:shadow-md border border-white/80 ${isDragging ? "z-50 opacity-80 ring-2 ring-blue-400" : ""}`}
    >
      <p className="truncate text-sm font-black">{pipelineName(client.name)}</p>
      {client.company && <p className="text-xs font-bold text-slate-500 truncate">{client.company}</p>}
      {value > 0 && <p className="text-xs font-black text-blue-700 mt-1">{formatCurrency(value)}</p>}
    </button>
  );
}

function SalesPipelineColumn({ stage, clients, totalClients, onOpenClient }: {
  stage: SalesFunnelStage;
  clients: SalesClient[];
  totalClients: number;
  onOpenClient: (client: SalesClient) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `sales-stage:${stage.id}` });
  const colValue = clients.reduce((acc, client) => acc + clientBestProposalValue(client), 0);
  return (
    <div
      ref={setNodeRef}
      className={`w-[214px] min-w-[214px] max-w-[214px] flex-shrink-0 rounded-3xl p-3 transition-all ${isOver ? "ring-2 ring-blue-400 ring-offset-2 scale-[1.01]" : ""}`}
      style={{ backgroundColor: stage.color + "28" }}
    >
      <div className="mb-2">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-black text-slate-700">{stage.emoji} {stage.name}</p>
          <Badge tone="slate">{clients.length}</Badge>
        </div>
        <p className="text-xs font-black text-slate-500 mt-0.5">{clients.length} de {totalClients} clientes</p>
        {colValue > 0 && <p className="text-xs font-black text-blue-700 mt-0.5">{formatCurrency(colValue)}</p>}
      </div>
      <div className="min-h-[140px] space-y-1.5">
        {clients.map((client) => (
          <SalesPipelineClientCard key={client.id} client={client} onOpen={() => onOpenClient(client)} />
        ))}
        {clients.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-3 text-center text-xs font-bold text-slate-400">
            Nenhum cliente
          </p>
        )}
      </div>
    </div>
  );
}

function CallCard({ schedule, onLog, onOpen, onDragStart }: {
  schedule: CallSchedule;
  onLog: () => void;
  onOpen: () => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
}) {
  const urgency = callUrgency(schedule.nextCallAt);
  const lastLog = schedule.callHistory[0];
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="rounded-2xl border border-white/80 bg-white p-3 shadow-sm cursor-grab active:cursor-grabbing transition hover:shadow-md hover:border-blue-200"
      onClick={onOpen}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-base leading-none">
          {urgency === "overdue" ? "🔴" : urgency === "today" ? "🟡" : "🟢"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-black text-sm truncate">{schedule.clientName}</p>
          {schedule.phone && <p className="text-xs font-bold text-slate-500">📞 {schedule.phone}</p>}
          <p className={`text-xs font-black mt-1 ${urgency === "overdue" ? "text-rose-600" : urgency === "today" ? "text-amber-600" : "text-slate-500"}`}>
            Próxima: {formatCallDate(schedule.nextCallAt)}
          </p>
          {lastLog ? (
            <p className="text-xs font-bold text-slate-400 mt-0.5 truncate">
              Última: {formatCallDate(lastLog.date)} · <span className="text-slate-500">{lastLog.outcome}</span>
            </p>
          ) : (
            <p className="text-xs font-bold text-slate-300 mt-0.5">Nenhuma ligação ainda</p>
          )}
        </div>
      </div>
      <div className="mt-2">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onLog(); }}
          className="w-full rounded-xl bg-blue-700 px-2 py-1.5 text-xs font-black text-white transition hover:bg-blue-800"
        >
          Registrar ligação
        </button>
      </div>
    </div>
  );
}

function AgendaModal({ schedule, onSave, onArchive, onRemove, onClose }: {
  schedule: CallSchedule;
  onSave: (s: CallSchedule) => void;
  onArchive: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"config" | "history">("config");
  const [clientName, setClientName] = useState(schedule.clientName);
  const [phone, setPhone] = useState(schedule.phone);
  const [frequency, setFrequency] = useState<CallFrequency>(schedule.frequency);
  const [nextDate, setNextDate] = useState(schedule.nextCallAt);
  const [notes, setNotes] = useState(schedule.notes);

  function save() {
    onSave({ ...schedule, clientName, phone, frequency, nextCallAt: nextDate, notes });
  }

  return (
    <CenteredModal close={onClose} panelClassName="rounded-[32px] border-0 p-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-0">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="text-lg font-black">{schedule.clientName}</h2>
              {schedule.phone && <p className="text-sm font-bold text-slate-500">📞 {schedule.phone}</p>}
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 transition"><X size={18} /></button>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-4 border-b border-slate-100">
            <button type="button" onClick={() => setTab("config")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-black transition border-b-2 -mb-px ${tab === "config" ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              <Pencil size={14} /> Configurações
            </button>
            <button type="button" onClick={() => setTab("history")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-black transition border-b-2 -mb-px ${tab === "history" ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              <Clock size={14} /> Histórico <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-black text-slate-500">{schedule.callHistory.length}</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {tab === "config" ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">Nome</label>
                <input value={clientName} onChange={(e) => setClientName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">Telefone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(41) 9xxxx-xxxx"
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">Frequência</label>
                <div className="flex flex-wrap gap-2">
                  {(["daily", "weekly", "biweekly", "monthly"] as CallFrequency[]).map((f) => (
                    <button key={f} type="button" onClick={() => setFrequency(f)}
                      className={`rounded-2xl px-3 py-2 text-sm font-black transition ${frequency === f ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50"}`}>
                      {callFrequencyLabel[f]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">Próxima ligação</label>
                <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">Observações</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  placeholder="Notas gerais sobre este contato..."
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 resize-none" />
              </div>
            </div>
          ) : (
            <div>
              {schedule.callHistory.length === 0 ? (
                <p className="py-8 text-center text-sm font-bold text-slate-400">Nenhuma ligação registrada ainda.</p>
              ) : (
                <div className="space-y-3">
                  {schedule.callHistory.map((log) => (
                    <div key={log.id} className="rounded-2xl bg-slate-50 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-slate-400">{new Date(log.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                        <span className={`rounded-xl px-2 py-0.5 text-xs font-black ${log.outcome === "Fechou pedido" ? "bg-purple-100 text-purple-700" : log.outcome === "Interessado" ? "bg-green-100 text-green-700" : log.outcome === "Não atendeu" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                          {log.outcome}
                        </span>
                      </div>
                      {log.notes && <p className="text-sm font-bold text-slate-600">{log.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-6 pb-6 pt-2 border-t border-slate-100">
          <button type="button"
            onClick={() => { onArchive(); onClose(); }}
            className="flex items-center gap-1.5 rounded-2xl bg-amber-50 px-3 py-2 text-sm font-black text-amber-700 transition hover:bg-amber-100">
            <Pause size={14} /> Arquivar
          </button>
          <button type="button"
            onClick={() => { if (window.confirm("Excluir esta agenda permanentemente?")) { onRemove(); onClose(); } }}
            className="flex items-center gap-1.5 rounded-2xl bg-rose-50 px-3 py-2 text-sm font-black text-rose-700 transition hover:bg-rose-100">
            <Trash2 size={14} /> Excluir
          </button>
          {tab === "config" && (
            <button type="button" disabled={!clientName.trim()} onClick={() => { save(); onClose(); }}
              className="ml-auto rounded-2xl bg-blue-700 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-800 disabled:opacity-50">
              Salvar
            </button>
          )}
        </div>
    </CenteredModal>
  );
}

function LigacoesSection({ callSchedules, setCallSchedules, salesClients, currentUser, initialFilter, onFilterApplied }: {
  callSchedules: CallSchedule[];
  setCallSchedules: Dispatch<SetStateAction<CallSchedule[]>>;
  salesClients: SalesClient[];
  currentUser: Profile | null;
  initialFilter: "all" | "today" | "overdue";
  onFilterApplied: () => void;
}) {
  const [viewMode, setViewMode] = useState<CallViewMode>("frequency");
  const [ligacoesFilter, setLigacoesFilter] = useState<"minhas" | "todas">("minhas");
  const [logModal, setLogModal] = useState<CallSchedule | null>(null);
  const [agendaModal, setAgendaModal] = useState<CallSchedule | null>(null);
  const [newModal, setNewModal] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<"all" | "today" | "overdue">(initialFilter);

  useEffect(() => {
    if (initialFilter === "all") return;
    setQuickFilter(initialFilter);
    setViewMode("urgency");
    setLigacoesFilter("todas");
    onFilterApplied();
  }, [initialFilter, onFilterApplied]);

  const allActiveSchedules = callSchedules.filter((s) => s.active && !s.archived);
  const visibleSchedules = allActiveSchedules.filter((s) => {
    if (ligacoesFilter === "todas") return true;
    return s.createdBy === currentUser?.id || s.assignedTo === currentUser?.id;
  }).filter((s) => {
    if (quickFilter === "today") return urgencyColumnId(s.nextCallAt) === "today";
    if (quickFilter === "overdue") return urgencyColumnId(s.nextCallAt) === "overdue";
    return true;
  });
  const archivedSchedules = callSchedules.filter((s) => s.active && s.archived);

  function registerCall(schedule: CallSchedule, notes: string, outcome: string, nextDate: string) {
    const log: CallLog = { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), notes, outcome };
    const updated: CallSchedule = { ...schedule, lastCallAt: log.date, nextCallAt: nextDate, callHistory: [log, ...schedule.callHistory] };
    setCallSchedules((prev) => prev.map((s) => s.id === schedule.id ? updated : s));
    setLogModal(null);
  }

  function saveAgenda(updated: CallSchedule) {
    setCallSchedules((prev) => prev.map((s) => s.id === updated.id ? updated : s));
  }

  function archive(id: string) {
    setCallSchedules((prev) => prev.map((s) => s.id === id ? { ...s, archived: true } : s));
  }

  function unarchive(id: string) {
    setCallSchedules((prev) => prev.map((s) => s.id === id ? { ...s, archived: false } : s));
  }

  function remove(id: string) {
    setCallSchedules((prev) => prev.map((s) => s.id === id ? { ...s, active: false } : s));
  }

  function addNew(schedule: CallSchedule) {
    setCallSchedules((prev) => [...prev, schedule]);
    setNewModal(false);
  }

  function handleDrop(scheduleId: string, targetColId: string) {
    const schedule = callSchedules.find((s) => s.id === scheduleId);
    if (!schedule) return;

    if (viewMode === "frequency") {
      const col = CALL_COLUMNS.find((c) => c.id === targetColId);
      if (!col) return;
      setCallSchedules((prev) => prev.map((s) => s.id === scheduleId ? { ...s, frequency: col.frequency } : s));

    } else if (viewMode === "urgency") {
      const today = new Date();
      let newDate: string;
      if (targetColId === "overdue") {
        const d = new Date(today); d.setDate(d.getDate() - 1);
        newDate = d.toISOString().slice(0, 10);
      } else if (targetColId === "today") {
        newDate = today.toISOString().slice(0, 10);
      } else if (targetColId === "week") {
        const d = new Date(today); d.setDate(d.getDate() + 3);
        newDate = d.toISOString().slice(0, 10);
      } else {
        const d = new Date(today); d.setDate(d.getDate() + 14);
        newDate = d.toISOString().slice(0, 10);
      }
      setCallSchedules((prev) => prev.map((s) => s.id === scheduleId ? { ...s, nextCallAt: newDate } : s));

    } else if (viewMode === "outcome") {
      if (targetColId === "none") return;
      const outcomeMap: Record<string, string> = {
        "no-ans": "Não atendeu",
        "think":  "Vai pensar",
        "return": "Retornar",
        "inter":  "Interessado",
        "closed": "Fechou pedido",
      };
      const newOutcome = outcomeMap[targetColId];
      if (!newOutcome) return;
      setCallSchedules((prev) => prev.map((s) => {
        if (s.id !== scheduleId) return s;
        if (s.callHistory.length > 0) {
          const [latest, ...rest] = s.callHistory;
          return { ...s, callHistory: [{ ...latest, outcome: newOutcome }, ...rest] };
        }
        const log: CallLog = { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), notes: "", outcome: newOutcome };
        return { ...s, callHistory: [log], lastCallAt: log.date };
      }));
    }
  }

  const viewModes: { id: CallViewMode; label: string }[] = [
    { id: "frequency", label: "Frequência" },
    { id: "urgency",   label: "Urgência" },
    { id: "outcome",   label: "Desfecho" },
  ];

  function renderCard(s: CallSchedule) {
    return (
      <CallCard
        key={s.id}
        schedule={s}
        onLog={() => setLogModal(s)}
        onOpen={() => setAgendaModal(s)}
        onDragStart={(e) => { e.dataTransfer.setData("scheduleId", s.id); e.dataTransfer.effectAllowed = "move"; }}
      />
    );
  }

  const emptyState = <p className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-4 text-center text-xs font-bold text-slate-400">Nenhum contato</p>;

  const dropProps = (colId: string) => ({
    onDragOver:  (e: React.DragEvent) => { e.preventDefault(); setDragOverCol(colId); },
    onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); },
    onDrop:      (e: React.DragEvent) => { e.preventDefault(); const id = e.dataTransfer.getData("scheduleId"); if (id) handleDrop(id, colId); setDragOverCol(null); },
  });

  function renderColumns() {
    if (viewMode === "frequency") {
      return (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {CALL_COLUMNS.map((col) => {
            const cards = visibleSchedules.filter((s) => s.frequency === col.frequency).sort((a, b) => a.nextCallAt.localeCompare(b.nextCallAt));
            const isOver = dragOverCol === col.id;
            return (
              <div key={col.id} {...dropProps(col.id)}
                className={`rounded-3xl p-4 transition-all ${isOver ? "ring-2 ring-blue-400 ring-offset-2 scale-[1.01]" : ""}`}
                style={{ backgroundColor: col.color }}>
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-black text-slate-700">{col.name}</p>
                  <Badge tone="slate">{cards.length}</Badge>
                </div>
                <div className="space-y-3">{cards.map(renderCard)}{cards.length === 0 && emptyState}</div>
              </div>
            );
          })}
        </div>
      );
    }

    if (viewMode === "urgency") {
      return (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {URGENCY_COLUMNS.map((col) => {
            const cards = visibleSchedules.filter((s) => urgencyColumnId(s.nextCallAt) === col.id).sort((a, b) => a.nextCallAt.localeCompare(b.nextCallAt));
            const isOver = dragOverCol === col.id;
            return (
              <div key={col.id} {...dropProps(col.id)}
                className={`rounded-3xl p-4 transition-all ${isOver ? "ring-2 ring-blue-400 ring-offset-2 scale-[1.01]" : ""}`}
                style={{ backgroundColor: col.color }}>
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-black text-slate-700">{col.emoji} {col.name}</p>
                  <Badge tone="slate">{cards.length}</Badge>
                </div>
                <div className="space-y-3">{cards.map(renderCard)}{cards.length === 0 && emptyState}</div>
              </div>
            );
          })}
        </div>
      );
    }

    // outcome — layout horizontal com scroll
    return (
      <div className="flex gap-4 overflow-x-auto pb-2">
        {OUTCOME_COLUMNS.map((col) => {
          const cards = visibleSchedules.filter((s) => outcomeColumnId(s) === col.id).sort((a, b) => a.nextCallAt.localeCompare(b.nextCallAt));
          const isOver = dragOverCol === col.id;
          return (
            <div key={col.id} {...dropProps(col.id)}
              className={`min-w-[260px] flex-shrink-0 rounded-3xl p-4 transition-all ${isOver ? "ring-2 ring-blue-400 ring-offset-2 scale-[1.01]" : ""}`}
              style={{ backgroundColor: col.color }}>
              <div className="mb-3 flex items-center justify-between">
                <p className="font-black text-slate-700">{col.name}</p>
                <Badge tone="slate">{cards.length}</Badge>
              </div>
              <div className="space-y-3">{cards.map(renderCard)}{cards.length === 0 && emptyState}</div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <Panel title="Ligações">
      {/* Topo */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex rounded-2xl bg-slate-100 p-1 gap-1">
          {viewModes.map((m) => (
            <button key={m.id} type="button" onClick={() => setViewMode(m.id)}
              className={`rounded-xl px-4 py-1.5 text-sm font-black transition ${viewMode === m.id ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex rounded-2xl bg-slate-100 p-1 gap-1">
          {(["minhas", "todas"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setLigacoesFilter(f)}
              className={`rounded-xl px-4 py-1.5 text-sm font-black transition ${ligacoesFilter === f ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {f === "minhas" ? "Minhas" : "Todas"}
            </button>
          ))}
        </div>
        <span className="text-sm font-bold text-slate-400">{visibleSchedules.length} contatos ativos</span>
        {quickFilter !== "all" && (
          <button type="button" onClick={() => setQuickFilter("all")} className="rounded-2xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100">
            Filtro: {quickFilter === "today" ? "Hoje" : "Atrasadas"} · limpar
          </button>
        )}
        <div className="ml-auto">
          <button type="button" onClick={() => setNewModal(true)}
            className="flex items-center gap-2 rounded-2xl bg-blue-700 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-800">
            <Plus size={16} /> Nova agenda
          </button>
        </div>
      </div>

      {/* Colunas */}
      {renderColumns()}

      {/* Arquivados */}
      {archivedSchedules.length > 0 && (
        <div className="mt-6">
          <button type="button" onClick={() => setArchivedOpen((v) => !v)}
            className="flex items-center gap-2 text-sm font-black text-slate-500 hover:text-slate-700 transition mb-3">
            <ChevronDown size={16} className={`transition-transform ${archivedOpen ? "rotate-180" : ""}`} />
            Arquivados ({archivedSchedules.length})
          </button>
          {archivedOpen && (
            <div className="flex flex-wrap gap-3">
              {archivedSchedules.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2">
                  <span className="text-sm font-black text-slate-500">{s.clientName}</span>
                  {s.phone && <span className="text-xs font-bold text-slate-400">📞 {s.phone}</span>}
                  <button type="button" onClick={() => unarchive(s.id)} title="Retomar"
                    className="ml-1 rounded-xl bg-white p-1 text-green-600 shadow-sm transition hover:bg-green-50">
                    <Play size={12} />
                  </button>
                  <button type="button" onClick={() => remove(s.id)} title="Excluir"
                    className="rounded-xl bg-white p-1 text-slate-400 shadow-sm transition hover:bg-rose-50 hover:text-rose-500">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      {logModal && (
        <RegistrarLigacaoModal schedule={logModal} onConfirm={registerCall} onClose={() => setLogModal(null)} />
      )}
      {agendaModal && (
        <AgendaModal
          schedule={agendaModal}
          onSave={saveAgenda}
          onArchive={() => archive(agendaModal.id)}
          onRemove={() => remove(agendaModal.id)}
          onClose={() => setAgendaModal(null)}
        />
      )}
      {newModal && (
        <NovaAgendaModal salesClients={salesClients} currentUser={currentUser} callSchedules={callSchedules} onSave={addNew} onClose={() => setNewModal(false)} />
      )}
    </Panel>
  );
}

function RegistrarLigacaoModal({ schedule, onConfirm, onClose }: {
  schedule: CallSchedule;
  onConfirm: (schedule: CallSchedule, notes: string, outcome: string, nextDate: string) => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("Interessado");
  const [nextDate, setNextDate] = useState(() => nextCallDate(new Date(), schedule.frequency));
  const outcomes = ["Interessado", "Vai pensar", "Retornar", "Fechou pedido", "Não atendeu"];

  return (
    <CenteredModal close={onClose} variant="compact" panelClassName="rounded-[32px] border-0">
        <h2 className="text-lg font-black mb-1">Registrar ligação</h2>
        <p className="text-sm font-bold text-slate-500 mb-4">{schedule.clientName}{schedule.phone ? ` · ${schedule.phone}` : ""}</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-2">Observações da conversa</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} autoFocus
              placeholder="O que foi conversado..." className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-2">Desfecho</label>
            <div className="flex flex-wrap gap-2">
              {outcomes.map((o) => (
                <button key={o} type="button" onClick={() => setOutcome(o)}
                  className={`rounded-2xl px-3 py-2 text-sm font-black transition ${outcome === o ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50"}`}>
                  {o}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1">Próxima ligação</label>
            <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
          </div>
        </div>
        <div className="mt-5 flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="rounded-2xl bg-slate-100 px-4 py-2 font-black text-slate-600 transition hover:bg-slate-200">Cancelar</button>
          <button type="button" onClick={() => onConfirm(schedule, notes, outcome, nextDate)} className="rounded-2xl bg-blue-700 px-4 py-2 font-black text-white transition hover:bg-blue-800">Confirmar</button>
        </div>
    </CenteredModal>
  );
}

function NovaAgendaModal({ salesClients, currentUser, callSchedules, onSave, onClose }: {
  salesClients: SalesClient[];
  currentUser: Profile | null;
  callSchedules: CallSchedule[];
  onSave: (s: CallSchedule) => void;
  onClose: () => void;
}) {
  const [clientId, setClientId] = useState("");
  const [customName, setCustomName] = useState("");
  const [phone, setPhone] = useState("");
  const [frequency, setFrequency] = useState<CallFrequency>("weekly");
  const [firstDate, setFirstDate] = useState(() => new Date().toISOString().slice(0, 10));

  const selectedClient = salesClients.find((c) => c.id === clientId);

  function save() {
    const schedule: CallSchedule = {
      id: crypto.randomUUID(),
      clientId: clientId || "",
      clientName: selectedClient?.name || customName,
      phone: selectedClient?.phone || phone,
      frequency,
      nextCallAt: firstDate,
      callHistory: [],
      assignedTo: currentUser?.id ?? "",
      createdBy: currentUser?.id ?? "",
      active: true,
      archived: false,
      notes: ""
    };
    onSave(schedule);
  }

  return (
    <CenteredModal close={onClose} panelClassName="rounded-[32px] border-0">
        <h2 className="text-lg font-black mb-4">Nova agenda de ligações</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1">Cliente cadastrado (opcional)</label>
            <select value={clientId} onChange={(e) => { setClientId(e.target.value); const c = salesClients.find((x) => x.id === e.target.value); if (c) { setCustomName(c.name); setPhone(c.phone); } }}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 bg-white">
              <option value="">Selecionar cliente...</option>
              {salesClients.filter((c) => c.status !== "inativo" && !callSchedules.some((s) => s.clientId === c.id && s.active)).map((c) => (
                <option key={c.id} value={c.id}>{c.name} {c.company ? `— ${c.company}` : ""}</option>
              ))}
            </select>
          </div>
          {!clientId && (
            <>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">Nome</label>
                <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Nome do contato"
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">Telefone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(41) 9xxxx-xxxx"
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1">Frequência</label>
            <div className="flex flex-wrap gap-2">
              {(["daily", "weekly", "biweekly", "monthly"] as CallFrequency[]).map((f) => (
                <button key={f} type="button" onClick={() => setFrequency(f)}
                  className={`rounded-2xl px-3 py-2 text-sm font-black transition ${frequency === f ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50"}`}>
                  {callFrequencyLabel[f]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1">Primeira ligação</label>
            <input type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
          </div>
        </div>
        <div className="mt-5 flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="rounded-2xl bg-slate-100 px-4 py-2 font-black text-slate-600 transition hover:bg-slate-200">Cancelar</button>
          <button type="button" disabled={!customName && !clientId} onClick={save} className="rounded-2xl bg-blue-700 px-4 py-2 font-black text-white transition hover:bg-blue-800 disabled:opacity-50">Salvar</button>
        </div>
    </CenteredModal>
  );
}

// ─── Funil Comercial (placeholder visual) ────────────────────────────────────

function pipelineName(name: string, max = 20): string {
  if (name.length <= max) return name;
  const sub = name.slice(0, max);
  const cut = sub.lastIndexOf(" ");
  return (cut > 0 ? sub.slice(0, cut) : sub) + "…";
}

// ─── Emoji picker curado (sem biblioteca extra) ───────────────────────────────
const SALES_EMOJIS = [
  "🎯","📞","📋","✅","❌","💼","🤝","💰","📈","🏆",
  "🌟","💡","🔥","⚡","🎉","📊","💎","🚀","📌","🔔",
  "👋","📧","💬","🗓️","⏰","✉️","📱","🖥️","🏢","👔",
  "💵","💳","🎁","🔑","🏅","⭐","✨","🤑","💫","🙌",
  "💪","🎓","👍","🌿","🚗","🏠","😊","🤔","😤","🙏",
];

function SalesFunnelEmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-12 h-10 rounded-2xl border border-slate-200 bg-white text-xl flex items-center justify-center hover:border-blue-400 transition select-none">
        {value || "📌"}
      </button>
      {open && (
        <div className="absolute z-50 top-12 left-0 bg-white border border-slate-200 rounded-3xl shadow-xl p-3 grid grid-cols-10 gap-0.5 w-[280px]">
          {SALES_EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => { onChange(e); setOpen(false); }}
              className="text-lg hover:bg-slate-100 rounded-xl p-1 transition leading-none">
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Linha do funil comercial (sortable) ─────────────────────────────────────
function SalesFunnelStageRow({ stage, index, total, count, value, isHalf, onRemove, onEdit }: {
  stage: SalesFunnelStage;
  index: number;
  total: number;
  count: number;
  value: number;
  isHalf: boolean;
  onRemove: (id: string) => void;
  onEdit: (updated: SalesFunnelStage) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: stage.id });
  const widthPct = 100 - index * (40 / Math.max(total - 1, 1));
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Estado de edição inline
  const [editing, setEditing] = useState(false);
  const [editName,  setEditName]  = useState(stage.name);
  const [editColor, setEditColor] = useState(stage.color);
  const [editEmoji, setEditEmoji] = useState(stage.emoji);
  const [editHalf,  setEditHalf]  = useState(stage.halfWidth);

  function openEdit() {
    setEditName(stage.name); setEditColor(stage.color);
    setEditEmoji(stage.emoji); setEditHalf(stage.halfWidth);
    setEditing(true);
  }
  function saveEdit() {
    if (!editName.trim()) return;
    onEdit({ ...stage, name: editName.trim(), color: editColor, emoji: editEmoji || "📌", halfWidth: editHalf });
    setEditing(false);
  }

  const baseStyle = { transform: CSS.Transform.toString(transform), transition };
  const widthStyle = isHalf ? {} : { width: `${widthPct}%` };

  if (editing) {
    return (
      <div ref={setNodeRef} style={{ ...baseStyle, ...widthStyle }}
        className={`mx-auto rounded-3xl bg-slate-50 border border-slate-200 p-4 flex flex-wrap gap-2 items-end${isHalf ? " flex-1" : ""}`}>
        <SalesFunnelEmojiPicker value={editEmoji} onChange={setEditEmoji} />
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs font-bold text-slate-500 mb-1">Nome</label>
          <input value={editName} onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
            className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Cor</label>
          <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)}
            className="h-10 w-12 rounded-2xl border border-slate-200 bg-white p-1 cursor-pointer" />
        </div>
        <button type="button" onClick={() => setEditHalf((v) => !v)}
          title="Colocar lado a lado com a próxima etapa"
          className={`h-10 px-3 rounded-2xl border text-sm font-bold transition flex items-center gap-1.5 ${editHalf ? "bg-blue-100 border-blue-400 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:border-slate-400"}`}>
          <Columns2 size={15} /> Lado a lado
        </button>
        <button type="button" onClick={saveEdit} disabled={!editName.trim()}
          className="h-10 rounded-2xl bg-blue-700 px-4 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50 transition">
          Salvar
        </button>
        <button type="button" onClick={() => setEditing(false)}
          className="h-10 rounded-2xl bg-slate-100 px-4 text-sm font-black text-slate-600 hover:bg-slate-200 transition">
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div ref={setNodeRef}
      style={{ ...baseStyle, ...widthStyle, backgroundColor: stage.color }}
      className={`flex items-center rounded-3xl text-white shadow group${isHalf ? " flex-1 min-w-0 gap-2 px-3 py-2.5" : " gap-3 px-4 py-3 mx-auto"}`}>
      <button {...attributes} {...listeners} className="rounded-xl bg-white/20 p-1 cursor-grab shrink-0" title="Reordenar">
        <GripVertical size={16} />
      </button>
      <span className={`font-black flex-1${isHalf ? " text-sm" : " text-sm truncate"}`}>{stage.emoji} {stage.name}</span>
      <span className={`font-black shrink-0 ${isHalf ? "text-xs" : "text-sm"}`}>{count} {count === 1 ? "cliente" : "clientes"}</span>
      {value > 0 && <span className="font-bold text-xs opacity-90 shrink-0">{brl(value)}</span>}
      <button type="button" onClick={openEdit}
        className="opacity-0 group-hover:opacity-100 transition rounded-xl bg-white/20 p-1 shrink-0"
        title="Editar etapa">
        <Pencil size={14} />
      </button>
      <button type="button"
        onClick={() => window.confirm(`Excluir etapa "${stage.name}"?`) && onRemove(stage.id)}
        className="opacity-0 group-hover:opacity-100 transition rounded-xl bg-white/20 p-1 shrink-0"
        title="Excluir etapa">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function FunilComercialSection({ salesClients, setSalesClients, salesFunnelStages, setSalesFunnelStages, callSchedules, setCallSchedules, profiles, currentUser }: {
  salesClients: SalesClient[];
  setSalesClients: Dispatch<SetStateAction<SalesClient[]>>;
  salesFunnelStages: SalesFunnelStage[];
  setSalesFunnelStages: Dispatch<SetStateAction<SalesFunnelStage[]>>;
  callSchedules: CallSchedule[];
  setCallSchedules: Dispatch<SetStateAction<CallSchedule[]>>;
  profiles: Profile[];
  currentUser: Profile | null;
}) {
  const [editingClient, setEditingClient] = useState<SalesClient | null>(null);
  const [view, setView] = useState<"pipeline" | "funil">("pipeline");
  const [addingStage, setAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#3b82f6");
  const [newStageEmoji, setNewStageEmoji] = useState("📌");
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [pipelineSearch, setPipelineSearch] = useState("");
  const [schedulingClient, setSchedulingClient] = useState<SalesClient | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const sortedStages = [...salesFunnelStages].sort((a, b) => a.order - b.order);
  const activeClients = salesClients.filter((c) => c.status !== "inativo");
  const normalizedPipelineSearch = normalizeText(pipelineSearch);
  const visiblePipelineClients = activeClients.filter((client) => {
    if (!normalizedPipelineSearch) return true;
    const stage = sortedStages.find((item) => item.id === clientFunnelStage(client));
    return [client.name, client.externalCode, client.company, client.city, client.stateUf, client.phone, stage?.name]
      .some((value) => normalizeText(value ?? "").includes(normalizedPipelineSearch));
  });
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Métricas — usam apenas etapas de "não-final" para pipeline total
  const pipelineStageIds = sortedStages.slice(0, Math.max(sortedStages.length - 2, 1)).map((s) => s.id);
  const pipelineClients = activeClients.filter((c) => pipelineStageIds.includes(clientFunnelStage(c)));
  const pipelineTotal = pipelineClients.reduce((acc, c) => acc + clientBestProposalValue(c), 0);
  const wonProposals = salesClients.flatMap((c) => c.proposals.filter((p) => p.status === "ganha"));
  const ticketMedio = wonProposals.length > 0
    ? wonProposals.reduce((acc, p) => acc + (p.value ?? 0), 0) / wonProposals.length
    : null;

  function addSchedule(client: SalesClient, freq: CallFrequency) {
    const schedule: CallSchedule = {
      id: crypto.randomUUID(), clientId: client.id, clientName: client.name, phone: client.phone,
      frequency: freq, nextCallAt: new Date().toISOString().slice(0, 10),
      callHistory: [], assignedTo: client.assignedTo, createdBy: currentUser?.id ?? "", active: true, archived: false, notes: "",
    };
    setCallSchedules((prev) => [...prev, schedule]);
  }

  function saveSchedule(schedule: CallSchedule) {
    setCallSchedules((prev) => [...prev, schedule]);
    setSchedulingClient(null);
  }

  function addStage() {
    if (!newStageName.trim()) return;
    const stage: SalesFunnelStage = {
      id: crypto.randomUUID(),
      name: newStageName.trim(),
      color: newStageColor,
      emoji: newStageEmoji || "📌",
      order: sortedStages.length + 1,
      halfWidth: false,
    };
    setSalesFunnelStages((prev) => [...prev, stage]);
    setNewStageName(""); setNewStageColor("#3b82f6"); setNewStageEmoji("📌");
    setAddingStage(false);
  }

  function removeStage(id: string) {
    setSalesFunnelStages((prev) => prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i + 1 })));
  }

  function editStage(updated: SalesFunnelStage) {
    setSalesFunnelStages((prev) => prev.map((s) => s.id === updated.id ? updated : s));
  }

  function reorderStages(event: DragEndEvent) {
    const active = String(event.active.id);
    const over = String(event.over?.id ?? "");
    if (!over || active === over) return;
    const next = arrayMove(
      sortedStages,
      sortedStages.findIndex((s) => s.id === active),
      sortedStages.findIndex((s) => s.id === over)
    ).map((s, i) => ({ ...s, order: i + 1 }));
    setSalesFunnelStages(next);
  }

  function handleClientDrop(clientId: string, stageId: string) {
    setSalesClients((prev) => prev.map((c) => c.id === clientId ? { ...c, salesFunnelStage: stageId } : c));
  }

  function handlePipelineDragEnd(event: DragEndEvent) {
    setDragOverStage(null);
    const activeId = String(event.active.id);
    const overId = String(event.over?.id ?? "");
    if (!activeId.startsWith("sales-client:") || !overId.startsWith("sales-stage:")) return;
    const clientId = activeId.replace("sales-client:", "");
    const stageId = overId.replace("sales-stage:", "");
    handleClientDrop(clientId, stageId);
  }

  const colDropProps = (stageId: string) => ({
    onDragOver:  (e: React.DragEvent) => { e.preventDefault(); setDragOverStage(stageId); },
    onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null); },
    onDrop:      (e: React.DragEvent) => { e.preventDefault(); const id = e.dataTransfer.getData("clientId"); if (id) handleClientDrop(id, stageId); setDragOverStage(null); },
  });

  const emptyState = (
    <p className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-3 text-center text-xs font-bold text-slate-400">
      Nenhum cliente
    </p>
  );

  return (
    <Panel title="Funil Comercial">
      {/* Tab switcher */}
      <div className="mb-5 flex rounded-2xl bg-slate-100 p-1 gap-1 w-fit">
        {([{ id: "pipeline", label: "Pipeline" }, { id: "funil", label: "Funil" }] as const).map((v) => (
          <button key={v.id} type="button" onClick={() => setView(v.id)}
            className={`rounded-xl px-4 py-1.5 text-sm font-black transition ${view === v.id ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Aba Pipeline — kanban com drag */}
      {view === "pipeline" && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={pipelineSearch}
              onChange={(event) => setPipelineSearch(event.target.value)}
              placeholder="Buscar cliente, código, telefone, cidade ou etapa..."
              className="min-w-[260px] flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
            />
            {pipelineSearch && (
              <button type="button" onClick={() => setPipelineSearch("")} className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-200">
                Limpar
              </button>
            )}
            <span className="text-sm font-bold text-slate-400">{visiblePipelineClients.length} de {activeClients.length} clientes visíveis</span>
          </div>
          <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handlePipelineDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {sortedStages.map((stage) => {
                const clients = visiblePipelineClients.filter((client) => clientFunnelStage(client) === stage.id);
                return (
                  <SalesPipelineColumn
                    key={stage.id}
                    stage={stage}
                    clients={clients}
                    totalClients={activeClients.filter((client) => clientFunnelStage(client) === stage.id).length}
                    onOpenClient={setEditingClient}
                  />
                );
              })}
            </div>
          </DndContext>
        </>
      )}

      {/* Aba Funil — visual reordenável */}
      {view === "funil" && (
        <div>
          {/* Toolbar */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setAddingStage((v) => !v)}
              className="flex items-center gap-1.5 rounded-2xl bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800 transition">
              <Plus size={16} /> Nova etapa
            </button>
            <div className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-2 text-sm font-bold text-blue-700">
              💡 Arraste as barras para reordenar. No Pipeline, arraste os clientes entre colunas.
            </div>
          </div>

          {/* Form nova etapa */}
          {addingStage && (
            <div className="mx-auto max-w-4xl mb-5 flex flex-wrap gap-2 items-end rounded-3xl bg-slate-50 border border-slate-200 p-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Emoji</label>
                <SalesFunnelEmojiPicker value={newStageEmoji} onChange={setNewStageEmoji} />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-bold text-slate-500 mb-1">Nome</label>
                <input value={newStageName} onChange={(e) => setNewStageName(e.target.value)}
                  placeholder="Ex: Em demonstração" onKeyDown={(e) => e.key === "Enter" && addStage()}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Cor</label>
                <input type="color" value={newStageColor} onChange={(e) => setNewStageColor(e.target.value)}
                  className="h-10 w-12 rounded-2xl border border-slate-200 bg-white p-1 cursor-pointer" />
              </div>
              <button type="button" onClick={addStage} disabled={!newStageName.trim()}
                className="h-10 rounded-2xl bg-blue-700 px-4 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50 transition">
                Adicionar
              </button>
              <button type="button" onClick={() => setAddingStage(false)}
                className="h-10 rounded-2xl bg-slate-100 px-4 text-sm font-black text-slate-600 hover:bg-slate-200 transition">
                Cancelar
              </button>
            </div>
          )}

          {/* Funil visual reordenável */}
          {(() => {
            // Agrupar etapas consecutivas com halfWidth em linhas compartilhadas
            type FunnelRow = SalesFunnelStage | SalesFunnelStage[];
            const funnelRows: FunnelRow[] = [];
            let fi = 0;
            while (fi < sortedStages.length) {
              if (sortedStages[fi].halfWidth) {
                const group: SalesFunnelStage[] = [sortedStages[fi]];
                while (fi + 1 < sortedStages.length && sortedStages[fi + 1].halfWidth) {
                  fi++;
                  group.push(sortedStages[fi]);
                }
                funnelRows.push(group);
              } else {
                funnelRows.push(sortedStages[fi]);
              }
              fi++;
            }
            return (
              <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={reorderStages}>
                <SortableContext items={sortedStages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="mx-auto max-w-4xl space-y-2 mb-8">
                    {funnelRows.map((row, rowIndex) => {
                      if (Array.isArray(row)) {
                        const widthPct = 100 - rowIndex * (40 / Math.max(sortedStages.length - 1, 1));
                        return (
                          <div key={row.map((s) => s.id).join("-")}
                            className="mx-auto flex gap-2"
                            style={{ width: `${widthPct}%` }}>
                            {row.map((stage) => {
                              const count = activeClients.filter((c) => clientFunnelStage(c) === stage.id).length;
                              const value = activeClients.filter((c) => clientFunnelStage(c) === stage.id).reduce((acc, c) => acc + clientBestProposalValue(c), 0);
                              return (
                                <SalesFunnelStageRow key={stage.id}
                                  stage={stage} index={rowIndex} total={sortedStages.length}
                                  count={count} value={value} isHalf={true}
                                  onRemove={removeStage} onEdit={editStage} />
                              );
                            })}
                          </div>
                        );
                      }
                      const count = activeClients.filter((c) => clientFunnelStage(c) === row.id).length;
                      const value = activeClients.filter((c) => clientFunnelStage(c) === row.id).reduce((acc, c) => acc + clientBestProposalValue(c), 0);
                      return (
                        <SalesFunnelStageRow key={row.id}
                          stage={row} index={rowIndex} total={sortedStages.length}
                          count={count} value={value} isHalf={false}
                          onRemove={removeStage} onEdit={editStage} />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            );
          })()}

          {/* 3 chips de resumo */}
          <div className="mx-auto max-w-4xl grid gap-3 md:grid-cols-3">
            {[
              { label: "Pipeline total",    value: brl(pipelineTotal),                            sub: `${pipelineClients.length} cliente${pipelineClients.length !== 1 ? "s" : ""} em negociação` },
              { label: "Propostas ganhas",  value: String(wonProposals.length),                    sub: "propostas com status ganha" },
              { label: "Ticket médio",      value: ticketMedio !== null ? brl(ticketMedio) : "—",  sub: `${wonProposals.length} proposta${wonProposals.length !== 1 ? "s" : ""} ganha${wonProposals.length !== 1 ? "s" : ""}` },
            ].map((m) => (
              <div key={m.label} className="rounded-3xl bg-white px-5 py-4 shadow-sm">
                <p className="text-lg font-black text-slate-800 leading-tight">{m.value}</p>
                <p className="text-xs font-black text-slate-500 mt-0.5">{m.label}</p>
                <p className="text-xs font-bold text-slate-400 mt-0.5">{m.sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {editingClient && (
        <ClienteModal
          client={editingClient}
          profiles={profiles}
          callSchedules={callSchedules}
          onSave={(updated) => {
            setSalesClients((prev) => prev.map((c) => c.id === updated.id ? updated : c));
            setEditingClient(null);
          }}
          onClose={() => setEditingClient(null)}
          onRequestSchedule={(client) => setSchedulingClient(normalizeSalesClient(client))}
        />
      )}
      {schedulingClient && (
        <QuickScheduleModal
          client={schedulingClient}
          currentUser={currentUser}
          profiles={profiles}
          onSave={saveSchedule}
          onClose={() => setSchedulingClient(null)}
        />
      )}
    </Panel>
  );
}

// ─── Metas de Vendas ─────────────────────────────────────────────────────────

function VendasMetasSection({ tasks, setTasks, currentUser, profileById, setModal }: {
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  currentUser: Profile | null;
  profileById: Map<string, Profile>;
  setModal: Dispatch<SetStateAction<ModalState>>;
}) {
  const [newGoalModal, setNewGoalModal] = useState<{ colId: string; freq: TaskResetFrequency } | null>(null);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalScope, setNewGoalScope] = useState<"individual" | "grupo">("individual");

  function openAddGoal(colId: string, freq: TaskResetFrequency) {
    setNewGoalTitle("");
    setNewGoalScope("individual");
    setNewGoalModal({ colId, freq });
  }

  function confirmAddGoal() {
    if (!newGoalModal || !newGoalTitle.trim()) return;
    const { colId, freq } = newGoalModal;
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: newGoalTitle.trim(),
      columnId: colId,
      order: tasks.filter((t) => t.columnId === colId).length + 1,
      priority: "Média",
      progress: "No prazo",
      createdBy: currentUser?.id ?? "",
      assignedTo: newGoalScope === "individual" ? (currentUser ? [currentUser.id] : []) : [],
      relatedTo: "",
      funnelStageId: "",
      dueDate: "",
      description: "",
      checklist: [],
      comments: [],
      attachments: [],
      resetFrequency: freq,
      resetTime: "08:00",
      resetMonthLastDay: false,
      targetValue: 0,
      currentValue: 0,
      unit: ""
    };
    setTasks((prev) => [...prev, newTask]);
    setNewGoalModal(null);
  }

  const isAdminOrGestor = currentUser?.role === "admin" || currentUser?.role === "gestor";

  function isGoalVisible(t: Task): boolean {
    if (isAdminOrGestor) return true;
    if (t.assignedTo.length === 0) return true;
    return t.assignedTo.includes(currentUser?.id ?? "");
  }

  return (
    <Panel title="Metas de Vendas">
      <div className="overflow-x-auto pb-3">
        <div className="flex min-w-full gap-4">
          {VENDAS_GOALS_VIRTUAL_COLUMNS.map((col) => {
            const colTasks = tasks
              .filter((t) => t.columnId === col.id && !t.parentTaskId && isGoalVisible(t))
              .sort((a, b) => a.order - b.order);
            return (
              <div key={col.id} className="flex w-72 shrink-0 flex-col gap-3 rounded-3xl p-4" style={{ background: col.color }}>
                <div className="flex items-center justify-between">
                  <p className="font-black text-slate-700">{col.name}</p>
                  <Badge tone="slate">{colTasks.length}</Badge>
                </div>
                {colTasks.map((task) => (
                  <VendasGoalCard key={task.id} task={task} setModal={setModal} setTasks={setTasks} />
                ))}
                <button
                  type="button"
                  onClick={() => openAddGoal(col.id, col.frequency)}
                  className="mt-1 w-full rounded-2xl border border-dashed border-slate-300 bg-white/60 py-2 text-sm font-black text-slate-500 hover:border-blue-400 hover:bg-white hover:text-blue-600 transition"
                >
                  <Plus size={14} className="inline mr-1" />Nova meta
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal nova meta */}
      {newGoalModal && (
        <CenteredModal close={() => setNewGoalModal(null)} panelClassName="rounded-[32px] border-0 max-w-sm">
          <h2 className="text-lg font-black mb-4">Nova meta</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">Nome da meta</label>
              <input
                autoFocus
                type="text"
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") confirmAddGoal(); }}
                placeholder="Ex: Fechar 10 vendas"
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2">Visibilidade</label>
              <div className="flex rounded-2xl bg-slate-100 p-1 gap-1">
                {(["individual", "grupo"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setNewGoalScope(s)}
                    className={`flex-1 rounded-xl py-1.5 text-sm font-black transition ${newGoalScope === s ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                    {s === "individual" ? "🔒 Individual" : "👥 Grupo"}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-400 font-bold">
                {newGoalScope === "individual" ? "Só você e gestores veem esta meta" : "Todos os membros veem esta meta"}
              </p>
            </div>
          </div>
          <div className="mt-5 flex gap-2 justify-end">
            <button type="button" onClick={() => setNewGoalModal(null)} className="rounded-2xl bg-slate-100 px-4 py-2 font-black text-slate-600 transition hover:bg-slate-200">Cancelar</button>
            <button type="button" onClick={confirmAddGoal} disabled={!newGoalTitle.trim()} className="rounded-2xl bg-blue-700 px-4 py-2 font-black text-white transition hover:bg-blue-800 disabled:opacity-40">Criar</button>
          </div>
        </CenteredModal>
      )}
    </Panel>
  );
}

function VendasGoalCard({ task, setModal, setTasks }: { task: Task; setModal: Dispatch<SetStateAction<ModalState>>; setTasks: Dispatch<SetStateAction<Task[]>> }) {
  const [displayValue, setDisplayValue] = useState(task.currentValue ?? 0);
  const adjustTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!adjustTimer.current) setDisplayValue(task.currentValue ?? 0);
  }, [task.currentValue]);

  const target = task.targetValue ?? 0;
  const unit = task.unit || "";
  const status = computeGoalStatus({ ...task, currentValue: displayValue });
  const colors = goalStatusColors(status.kind);

  function adjust(delta: number, event: React.MouseEvent) {
    event.stopPropagation();
    const step = event.shiftKey ? 10 * delta : delta;
    const newValue = Math.max(0, displayValue + step);
    setDisplayValue(newValue);
    if (adjustTimer.current) clearTimeout(adjustTimer.current);
    adjustTimer.current = window.setTimeout(() => {
      adjustTimer.current = null;
      setTasks((all) => all.map((t) => t.id === task.id ? { ...t, currentValue: newValue } : t));
    }, 500);
  }

  return (
    <article
      onClick={() => setModal({ kind: "task", id: task.id })}
      className="cursor-pointer rounded-3xl border border-slate-100 bg-white p-4 shadow-sm hover:border-blue-200 hover:shadow-md transition"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="min-w-0 flex-1 font-black text-sm">{task.title}</h4>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs" title={task.assignedTo.length > 0 ? "Meta individual" : "Meta de grupo"}>
            {task.assignedTo.length > 0 ? "🔒" : "👥"}
          </span>
          <Badge tone={colors.badge}>{colors.label}</Badge>
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-2xl font-black text-slate-950">{displayValue.toLocaleString("pt-BR")}</span>
        <span className="text-sm font-bold text-slate-400">/ {target.toLocaleString("pt-BR")}{unit ? ` ${unit}` : ""}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full transition-all" style={{ width: `${status.pct}%`, background: colors.bar }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="font-bold text-slate-500">{status.pct.toFixed(0)}%</span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={(e) => adjust(-1, e)} className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-700" title="Diminuir">
            <Minus size={14} />
          </button>
          <button type="button" onClick={(e) => adjust(1, e)} className="grid h-7 w-7 place-items-center rounded-full bg-blue-700 text-white hover:bg-blue-800" title="Aumentar">
            <Plus size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}

/** Extrai o fileId de uma URL do Google Drive (preview ou view) */
function driveFileId(url: string): string | null {
  const m = url.match(/\/file\/d\/([^/?#]+)/) ?? url.match(/[?&]id=([^&#]+)/);
  return m ? m[1] : null;
}

/**
 * Thumbnail para cards de revisao.
 * - Assets externos (Google Drive): busca a miniatura pela rota server-side.
 * - Assets carregados (upload): exibe <img> diretamente.
 */
function ReviewThumb({ asset }: { asset: PostReviewAsset }) {
  const [failed, setFailed] = useState(false);
  const [driveSrc, setDriveSrc] = useState("");

  useEffect(() => {
    if (asset.source !== "external") return;
    const fileId = driveFileId(asset.previewUrl || asset.url);
    if (!fileId) return;
    let active = true;
    let objectUrl = "";
    setFailed(false);
    fetchDriveThumbnailObjectUrl(fileId)
      .then((url) => {
        objectUrl = url;
        if (active) setDriveSrc(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset.source, asset.previewUrl, asset.url]);

  if (asset.source === "external") {
    if (driveSrc && !failed) {
      return (
        <img
          src={driveSrc}
          alt={asset.name}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      );
    }
    return (
      <div className="grid h-full place-items-center gap-1 text-slate-400">
        <HardDrive size={18} />
        <span className="text-[9px] font-bold">Drive</span>
      </div>
    );
  }

  // Asset de upload direto
  const src = asset.previewUrl || asset.url;
  if (src) {
    return <img src={src} alt={asset.name} className="h-full w-full object-cover" onError={() => setFailed(true)} />;
  }
  return (
    <div className="grid h-full place-items-center text-slate-400">
      <File size={16} />
    </div>
  );
}

function ReviewDetailPanel({
  selectedAsset,
  selectedPost,
  profileById,
  openMediaPreview,
  setReviewAssetStatus,
  addReviewComment,
  deletePostReviewAsset,
  setModal,
  onDeleted,
}: {
  selectedAsset: PostReviewAsset;
  selectedPost: EditorialPost | undefined;
  profileById: Map<string, Profile>;
  openMediaPreview: (item: MediaPreviewItem) => void;
  setReviewAssetStatus: (assetId: string, status: ReviewAssetStatus, message?: string) => void;
  addReviewComment: (assetId: string, message: string) => void;
  deletePostReviewAsset: (assetId: string) => void;
  setModal: Dispatch<SetStateAction<ModalState>>;
  onDeleted: () => void;
}) {
  const [adjustmentMessage, setAdjustmentMessage] = useState("");
  const [showAdjustInput, setShowAdjustInput] = useState(false);
  const [comment, setComment] = useState("");

  function requestAdjustments() {
    if (!adjustmentMessage.trim()) return;
    setReviewAssetStatus(selectedAsset.id, "Ajustes solicitados", adjustmentMessage.trim());
    setAdjustmentMessage("");
    setShowAdjustInput(false);
  }

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!comment.trim()) return;
    addReviewComment(selectedAsset.id, comment);
    setComment("");
  }

  function removeAsset() {
    if (!window.confirm("Excluir esta arte de revisão?")) return;
    deletePostReviewAsset(selectedAsset.id);
    onDeleted();
  }

  return (
    <div className="rounded-[30px] border border-slate-100 bg-slate-50 p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-blue-700">Arte para revisão</p>
          <h3 className="mt-1 text-xl font-black">{selectedPost?.title ?? selectedAsset.name}</h3>
          <p className="mt-1 text-sm font-bold text-slate-500">Enviado por {profileById.get(selectedAsset.uploadedBy)?.name ?? "Equipe"} em {formatDate(selectedAsset.uploadedAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedPost && <button type="button" onClick={() => setModal({ kind: "post", id: selectedPost.id })} className="rounded-2xl bg-blue-100 px-3 py-2 text-sm font-black text-blue-700">Abrir post</button>}
          <button type="button" onClick={removeAsset} className="rounded-2xl bg-rose-100 px-3 py-2 text-sm font-black text-rose-700">Excluir</button>
        </div>
      </div>
      <button type="button" onClick={() => openMediaPreview(selectedAsset)} className="block w-full overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <MediaPreviewContent item={selectedAsset} />
      </button>
      <div className="mt-2 flex justify-end">
        <FileActionButtons item={selectedAsset} />
      </div>
      <div className="mt-4">
        {selectedAsset.status === "Aprovado" ? (
          showAdjustInput ? (
            <div className="rounded-3xl bg-white p-3">
              <textarea value={adjustmentMessage} onChange={(e) => setAdjustmentMessage(e.target.value)} placeholder="Descreva os ajustes necessários" lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences" className="h-24 w-full resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => { setShowAdjustInput(false); setAdjustmentMessage(""); }} className="flex-1 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-200">Cancelar</button>
                <button type="button" onClick={requestAdjustments} disabled={!adjustmentMessage.trim()} className="flex-1 rounded-2xl bg-rose-600 px-4 py-2 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-400">Enviar</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowAdjustInput(true)} className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 hover:bg-rose-100">Solicitar ajuste</button>
          )
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            <button type="button" onClick={() => setReviewAssetStatus(selectedAsset.id, "Aprovado")} className="rounded-2xl bg-emerald-600 px-4 py-3 font-black text-white">Aprovar</button>
            <div className="rounded-3xl bg-white p-3">
              <textarea value={adjustmentMessage} onChange={(e) => setAdjustmentMessage(e.target.value)} placeholder="Descreva os ajustes necessários" lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences" className="h-24 w-full resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              <button type="button" onClick={requestAdjustments} disabled={!adjustmentMessage.trim()} className="mt-2 w-full rounded-2xl bg-rose-600 px-4 py-2 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-400">Solicitar ajustes</button>
            </div>
          </div>
        )}
      </div>
      <form onSubmit={submitComment} className="mt-4 flex gap-2">
        <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Comentário interno sobre a revisão" lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences" className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
        <button disabled={!comment.trim()} className="rounded-2xl bg-blue-700 px-4 text-white disabled:bg-slate-200"><MessageSquare size={16} /></button>
      </form>
      <div className="mt-4 space-y-2">
        {selectedAsset.comments.map((item) => (
          <div key={item.id} className="rounded-2xl bg-white p-3">
            <p className="text-sm font-black">{profileById.get(item.authorId)?.name ?? "Equipe"}</p>
            <p className="mt-1 text-sm text-slate-600">{item.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewsPage({
  assets,
  posts,
  profileById,
  channelById,
  setModal,
  openMediaPreview,
  setReviewAssetStatus,
  addReviewComment,
  deletePostReviewAsset
}: {
  assets: PostReviewAsset[];
  posts: EditorialPost[];
  profiles: Profile[];
  profileById: Map<string, Profile>;
  channelById: Map<string, Channel>;
  setModal: Dispatch<SetStateAction<ModalState>>;
  openMediaPreview: (item: MediaPreviewItem) => void;
  setReviewAssetStatus: (assetId: string, status: ReviewAssetStatus, message?: string) => void;
  addReviewComment: (assetId: string, message: string) => void;
  deletePostReviewAsset: (assetId: string) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewMode, setViewMode] = useState<"Calendário" | ReviewAssetStatus | "Todos">("Calendário");
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  });
  const [selectedAssetId, setSelectedAssetId] = useState(assets[0]?.id ?? "");

  const days = makeWeek(weekStart);

  const filteredAssets = assets
    .filter((asset) => viewMode === "Todos" || asset.status === viewMode)
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  const selectedAsset =
    assets.find((asset) => asset.id === selectedAssetId) ??
    (viewMode === "Calendário" ? undefined : filteredAssets[0]);
  const selectedPost = selectedAsset ? posts.find((post) => post.id === selectedAsset.postId) : undefined;

  function prevWeek() {
    setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  }
  function nextWeek() {
    setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  }
  function handleDeleted() {
    const next = filteredAssets.find((a) => a.id !== selectedAssetId);
    setSelectedAssetId(next?.id ?? "");
  }

  const tabs = ["Calendário", "Aguardando revisão", "Aprovado", "Todos"] as const;

  return (
    <div className="space-y-5 animate-task-switch">
      <Panel title="Revisões" action={<Badge tone="amber">{assets.filter((a) => a.status === "Aguardando revisão").length} {assets.filter((a) => a.status === "Aguardando revisão").length === 1 ? "pendente" : "pendentes"}</Badge>}>
        {/* Abas */}
        <div className="mb-5 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button key={tab} type="button" onClick={() => setViewMode(tab)} className={`rounded-2xl px-4 py-2 text-sm font-black transition ${viewMode === tab ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* ── Vista Calendário ── */}
        {viewMode === "Calendário" && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              {/* Navegação de semana */}
              <div className="mb-4 flex items-center gap-3">
                <button type="button" onClick={prevWeek} className="rounded-2xl bg-slate-100 p-2 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700">
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-black text-slate-700">
                  {days[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – {days[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
                <button type="button" onClick={nextWeek} className="rounded-2xl bg-slate-100 p-2 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700">
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Grade 7 colunas */}
              <div className="overflow-x-auto pb-2">
                <div className="grid min-w-[560px] grid-cols-7 gap-2">
                  {/* Headers dos dias */}
                  {days.map((day) => (
                    <div key={day.toISOString()} className={`rounded-2xl p-2 text-center text-xs font-black uppercase ${sameDay(day, today) ? "bg-blue-700 text-white shadow-lg shadow-blue-700/20" : "bg-slate-100 text-slate-600"}`}>
                      {day.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" })}
                    </div>
                  ))}
                  {/* Células com thumbnails */}
                  {days.map((day) => {
                    const dayAssets = assets.filter((asset) => {
                      const post = posts.find((p) => p.id === asset.postId);
                      return post?.publishAt && sameDay(new Date(post.publishAt), day);
                    });
                    return (
                      <div key={day.toISOString()} className={`min-h-[90px] rounded-2xl p-1.5 space-y-1.5 ${sameDay(day, today) ? "bg-blue-50 ring-1 ring-blue-200" : "bg-slate-50"}`}>
                        {dayAssets.map((asset) => (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => setSelectedAssetId(asset.id)}
                            className={`w-full overflow-hidden rounded-xl border-2 transition hover:opacity-80 ${
                              selectedAsset?.id === asset.id
                                ? "border-blue-500 shadow-md"
                                : asset.status === "Aprovado"
                                ? "border-emerald-300"
                                : asset.status === "Ajustes solicitados"
                                ? "border-rose-300"
                                : "border-amber-300"
                            }`}
                          >
                            <div className="aspect-video w-full bg-slate-200 overflow-hidden">
                              <ReviewThumb asset={asset} />
                            </div>
                            <p className="truncate px-1.5 py-1 text-left text-[10px] font-black text-slate-600">
                              {posts.find((p) => p.id === asset.postId)?.title ?? asset.name}
                            </p>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Assets sem data */}
              {(() => {
                const undated = assets.filter((a) => {
                  const post = posts.find((p) => p.id === a.postId);
                  return !post?.publishAt;
                });
                if (!undated.length) return null;
                return (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-black uppercase text-slate-400">Sem data definida</p>
                    <div className="flex flex-wrap gap-2">
                      {undated.map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => setSelectedAssetId(asset.id)}
                          className={`w-24 overflow-hidden rounded-xl border-2 transition hover:opacity-80 ${
                            selectedAsset?.id === asset.id ? "border-blue-500" :
                            asset.status === "Aprovado" ? "border-emerald-300" :
                            asset.status === "Ajustes solicitados" ? "border-rose-300" : "border-amber-300"
                          }`}
                        >
                          <div className="aspect-video w-full overflow-hidden bg-slate-200">
                            <ReviewThumb asset={asset} />
                          </div>
                          <p className="truncate px-1 py-0.5 text-left text-[9px] font-black text-slate-500">{asset.name}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Painel de detalhe */}
            {selectedAsset ? (
              <ReviewDetailPanel
                selectedAsset={selectedAsset}
                selectedPost={selectedPost}
                profileById={profileById}
                openMediaPreview={openMediaPreview}
                setReviewAssetStatus={setReviewAssetStatus}
                addReviewComment={addReviewComment}
                deletePostReviewAsset={deletePostReviewAsset}
                setModal={setModal}
                onDeleted={handleDeleted}
              />
            ) : (
              <div className="grid min-h-80 place-items-center rounded-[30px] bg-slate-50 text-sm font-bold text-slate-400">Selecione uma arte para revisar.</div>
            )}
          </div>
        )}

        {/* ── Vistas de lista ── */}
        {viewMode !== "Calendário" && (
          <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="max-h-[68vh] space-y-3 overflow-y-auto pr-1">
              {filteredAssets.map((asset) => {
                const post = posts.find((item) => item.id === asset.postId);
                return (
                  <button key={asset.id} type="button" onClick={() => setSelectedAssetId(asset.id)} className={`w-full rounded-3xl border p-4 text-left transition ${selectedAsset?.id === asset.id ? "border-blue-400 bg-blue-50 shadow-sm" : "border-slate-100 bg-white hover:border-blue-200"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 font-black">{post?.title ?? asset.name}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{channelById.get(post?.channelId ?? "")?.name ?? "Canal"} · {profileById.get(asset.uploadedBy)?.name ?? "Equipe"}</p>
                      </div>
                      <Badge tone={asset.status === "Aprovado" ? "green" : asset.status === "Ajustes solicitados" ? "red" : "amber"}>{asset.status}</Badge>
                    </div>
                  </button>
                );
              })}
              {!filteredAssets.length && <p className="rounded-3xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-400">Nenhuma revisão nesse filtro.</p>}
            </div>
            {selectedAsset ? (
              <ReviewDetailPanel
                selectedAsset={selectedAsset}
                selectedPost={selectedPost}
                profileById={profileById}
                openMediaPreview={openMediaPreview}
                setReviewAssetStatus={setReviewAssetStatus}
                addReviewComment={addReviewComment}
                deletePostReviewAsset={deletePostReviewAsset}
                setModal={setModal}
                onDeleted={handleDeleted}
              />
            ) : (
              <div className="grid min-h-80 place-items-center rounded-[30px] bg-slate-50 text-sm font-bold text-slate-400">Selecione uma revisão.</div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
function Header({
  activeSection,
  activeArea,
  currentUser,
  profileOpen,
  setProfileOpen,
  uploadProfilePhoto,
  setModal,
  openSection,
  notifications,
  notificationsOpen,
  setNotificationsOpen,
  setNotifications,
  postReviewAssets,
  pendingReviewCount,
  canReviewAssets,
  saveStatus,
  saveError,
  logout,
  realtimeSyncing
}: {
  activeSection: string;
  activeArea: AppArea;
  currentUser: Profile;
  profileOpen: boolean;
  setProfileOpen: Dispatch<SetStateAction<boolean>>;
  uploadProfilePhoto: (profileId: string, file: File) => void;
  setModal: Dispatch<SetStateAction<ModalState>>;
  openSection: (sectionId: string) => void;
  notifications: Notification[];
  notificationsOpen: boolean;
  setNotificationsOpen: Dispatch<SetStateAction<boolean>>;
  setNotifications: Dispatch<SetStateAction<Notification[]>>;
  postReviewAssets: PostReviewAsset[];
  pendingReviewCount: number;
  canReviewAssets: boolean;
  saveStatus: SaveStatus;
  saveError: string;
  logout: () => void;
  realtimeSyncing?: boolean;
}) {
  const title = menu.find((item) => item.sectionId === activeSection)?.label ?? "Painel";
  const areaLabel = appAreas.find((area) => area.id === activeArea)?.label ?? "Marketing";
  const unreadCount = notifications.filter((item) => !item.read).length;
  // Notificações visíveis no painel: não lidas (sempre) + lidas há menos de 1 hora
  const ONE_HOUR = 60 * 60 * 1000;
  const panelNotifications = notifications.filter(
    (n) => !n.read || Date.now() - new Date(n.createdAt).getTime() < ONE_HOUR
  );
  function markNotificationsRead(ids: string[]) {
    const idsToRead = new Set(ids);
    setNotifications((current) => {
      const visibleById = new Map(notifications.map((item) => [item.id, item]));
      const nextById = new Map(current.map((item) => [item.id, item]));
      for (const id of idsToRead) {
        const existing = nextById.get(id);
        if (existing) {
          nextById.set(id, { ...existing, read: true });
          continue;
        }
        const visible = visibleById.get(id);
        if (visible) nextById.set(id, { ...visible, read: true });
      }
      return Array.from(nextById.values());
    });
  }
  function openNotification(notification: Notification) {
    markNotificationsRead([notification.id]);
    setNotificationsOpen(false);
    if (notification.targetKind === "task") {
      setModal({ kind: "task", id: notification.targetId });
      return;
    }
    if (notification.targetKind === "review") {
      const asset = postReviewAssets.find((item) => item.id === notification.targetId);
      if (asset && canReviewAssets) {
        openSection("marketing-revisoes");
        return;
      }
      if (asset) setModal({ kind: "post", id: asset.postId });
      return;
    }
    if (notification.targetKind === "idea") {
      setModal({ kind: "idea", id: notification.targetId });
      return;
    }
    if (notification.targetKind === "campaign") {
      setModal({ kind: "campaign", id: notification.targetId });
      return;
    }
    if (notification.targetKind === "calendar") {
      setModal({ kind: "post", id: notification.targetId });
      return;
    }
    if (notification.targetKind === "metric") {
      setModal({ kind: "metric", id: notification.targetId });
      return;
    }
    if (notification.targetKind === "question") {
      openSection("marketing-banco-duvidas");
      return;
    }
    if (notification.targetKind === "system") return;
    setModal({ kind: "post", id: notification.targetId });
  }
  return (
    <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm font-bold text-blue-700">Gestão Embrepoli · {areaLabel}</p>
        <h2 className="mt-1 text-3xl font-black">{title}</h2>
      </div>
      <div className="flex items-start gap-3">
        {canReviewAssets && pendingReviewCount > 0 && (
          <button
            type="button"
            onClick={() => openSection("marketing-revisoes")}
            className="hidden rounded-3xl border border-amber-200 bg-amber-100 px-4 py-3 text-sm font-black text-amber-800 shadow-sm transition hover:border-amber-300 hover:bg-amber-200 md:block"
            title="Abrir revisões pendentes"
          >
            {pendingReviewCount} {pendingReviewCount === 1 ? "revisão" : "revisões"}
          </button>
        )}
        {saveStatus !== "idle" && (
          <div className={`hidden rounded-2xl px-3 py-2 text-xs font-black md:block ${saveStatus === "error" ? "bg-rose-100 text-rose-700" : saveStatus === "saving" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`} title={saveError || undefined}>
            {saveStatus === "saving" ? saveError || "Salvando..." : saveStatus === "error" ? "Erro ao salvar" : saveError || "Salvo"}
          </div>
        )}
        {realtimeSyncing && saveStatus === "idle" && (
          <div className="hidden items-center gap-1.5 rounded-2xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-600 md:flex">
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
            Sincronizando…
          </div>
        )}
        <div className="relative">
          <button onClick={() => setNotificationsOpen((value) => !value)} className="relative rounded-3xl border border-slate-200 bg-white p-3 shadow-sm" title="Notificações">
            <Bell size={20} className="text-slate-600" />
            {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white">{unreadCount}</span>}
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 z-30 mt-3 w-96 rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl animate-fade-in-up">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-black">Notificações</h3>
                <button onClick={() => markNotificationsRead(panelNotifications.map((n) => n.id))} className="text-xs font-black text-blue-700">Marcar lidas</button>
              </div>
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {panelNotifications.map((notification) => (
                  <button key={notification.id} onClick={() => openNotification(notification)} className={`w-full rounded-2xl p-3 text-left transition hover:bg-blue-50 ${notification.read ? "bg-slate-50" : "bg-blue-50"}`}>
                    <p className={`text-sm font-black ${notification.read ? "text-slate-600" : "text-slate-950"}`}>{notification.title}</p>
                    <p className={`mt-1 line-clamp-2 text-xs font-bold ${notification.read ? "text-slate-400" : "text-slate-500"}`}>{notification.description}</p>
                    <p className="mt-2 text-[11px] font-bold text-slate-400">{formatDate(notification.createdAt)}</p>
                  </button>
                ))}
                {!panelNotifications.length && <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-400">Nenhuma notificação por enquanto.</p>}
              </div>
            </div>
          )}
        </div>
        <div className="relative">
        <button onClick={() => setProfileOpen((value) => !value)} className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <Avatar profile={currentUser} size="sm" />
          <div className="hidden text-left sm:block">
            <p className="text-sm font-black">{currentUser.name}</p>
            <p className="text-xs text-slate-500">{roleLabel[currentUser.role]}</p>
          </div>
          <ChevronDown size={17} className="text-slate-500" />
        </button>
        {profileOpen && (
          <div className="absolute right-0 z-30 mt-3 w-80 rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl animate-fade-in-up">
            <div className="flex items-center gap-3">
              {/* Foto com overlay de câmera no hover */}
              <label className="group relative h-16 w-16 shrink-0 cursor-pointer">
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt={currentUser.name} className="h-16 w-16 rounded-full object-cover ring-2 ring-blue-100" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-700 text-lg font-black text-white ring-2 ring-blue-100">
                    {initials(currentUser.name)}
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <span className="text-2xl transition-transform duration-200 group-hover:scale-125">📷</span>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && uploadProfilePhoto(currentUser.id, event.target.files[0])} />
              </label>
              <div className="min-w-0">
                <p className="truncate font-black">{currentUser.name}</p>
                <p className="truncate text-sm text-slate-500">{currentUser.email}</p>
                <Badge tone="blue">{roleLabel[currentUser.role]}</Badge>
              </div>
            </div>
            <button
              onClick={() => {
                setModal({ kind: "profile" });
                setProfileOpen(false);
              }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700"
            >
              Editar perfil
            </button>
            <button onClick={logout} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-3 py-2 text-sm font-black text-white">
              <LogOut size={16} />
              Sair
            </button>
          </div>
        )}
        </div>
      </div>
    </header>
  );
}

function Dashboard({
  posts,
  tasks,
  campaigns,
  metrics,
  ideas,
  postReviewAssets,
  openSection,
  channels,
  channelById
}: {
  posts: EditorialPost[];
  tasks: Task[];
  campaigns: Campaign[];
  metrics: PostMetric[];
  ideas: Idea[];
  postReviewAssets: PostReviewAsset[];
  openSection: (sectionId: string) => void;
  channels: Channel[];
  channelById: Map<string, Channel>;
}) {
  const [selectedChannelId, setSelectedChannelId] = useState<string>("all");
  const [comparisonPeriod, setComparisonPeriod] = useState<7 | 14 | 30>(7);

  const today = new Date().toISOString().slice(0, 10);

  // ── Cards de resumo ────────────────────────────────────────────────────────
  const publishedPosts = posts.filter((p) => p.status === "Publicado").length;
  const inProductionPosts = posts.filter((p) => ["Produção", "Revisão", "Aprovado", "Agendado"].includes(p.status)).length;
  const pendingReviews = postReviewAssets.filter((a) => a.status === "Aguardando revisão").length;
  const activeCampaigns = campaigns.filter((c) => c.status === "Ativa").length;
  const totalReach = metrics.reduce((s, m) => s + m.reach, 0);
  const totalLeads = metrics.reduce((s, m) => s + m.leads, 0);
  const mktTasks = tasks.filter((t) => !t.parentTaskId && !t.columnId.startsWith("vendas-"));
  const openTasks = mktTasks.filter((t) => !t.columnId.endsWith("-done")).length;
  const tasksOverdue = mktTasks.filter((t) => t.dueDate && t.dueDate < today && !t.columnId.endsWith("-done")).length;

  // ── Widget Métricas ────────────────────────────────────────────────────────
  const filteredMetrics = selectedChannelId === "all" ? metrics : metrics.filter((m) => m.channelId === selectedChannelId);
  const filteredReach = filteredMetrics.reduce((s, m) => s + m.reach, 0);
  const filteredLeads = filteredMetrics.reduce((s, m) => s + m.leads, 0);
  const filteredEngagement = filteredMetrics.length
    ? Math.round(filteredMetrics.reduce((s, m) => s + metricEngagementRate(m), 0) / filteredMetrics.length * 10) / 10
    : 0;

  // Comparação de postagens por período
  const periodStart = new Date(); periodStart.setDate(periodStart.getDate() - comparisonPeriod);
  const prevStart = new Date(periodStart); prevStart.setDate(prevStart.getDate() - comparisonPeriod);
  const periodStartStr = periodStart.toISOString().slice(0, 10);
  const prevStartStr = prevStart.toISOString().slice(0, 10);
  const postsThisPeriod = posts.filter((p) => p.publishAt && p.publishAt.slice(0, 10) >= periodStartStr && p.publishAt.slice(0, 10) <= today).length;
  const postsLastPeriod = posts.filter((p) => p.publishAt && p.publishAt.slice(0, 10) >= prevStartStr && p.publishAt.slice(0, 10) < periodStartStr).length;
  const postsDelta = postsLastPeriod === 0 ? null : Math.round(((postsThisPeriod - postsLastPeriod) / postsLastPeriod) * 100);

  // Mini gráfico: posts por dia no período selecionado
  const chartData = Array.from({ length: comparisonPeriod }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (comparisonPeriod - 1 - i));
    const ds = d.toISOString().slice(0, 10);
    return { name: ds.slice(5), posts: posts.filter((p) => p.publishAt?.slice(0, 10) === ds).length };
  });

  // ── Widget Tarefas ─────────────────────────────────────────────────────────
  const tasksToday = mktTasks.filter((t) => t.dueDate?.slice(0, 10) === today).length;
  const nearestTasks = mktTasks
    .filter((t) => !t.columnId.endsWith("-done") && t.dueDate)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, 2);

  // ── Mini calendário semanal ────────────────────────────────────────────────
  const week = makeWeek(new Date());

  const summaryCards = [
    { label: "Posts publicados", value: publishedPosts, helper: `${posts.length} posts no total`, color: "emerald", onClick: () => openSection("marketing-calendario") },
    { label: "Em produção", value: inProductionPosts, helper: "Produção, revisão e agendados", color: "blue", onClick: () => openSection("marketing-calendario") },
    { label: "Revisões pendentes", value: pendingReviews, helper: "Artes aguardando aprovação", color: "rose", onClick: () => openSection("marketing-revisoes") },
    { label: "Ideias", value: ideas.length, helper: "No banco de ideias", color: "amber", onClick: () => openSection("marketing-ideias") },
    { label: "Campanhas ativas", value: activeCampaigns, helper: `${campaigns.length} campanhas no total`, color: "purple", onClick: () => openSection("marketing-campanhas") },
    { label: "Alcance total", value: formatNumber(totalReach), helper: "Somatório das métricas", color: "cyan", onClick: () => openSection("marketing-metricas") },
    { label: "Leads gerados", value: formatNumber(totalLeads), helper: "Somatório das métricas", color: "green", onClick: () => openSection("marketing-metricas") },
    { label: "Tarefas abertas", value: openTasks, helper: `${tasksOverdue} atrasadas`, color: "slate", onClick: () => openSection("marketing-tarefas") }
  ] as const;

  const colorClasses: Record<typeof summaryCards[number]["color"], string> = {
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    rose: "border-rose-100 bg-rose-50 text-rose-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    purple: "border-purple-100 bg-purple-50 text-purple-700",
    cyan: "border-cyan-100 bg-cyan-50 text-cyan-700",
    green: "border-green-100 bg-green-50 text-green-700",
    slate: "border-slate-100 bg-slate-50 text-slate-700"
  };

  const shortcutButton = (label: string, sectionId: string) => (
    <button type="button" onClick={() => openSection(sectionId)} className="rounded-2xl bg-blue-700 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-800">
      {label}
    </button>
  );

  return (
    <Panel title="Painel">
      {/* 8 cards de resumo */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <button type="button" key={card.label} onClick={card.onClick} className={`rounded-3xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${colorClasses[card.color]}`}>
            <p className="text-sm font-bold text-slate-500">{card.label}</p>
            <p className="mt-1 text-3xl font-black">{card.value}</p>
            <p className="mt-2 text-xs font-bold text-slate-500">{card.helper}</p>
          </button>
        ))}
      </div>

      {/* Widgets — row 1: Tarefas | Métricas */}
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {/* Widget Tarefas */}
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-slate-900">Tarefas</h3>
              <p className="text-sm font-bold text-slate-500">Atividades de marketing</p>
            </div>
            {shortcutButton("Ver tarefas", "marketing-tarefas")}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniMetric label="Abertas" value={openTasks} />
            <MiniMetric label="Para hoje" value={tasksToday} tone="blue" />
            <MiniMetric label="Atrasadas" value={tasksOverdue} tone="red" />
          </div>
          {nearestTasks.length > 0 ? (
            <div className="mt-3 space-y-2">
              {nearestTasks.map((t) => (
                <div key={t.id} className="rounded-3xl border border-slate-100 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="line-clamp-1 font-black text-slate-900">{t.title}</h4>
                    <span className={`shrink-0 text-xs font-black ${t.dueDate! < today ? "text-rose-600" : "text-slate-500"}`}>
                      {new Date(t.dueDate! + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                  {t.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{t.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone={priorityToneMap[t.priority] ?? "slate"}>{t.priority}</Badge>
                    <Badge tone={progressToneMap[t.progress] ?? "slate"}>{t.progress}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm font-bold text-slate-400">
              Nenhuma tarefa com prazo definido.
            </p>
          )}
        </div>

        {/* Widget Métricas */}
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-black text-slate-900">Métricas</h3>
              <p className="text-sm font-bold text-slate-500">Desempenho por canal</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-700 focus:outline-none"
              >
                <option value="all">Todos os canais</option>
                {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {shortcutButton("Ver métricas", "marketing-metricas")}
            </div>
          </div>
          {/* Bloco 1 — MiniMetrics */}
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniMetric label="Alcance" value={formatNumber(filteredReach)} />
            <MiniMetric label="Leads" value={formatNumber(filteredLeads)} tone="green" />
            <MiniMetric label="Engajamento médio" value={`${filteredEngagement}%`} tone="blue" />
          </div>
          {/* Bloco 2 — Postagens com gráfico e comparação */}
          <div className="mt-3 rounded-2xl bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-black text-slate-700">Postagens</p>
              <div className="flex gap-1">
                {([7, 14, 30] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setComparisonPeriod(d)}
                    className={`rounded-xl px-2 py-1 text-xs font-black transition ${comparisonPeriod === d ? "bg-blue-700 text-white" : "text-slate-500 hover:bg-slate-100"}`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            <div className="h-20">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <Area type="monotone" dataKey="posts" stroke="#2563eb" fill="#bfdbfe" dot={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, fontWeight: 700, borderRadius: 12, border: "1px solid #e2e8f0" }}
                    formatter={(value: number) => [value, "Posts"]}
                    labelFormatter={(label) => label}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex items-end justify-between">
              <div>
                <p className="text-2xl font-black text-slate-900">{postsThisPeriod}</p>
                <p className="text-xs font-bold text-slate-500">últimos {comparisonPeriod} dias</p>
              </div>
              {postsDelta !== null ? (
                <p className={`text-sm font-black ${postsDelta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {postsDelta >= 0 ? "↑" : "↓"} {Math.abs(postsDelta)}% vs anterior
                </p>
              ) : (
                <p className="text-xs font-bold text-slate-400">sem dados anteriores</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mini calendário da semana — full-width */}
      <div className="mt-4 rounded-3xl border border-slate-100 bg-slate-50 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-900">Mini calendário da semana</h3>
            <p className="text-sm font-bold text-slate-500">Posts agendados para os próximos 7 dias</p>
          </div>
          {shortcutButton("Ver calendário", "marketing-calendario")}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {week.map((day) => (
            <div key={day.toISOString()} className="min-h-32 rounded-3xl bg-white p-3">
              <p className="text-xs font-black uppercase text-slate-500">
                {day.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" })}
              </p>
              {posts.filter((post) => post.publishAt && sameDay(new Date(post.publishAt), day)).map((post) => (
                <div key={post.id} className="mt-2 rounded-2xl bg-blue-700 p-2 text-xs font-black text-white">
                  {new Date(post.publishAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} {channelById.get(post.channelId)?.name}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function EditorialCalendar(props: {
  posts: EditorialPost[];
  setPosts: Dispatch<SetStateAction<EditorialPost[]>>;
  channels: Channel[];
  campaigns: Campaign[];
  productLines: ProductLine[];
  vehicleTypes: VehicleType[];
  contentTypes: ContentType[];
  funnelStages: FunnelStage[];
  profiles: Profile[];
  calendarDates: CalendarDate[];
  channelById: Map<string, Channel>;
  funnelById: Map<string, FunnelStage>;
  calendarMode: "Semana" | "Mês" | "Ano";
  setCalendarMode: Dispatch<SetStateAction<"Semana" | "Mês" | "Ano">>;
  visibleMonth: Date;
  setVisibleMonth: Dispatch<SetStateAction<Date>>;
  setModal: Dispatch<SetStateAction<ModalState>>;
}) {
  const days = props.calendarMode === "Semana" ? makeWeek(props.visibleMonth) : makeMonth(props.visibleMonth);
  const today = new Date();
  const periodLabel = props.calendarMode === "Semana"
    ? `${formatDateOnly(days[0])} - ${formatDateOnly(days[6])}`
    : props.calendarMode === "Mês"
      ? new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(props.visibleMonth)
      : String(props.visibleMonth.getFullYear());

  function movePeriod(direction: -1 | 1) {
    props.setVisibleMonth((current) => {
      const next = new Date(current);
      if (props.calendarMode === "Semana") next.setDate(next.getDate() + direction * 7);
      if (props.calendarMode === "Mês") next.setMonth(next.getMonth() + direction);
      if (props.calendarMode === "Ano") next.setFullYear(next.getFullYear() + direction);
      return next;
    });
  }

  function goToToday() {
    props.setVisibleMonth(new Date());
    if (props.calendarMode === "Ano") props.setCalendarMode("Mês");
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    if (!activeId.startsWith("post:")) return;
    const postId = activeId.replace("post:", "");
    const target = String(event.over?.id ?? "");
    if (!target.startsWith("day:") && !target.startsWith("hour:")) {
      return;
    }
    const [, dayPart, hourPart] = target.split(":");
    if (!dayPart) return;
    const day = dateFromId(dayPart);
    if (Number.isNaN(day.getTime())) return;
    props.setPosts((current) =>
      current.map((post) => {
        if (post.id !== postId) return post;
        const currentDate = new Date(post.publishAt);
        day.setHours(hourPart ? Number(hourPart) : currentDate.getHours(), hourPart ? 0 : currentDate.getMinutes(), 0, 0);
        return { ...post, publishAt: toDateTimeLocalValue(day) };
      })
    );
  }

  return (
    <Panel
      title="Calendário editorial"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-1 flex items-center gap-2 rounded-2xl bg-slate-100 p-1">
            <button type="button" onClick={() => movePeriod(-1)} className="rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm">‹</button>
            <span className="min-w-36 px-2 text-center text-sm font-black text-slate-700 capitalize">{periodLabel}</span>
            <button type="button" onClick={() => movePeriod(1)} className="rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm">›</button>
          </div>
          <button type="button" onClick={goToToday} className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-100">
            Hoje
          </button>
          <RoundAdd onClick={() => props.setModal({ kind: "post" })} label="Adicionar post" />
          {(["Semana", "Mês", "Ano"] as const).map((mode) => (
            <button key={mode} onClick={() => props.setCalendarMode(mode)} className={`rounded-2xl px-3 py-2 text-sm font-black ${props.calendarMode === mode ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}>
              {mode}
            </button>
          ))}
        </div>
      }
    >
      <div key={`${props.calendarMode}-${props.visibleMonth.toISOString()}`} className="animate-fade-in-up">
        {props.calendarMode === "Ano" ? (
          <YearPicker visibleMonth={props.visibleMonth} setVisibleMonth={props.setVisibleMonth} setCalendarMode={props.setCalendarMode} />
        ) : (
          <DndContext collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
            {props.calendarMode === "Semana" ? (
              <WeekCalendar days={days} today={today} posts={props.posts} calendarDates={props.calendarDates} channelById={props.channelById} funnelById={props.funnelById} setModal={props.setModal} />
            ) : (
              <>
                <div className="mb-3 grid grid-cols-7 gap-2 text-center text-xs font-black uppercase text-slate-500">
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => <span key={day}>{day}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {days.map((day) => (
                    <CalendarDay
                      key={day.toISOString()}
                      day={day}
                      isToday={sameDay(day, today)}
                      isCurrentMonth={day.getMonth() === props.visibleMonth.getMonth() && day.getFullYear() === props.visibleMonth.getFullYear()}
                      onOtherMonthClick={() => props.setVisibleMonth(new Date(day.getFullYear(), day.getMonth(), 1))}
                      calendarDates={props.calendarDates.filter((item) => sameDay(new Date(`${item.date}T12:00:00`), day))}
                      posts={props.posts.filter((post) => sameDay(new Date(post.publishAt), day))}
                      channelById={props.channelById}
                      funnelById={props.funnelById}
                      setModal={props.setModal}
                    />
                  ))}
                </div>
              </>
            )}
          </DndContext>
        )}
      </div>
    </Panel>
  );
}

function CalendarDay({
  day,
  isToday,
  isCurrentMonth,
  onOtherMonthClick,
  calendarDates,
  posts,
  channelById,
  funnelById,
  setModal
}: {
  day: Date;
  isToday: boolean;
  isCurrentMonth: boolean;
  onOtherMonthClick: () => void;
  calendarDates: CalendarDate[];
  posts: EditorialPost[];
  channelById: Map<string, Channel>;
  funnelById: Map<string, FunnelStage>;
  setModal: Dispatch<SetStateAction<ModalState>>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${dateId(day)}` });
  function createPostOnDay() {
    const date = new Date(day);
    date.setHours(9, 0, 0, 0);
    setModal({ kind: "post", date });
  }
  return (
    <div
      ref={setNodeRef}
      onClick={isCurrentMonth ? createPostOnDay : onOtherMonthClick}
      title={isCurrentMonth ? "Criar post neste dia" : "Ir para este mês"}
      className={`min-h-36 cursor-pointer rounded-3xl border p-2 text-left motion-smooth ${!isCurrentMonth ? "opacity-40" : ""} ${isToday ? "border-blue-500 bg-blue-100 ring-2 ring-blue-200" : isOver ? "border-blue-400 bg-blue-50" : "border-slate-100 bg-slate-50 hover:border-blue-200 hover:bg-blue-50/50"}`}
    >
      <p className={`inline-grid h-7 min-w-7 place-items-center rounded-full px-2 text-sm font-black ${isToday ? "bg-blue-700 text-white" : "text-slate-700"}`}>{day.getDate()}</p>
      {calendarDates.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {calendarDates.slice(0, 2).map((item) => (
            <span key={item.id} className="rounded-full px-2 py-0.5 text-[10px] font-black text-white" style={{ backgroundColor: item.color }}>{item.name}</span>
          ))}
          {calendarDates.length > 2 && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-600">+{calendarDates.length - 2}</span>}
        </div>
      )}
      <div className="mt-2 space-y-2">
        {posts.map((post) => (
          <DraggablePost key={post.id} post={post} channel={channelById.get(post.channelId)} stage={funnelById.get(post.funnelStageId)} setModal={setModal} />
        ))}
      </div>
    </div>
  );
}

function WeekCalendar({
  days,
  today,
  posts,
  calendarDates,
  channelById,
  funnelById,
  setModal
}: {
  days: Date[];
  today: Date;
  posts: EditorialPost[];
  calendarDates: CalendarDate[];
  channelById: Map<string, Channel>;
  funnelById: Map<string, FunnelStage>;
  setModal: Dispatch<SetStateAction<ModalState>>;
}) {
  const [showEarlyHours, setShowEarlyHours] = useState(false);
  const [showLateHours, setShowLateHours] = useState(false);
  const earlyHours = Array.from({ length: 8 }, (_, index) => index);
  const mainHours = Array.from({ length: 13 }, (_, index) => index + 8);
  const lateHours = [21, 22, 23];
  const earlyCount = posts.filter((post) => {
    const hour = new Date(post.publishAt).getHours();
    return earlyHours.includes(hour);
  }).length;
  const lateCount = posts.filter((post) => {
    const hour = new Date(post.publishAt).getHours();
    return lateHours.includes(hour);
  }).length;
  const hours = [...(showEarlyHours ? earlyHours : []), ...mainHours, ...(showLateHours ? lateHours : [])];

  return (
    <div className="overflow-x-auto pb-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setShowEarlyHours((value) => !value)} className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
          {showEarlyHours ? "Ocultar horários antes das 8h" : "Mostrar 00h-07h"} {earlyCount > 0 && <span className="ml-1 rounded-full bg-blue-700 px-2 py-0.5 text-white">{earlyCount}</span>}
        </button>
        <button type="button" onClick={() => setShowLateHours((value) => !value)} className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
          {showLateHours ? "Ocultar noite" : "Mostrar 21h-23h"} {lateCount > 0 && <span className="ml-1 rounded-full bg-blue-700 px-2 py-0.5 text-white">{lateCount}</span>}
        </button>
      </div>
      <div className="grid min-w-[980px] grid-cols-[72px_repeat(7,1fr)] gap-2">
        <div />
        {days.map((day) => (
          <div key={day.toISOString()} className={`rounded-2xl p-2 text-center text-xs font-black uppercase ${sameDay(day, today) ? "bg-blue-700 text-white shadow-lg shadow-blue-700/20" : "bg-slate-100 text-slate-600"}`}>
            {day.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" })}
            <div className="mt-1 flex flex-wrap justify-center gap-1 normal-case">
              {calendarDates.filter((item) => sameDay(new Date(`${item.date}T12:00:00`), day)).slice(0, 2).map((item) => (
                <span key={item.id} className="rounded-full px-2 py-0.5 text-[10px] font-black text-white" style={{ backgroundColor: item.color }}>{item.name}</span>
              ))}
            </div>
          </div>
        ))}
        {hours.map((hour) => (
          <HourRow
            key={hour}
            hour={hour}
            days={days}
            today={today}
            posts={posts}
            channelById={channelById}
            funnelById={funnelById}
            setModal={setModal}
          />
        ))}
      </div>
    </div>
  );
}

function HourRow({
  hour,
  days,
  today,
  posts,
  channelById,
  funnelById,
  setModal
}: {
  hour: number;
  days: Date[];
  today: Date;
  posts: EditorialPost[];
  channelById: Map<string, Channel>;
  funnelById: Map<string, FunnelStage>;
  setModal: Dispatch<SetStateAction<ModalState>>;
}) {
  return (
    <>
      <div className="pt-2 text-right text-xs font-black text-slate-400">{String(hour).padStart(2, "0")}:00</div>
      {days.map((day) => (
        <HourCell
          key={`${day.toISOString()}-${hour}`}
          day={day}
          isToday={sameDay(day, today)}
          hour={hour}
          posts={posts.filter((post) => {
            const date = new Date(post.publishAt);
            return sameDay(date, day) && date.getHours() === hour;
          })}
          channelById={channelById}
          funnelById={funnelById}
          setModal={setModal}
        />
      ))}
    </>
  );
}

function HourCell({
  day,
  isToday,
  hour,
  posts,
  channelById,
  funnelById,
  setModal
}: {
  day: Date;
  isToday: boolean;
  hour: number;
  posts: EditorialPost[];
  channelById: Map<string, Channel>;
  funnelById: Map<string, FunnelStage>;
  setModal: Dispatch<SetStateAction<ModalState>>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `hour:${dateId(day)}:${hour}` });
  function createPostOnHour() {
    const date = new Date(day);
    date.setHours(hour, 0, 0, 0);
    setModal({ kind: "post", date });
  }
  return (
    <div ref={setNodeRef} onClick={createPostOnHour} className={`min-h-24 cursor-pointer rounded-2xl border p-2 text-left motion-smooth ${isToday ? "border-blue-200 bg-blue-50" : isOver ? "border-blue-400 bg-blue-50" : "border-slate-100 bg-slate-50 hover:border-blue-200 hover:bg-blue-50/50"}`} title={`Criar post às ${String(hour).padStart(2, "0")}:00`}>
      <div className="space-y-2">
        {posts.map((post) => (
          <DraggablePost key={post.id} post={post} channel={channelById.get(post.channelId)} stage={funnelById.get(post.funnelStageId)} setModal={setModal} />
        ))}
      </div>
    </div>
  );
}

function DraggablePost({ post, channel, stage, setModal }: { post: EditorialPost; channel?: Channel; stage?: FunnelStage; setModal: Dispatch<SetStateAction<ModalState>> }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `post:${post.id}` });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.55 : 1 }}
      onClick={(event) => event.stopPropagation()}
      className={`w-full rounded-2xl bg-white p-2 text-left text-xs shadow-sm ${isDragging ? "opacity-60 ring-2 ring-blue-200" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <button {...attributes} {...listeners} onClick={(event) => event.stopPropagation()} className="rounded-lg bg-slate-100 p-1 text-slate-400 transition hover:bg-blue-100 hover:text-blue-700" title="Arrastar post">
          <GripVertical size={13} />
        </button>
        <button onClick={(event) => { event.stopPropagation(); setModal({ kind: "post", id: post.id }); }} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-1 font-black text-blue-700">
            <span className="h-2 w-2 rounded-full" style={{ background: channel?.color }} />
            {new Date(post.publishAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <p className="mt-1 line-clamp-2 font-black">{post.title}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {stage && <span className="inline-flex rounded-xl px-2 py-0.5 text-[10px] font-black text-white" style={{ background: stage.color }}>{stage.name.split(" - ")[0]}</span>}
            {post.status && postStatusConfig[post.status] && <Badge tone={postStatusConfig[post.status].tone} className="text-[10px]">{postStatusConfig[post.status].label}</Badge>}
          </div>
        </button>
      </div>
    </div>
  );
}

function Tasks(props: {
  tasks: Task[];
  allTasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  taskBoards: TaskBoard[];
  setTaskBoards: Dispatch<SetStateAction<TaskBoard[]>>;
  posts: EditorialPost[];
  setPosts: Dispatch<SetStateAction<EditorialPost[]>>;
  ideas: Idea[];
  currentUser: Profile;
  campaigns: Campaign[];
  channels: Channel[];
  activeTaskBoardId: string;
  setActiveTaskBoardId: Dispatch<SetStateAction<string>>;
  taskColumns: TaskColumn[];
  setTaskColumns: Dispatch<SetStateAction<TaskColumn[]>>;
  profileById: Map<string, Profile>;
  channelById: Map<string, Channel>;
  funnelById: Map<string, FunnelStage>;
  setModal: Dispatch<SetStateAction<ModalState>>;
  createNotifications: (userIds: string[], title: string, description: string, targetKind: Notification["targetKind"], targetId: string) => void;
  addQuickTask: (columnId: string, title: string) => void;
  areaScope?: "marketing" | "vendas";
}) {
  const sensors = useSensors(useSensor(AnyButtonPointerSensor, { activationConstraint: { distance: 7 } }));
  const [taskMenu, setTaskMenu] = useState<{ taskId: string; x: number; y: number } | null>(null);

  function addColumn() {
    const name = window.prompt("Nome da nova coluna");
    if (!name) return;
    props.setTaskColumns((current) => [...current, { id: `${props.activeTaskBoardId}-${slug(name)}-${crypto.randomUUID().slice(0, 6)}`, boardId: props.activeTaskBoardId, name, color: "#dbeafe", order: current.filter((column) => column.boardId === props.activeTaskBoardId).length + 1 }]);
  }

  function addBoard() {
    const name = window.prompt("Nome do novo quadro");
    if (!name) return;
    const rawId = `${slug(name)}-${crypto.randomUUID().slice(0, 6)}`;
    const boardId = props.areaScope === "vendas" ? `vendas-${rawId}` : rawId;
    props.setTaskBoards((current) => [...current, { id: boardId, name, order: current.length + 1, isFixed: false }]);
    props.setTaskColumns((current) => [
      ...current,
      { id: `${boardId}-todo`, boardId, name: "A fazer", color: "#dbeafe", order: 1 },
      { id: `${boardId}-doing`, boardId, name: "Em andamento", color: "#cffafe", order: 2 },
      { id: `${boardId}-review`, boardId, name: "Em revisão", color: "#e0e7ff", order: 3 },
      { id: `${boardId}-done`, boardId, name: "Concluído", color: "#dcfce7", order: 4 }
    ]);
    props.setActiveTaskBoardId(boardId);
  }

  function deleteBoard(board: TaskBoard) {
    if (board.isFixed) return;
    if (!window.confirm(`Excluir a aba "${board.name}" e todos os cards dela?`)) return;
    const columnIds = props.taskColumns.filter((column) => column.boardId === board.id).map((column) => column.id);
    props.setTasks((current) => current.filter((task) => !columnIds.includes(task.columnId)));
    props.setTaskColumns((current) => current.filter((column) => column.boardId !== board.id));
    props.setTaskBoards((current) => current.filter((item) => item.id !== board.id).map((item, index) => ({ ...item, order: index + 1 })));
    if (props.activeTaskBoardId === board.id) {
      const fallback = props.taskBoards.find((b) => b.id !== board.id);
      props.setActiveTaskBoardId(fallback?.id ?? "");
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const rawActiveId = String(event.active.id);
    const overId = String(event.over?.id ?? "");
    if (!overId) return;

    if (rawActiveId.startsWith("column:") && overId.startsWith("column:")) {
      const activeColumnId = rawActiveId.replace("column:", "");
      const overColumnId = overId.replace("column:", "");
      props.setTaskColumns((current) => {
        const sorted = current.filter((column) => column.boardId === props.activeTaskBoardId).slice().sort((a, b) => a.order - b.order);
        const oldIndex = sorted.findIndex((column) => column.id === activeColumnId);
        const newIndex = sorted.findIndex((column) => column.id === overColumnId);
        const reordered = arrayMove(sorted, oldIndex, newIndex).map((column, index) => ({
          ...column,
          order: index + 1
        }));
        return current.map((column) => reordered.find((item) => item.id === column.id) ?? column);
      });
      return;
    }

    if (!rawActiveId.startsWith("task:")) return;
    const activeId = rawActiveId.replace("task:", "");
    props.setTasks((current) => {
      const activeTask = current.find((task) => task.id === activeId);
      if (!activeTask || activeTask.parentTaskId) return current;
      const overTask = overId.startsWith("task:") ? current.find((task) => `task:${task.id}` === overId && !task.parentTaskId) : undefined;
      const targetColumn = overId.startsWith("drop-column:")
        ? overId.replace("drop-column:", "")
        : overId.startsWith("column:")
          ? overId.replace("column:", "")
        : overId.startsWith("task:")
          ? overTask?.columnId
          : undefined;
      if (!targetColumn) return current;
      const targetColumnTasks = current.filter((task) => task.columnId === targetColumn && !task.parentTaskId && task.id !== activeId).sort((a, b) => a.order - b.order);
      const goalsTarget = isGoalColumn(targetColumn) ? GOALS_VIRTUAL_COLUMNS.find((c) => c.id === targetColumn) : undefined;
      const moved = current.map((task) => {
        if (task.id !== activeId) return task;
        const base = { ...task, columnId: targetColumn, order: targetColumnTasks.length + 1 };
        if (goalsTarget && goalsTarget.frequency !== task.resetFrequency) {
          const nextFreq = goalsTarget.frequency;
          return {
            ...base,
            resetFrequency: nextFreq,
            nextResetAt: nextFreq === "none" ? "" : calculateNextResetAt({
              resetFrequency: nextFreq,
              resetTime: base.resetTime || "23:59",
              resetWeekday: base.resetWeekday ?? 0,
              resetMonthDay: base.resetMonthDay ?? 1,
              resetMonthLastDay: base.resetMonthLastDay ?? false
            })
          };
        }
        return base;
      });
      if (overId.startsWith("task:")) {
        const overTaskId = overId.replace("task:", "");
        const columnTasks = moved.filter((task) => task.columnId === targetColumn && !task.parentTaskId);
        const oldIndex = columnTasks.findIndex((task) => task.id === activeId);
        const newIndex = columnTasks.findIndex((task) => task.id === overTaskId);
        if (oldIndex < 0 || newIndex < 0) return moved;
        const reordered = arrayMove(columnTasks, oldIndex, newIndex).map((task, index) => ({ ...task, order: index + 1 }));
        return moved.map((task) => reordered.find((item) => item.id === task.id) ?? task);
      }
      const reordered = moved
        .filter((task) => task.columnId === targetColumn && !task.parentTaskId)
        .sort((a, b) => a.order - b.order)
        .map((task, index) => ({ ...task, order: index + 1 }));
      return moved.map((task) => reordered.find((item) => item.id === task.id) ?? task);
    });
  }

  const sortedBoards = props.taskBoards.slice().sort((a, b) => a.order - b.order);
  const scopedBoards = props.areaScope === "vendas"
    ? sortedBoards.filter((b) => b.id.startsWith("vendas-") && b.id !== "vendas-metas")
    : props.areaScope === "marketing"
      ? sortedBoards.filter((b) => !b.id.startsWith("vendas-"))
      : sortedBoards;
  const goalsActive = isMetasBoardId(props.activeTaskBoardId, props.taskBoards);
  const activeColumns: TaskColumn[] = goalsActive
    ? GOALS_VIRTUAL_COLUMNS.map((c) => ({ id: c.id, boardId: c.boardId, name: c.name, color: c.color, order: c.order }))
    : props.taskColumns.filter((column) => column.boardId === props.activeTaskBoardId).slice().sort((a, b) => a.order - b.order);
  const calendarActive = props.activeTaskBoardId === calendarTaskBoardId;
  const activeTaskMenu = taskMenu ? props.tasks.find((task) => task.id === taskMenu.taskId) : undefined;

  return (
    <Panel title="Tarefas" action={calendarActive ? <RoundAdd onClick={() => props.setModal({ kind: "post" })} label="Adicionar post" /> : goalsActive ? null : <button onClick={addColumn} className="rounded-2xl bg-blue-700 px-4 py-2 text-sm font-black text-white">Nova coluna</button>}>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {scopedBoards.map((board) => (
          <span key={board.id} className={`inline-flex items-center gap-1 rounded-2xl ${props.activeTaskBoardId === board.id ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}>
            <button
              type="button"
              onClick={() => props.setActiveTaskBoardId(board.id)}
              className="px-4 py-2 text-sm font-black"
            >
              {props.areaScope === "vendas" && board.id === "vendas-atividades" ? "Tarefas" : board.name}
            </button>
            {!board.isFixed && (
              <button type="button" onClick={() => deleteBoard(board)} className={`mr-2 rounded-xl p-1 ${props.activeTaskBoardId === board.id ? "hover:bg-blue-800" : "hover:bg-rose-100 hover:text-rose-700"}`} title="Excluir aba">
                <X size={14} />
              </button>
            )}
          </span>
        ))}
        {props.areaScope !== "vendas" && (
          <button
            type="button"
            onClick={() => props.setActiveTaskBoardId(calendarTaskBoardId)}
            className={`rounded-2xl px-4 py-2 text-sm font-black ${calendarActive ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            Calendário
          </button>
        )}
        {props.areaScope !== "vendas" && (
          <button type="button" onClick={addBoard} className="grid h-10 w-10 place-items-center rounded-full bg-blue-100 text-blue-700" title="Novo quadro"><Plus size={18} /></button>
        )}
      </div>
      {calendarActive ? (
        <CalendarPostsKanban posts={props.posts} setPosts={props.setPosts} ideas={props.ideas} currentUser={props.currentUser} campaigns={props.campaigns} channels={props.channels} channelById={props.channelById} setModal={props.setModal} createNotifications={props.createNotifications} />
      ) : (
      <DndContext sensors={sensors} collisionDetection={stableCollisionDetection} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-3">
          <SortableContext items={activeColumns.map((column) => `column:${column.id}`)} strategy={horizontalListSortingStrategy}>
            <div className="flex min-w-full gap-4">
              {activeColumns.map((column) => (
                <SortableTaskColumn
                  key={column.id}
                  column={column}
                  tasks={props.tasks.filter((task) => task.columnId === column.id && !task.parentTaskId).sort((a, b) => a.order - b.order)}
                  profileById={props.profileById}
                  funnelById={props.funnelById}
                  setModal={props.setModal}
                  openTaskMenu={(taskId, x, y) => setTaskMenu({ taskId, x, y })}
                  addQuickTask={props.addQuickTask}
                  setTaskColumns={props.setTaskColumns}
                  setTasks={props.setTasks}
                  allColumns={activeColumns}
                />
              ))}
            </div>
          </SortableContext>
        </div>
      </DndContext>
      )}
      {taskMenu && activeTaskMenu && (
        <TaskQuickMenu
          task={activeTaskMenu}
          columns={activeColumns}
          x={taskMenu.x}
          y={taskMenu.y}
          close={() => setTaskMenu(null)}
          setModal={props.setModal}
          setTasks={props.setTasks}
        />
      )}
    </Panel>
  );
}

function SortableTaskColumn(props: {
  column: TaskColumn;
  tasks: Task[];
  profileById: Map<string, Profile>;
  funnelById: Map<string, FunnelStage>;
  setModal: Dispatch<SetStateAction<ModalState>>;
  addQuickTask: (columnId: string, title: string) => void;
  setTaskColumns: Dispatch<SetStateAction<TaskColumn[]>>;
  setTasks: Dispatch<SetStateAction<Task[]>>;
  allColumns: TaskColumn[];
  openTaskMenu: (taskId: string, x: number, y: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `column:${props.column.id}` });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className="w-80 shrink-0"
    >
      <TaskColumnView {...props} dragHandleProps={{ attributes, listeners }} />
    </div>
  );
}

function TaskColumnView({
  column,
  tasks,
  profileById,
  funnelById,
  setModal,
  addQuickTask,
  setTaskColumns,
  setTasks,
  allColumns,
  openTaskMenu,
  dragHandleProps
}: {
  column: TaskColumn;
  tasks: Task[];
  profileById: Map<string, Profile>;
  funnelById: Map<string, FunnelStage>;
  setModal: Dispatch<SetStateAction<ModalState>>;
  addQuickTask: (columnId: string, title: string) => void;
  setTaskColumns: Dispatch<SetStateAction<TaskColumn[]>>;
  setTasks: Dispatch<SetStateAction<Task[]>>;
  allColumns: TaskColumn[];
  openTaskMenu: (taskId: string, x: number, y: number) => void;
  dragHandleProps: {
    attributes: ReturnType<typeof useSortable>["attributes"];
    listeners: ReturnType<typeof useSortable>["listeners"];
  };
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `drop-column:${column.id}` });
  const [quickTitle, setQuickTitle] = useState("");
  const isGoal = isGoalColumn(column.id);
  return (
    <section ref={setNodeRef} className={`min-h-[540px] rounded-[30px] border p-3 motion-smooth ${isOver ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white"}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isGoal && (
            <button {...dragHandleProps.attributes} {...dragHandleProps.listeners} className="rounded-xl bg-slate-100 p-1 text-slate-400" title="Arrastar coluna">
              <GripVertical size={17} />
            </button>
          )}
          {isGoal ? (
            <h3 className="font-black">{column.name}</h3>
          ) : (
            <input
              value={column.name}
              onChange={(event) => setTaskColumns((current) => current.map((item) => item.id === column.id ? { ...item, name: event.target.value } : item))}
              lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences"
              className="min-w-0 bg-transparent font-black outline-none"
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="slate">{tasks.length}</Badge>
          {!isGoal && (
            <button
              type="button"
              onClick={() => {
                if (allColumns.length <= 1) return;
                if (!window.confirm("Excluir coluna? As tarefas serão movidas para a primeira coluna.")) return;
                const fallback = allColumns.slice().sort((a, b) => a.order - b.order).find((item) => item.id !== column.id);
                if (!fallback) return;
                setTasks((current) => current.map((task) => task.columnId === column.id ? { ...task, columnId: fallback.id } : task));
                setTaskColumns((current) => current.filter((item) => item.id !== column.id).map((item, index) => ({ ...item, order: index + 1 })));
              }}
              className="rounded-xl bg-rose-100 p-1 text-rose-700 motion-smooth hover:bg-rose-200"
              title="Excluir coluna"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!quickTitle.trim()) return;
          addQuickTask(column.id, quickTitle);
          setQuickTitle("");
        }}
        className="mb-3 flex gap-2"
      >
        <input value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} placeholder="+ tarefa rápida" lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences" className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
        <button className="rounded-2xl bg-blue-700 px-3 text-white"><Plus size={16} /></button>
      </form>
      <SortableContext items={tasks.map((task) => `task:${task.id}`)} strategy={verticalListSortingStrategy}>
        <div className={`min-h-80 space-y-3 rounded-[24px] border border-dashed p-2 transition ${isOver ? "border-blue-300 bg-blue-100/50" : "border-transparent"}`}>
          {tasks.map((task) => (
            isGoalColumn(task.columnId)
              ? <SortableGoalCard key={task.id} task={task} setModal={setModal} setTasks={setTasks} openTaskMenu={openTaskMenu} />
              : <SortableTaskCard key={task.id} task={task} profileById={profileById} funnelById={funnelById} setModal={setModal} openTaskMenu={openTaskMenu} />
          ))}
          {!tasks.length && <div className="grid min-h-40 place-items-center rounded-3xl bg-slate-50 text-center text-sm font-bold text-slate-400">{isGoalColumn(column.id) ? "Solte uma meta aqui" : "Solte uma tarefa aqui"}</div>}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableGoalCard({ task, setModal, setTasks, openTaskMenu }: { task: Task; setModal: Dispatch<SetStateAction<ModalState>>; setTasks: Dispatch<SetStateAction<Task[]>>; openTaskMenu: (taskId: string, x: number, y: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `task:${task.id}` });
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const movedPointer = useRef(false);
  const [displayValue, setDisplayValue] = useState(task.currentValue ?? 0);
  const adjustTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!adjustTimer.current) {
      setDisplayValue(task.currentValue ?? 0);
    }
  }, [task.currentValue]);
  const target = task.targetValue ?? 0;
  const unit = task.unit || "";
  const displayTask = { ...task, currentValue: displayValue };
  const status = computeGoalStatus(displayTask);
  const colors = goalStatusColors(status.kind);

  function adjust(delta: number, event: React.MouseEvent) {
    event.stopPropagation();
    const step = event.shiftKey ? 10 * delta : delta;
    const newValue = Math.max(0, displayValue + step);
    setDisplayValue(newValue);
    if (adjustTimer.current) clearTimeout(adjustTimer.current);
    adjustTimer.current = window.setTimeout(() => {
      adjustTimer.current = null;
      setTasks((all) => all.map((t) => t.id === task.id ? { ...t, currentValue: newValue } : t));
    }, 500);
  }

  return (
    <article
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onPointerDownCapture={(event) => { pointerStart.current = { x: event.clientX, y: event.clientY }; movedPointer.current = false; }}
      onPointerMoveCapture={(event) => {
        if (!pointerStart.current) return;
        if (Math.hypot(event.clientX - pointerStart.current.x, event.clientY - pointerStart.current.y) > 6) movedPointer.current = true;
      }}
      onContextMenu={(event) => { event.preventDefault(); if (movedPointer.current) return; openTaskMenu(task.id, event.clientX, event.clientY); }}
      onClick={() => { if (movedPointer.current) return; setModal({ kind: "task", id: task.id }); }}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.55 : 1 }}
      className={`cursor-grab rounded-3xl border bg-white p-4 shadow-sm active:cursor-grabbing ${isDragging ? "border-blue-300 opacity-60 ring-2 ring-blue-200" : "border-slate-100 hover:border-blue-200 hover:shadow-md"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="min-w-0 flex-1 font-black">{task.title}</h4>
        <Badge tone={colors.badge}>{colors.label}</Badge>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-2xl font-black text-slate-950">{displayValue.toLocaleString("pt-BR")}</span>
        <span className="text-sm font-bold text-slate-400">/ {target.toLocaleString("pt-BR")}{unit ? ` ${unit}` : ""}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full transition-all" style={{ width: `${status.pct}%`, background: colors.bar }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="font-bold text-slate-500">{status.pct.toFixed(0)}%</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={(e) => adjust(-1, e)} className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-700" title="Diminuir (Shift+clique = 10)">
            <Minus size={14} />
          </button>
          <button type="button" onClick={(e) => adjust(1, e)} className="grid h-7 w-7 place-items-center rounded-full bg-blue-700 text-white hover:bg-blue-800" title="Aumentar (Shift+clique = 10)">
            <Plus size={14} />
          </button>
        </div>
      </div>
      {task.fixedGoalKey && <div className="mt-2"><Badge tone="purple">Fixa</Badge></div>}
    </article>
  );
}

function SortableTaskCard({ task, profileById, funnelById, setModal, openTaskMenu }: { task: Task; profileById: Map<string, Profile>; funnelById: Map<string, FunnelStage>; setModal: Dispatch<SetStateAction<ModalState>>; openTaskMenu: (taskId: string, x: number, y: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `task:${task.id}` });
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const movedPointer = useRef(false);
  return (
    <article
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onPointerDownCapture={(event) => {
        pointerStart.current = { x: event.clientX, y: event.clientY };
        movedPointer.current = false;
      }}
      onPointerMoveCapture={(event) => {
        if (!pointerStart.current) return;
        const distance = Math.hypot(event.clientX - pointerStart.current.x, event.clientY - pointerStart.current.y);
        if (distance > 6) movedPointer.current = true;
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        if (movedPointer.current) return;
        openTaskMenu(task.id, event.clientX, event.clientY);
      }}
      onClick={() => {
        if (movedPointer.current) return;
        setModal({ kind: "task", id: task.id });
      }}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.55 : 1 }}
      className={`cursor-grab rounded-3xl border bg-slate-50 p-4 shadow-sm active:cursor-grabbing ${isDragging ? "border-blue-300 opacity-60 ring-2 ring-blue-200" : "border-slate-100 hover:border-blue-200 hover:shadow-md"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-xl bg-white p-1 text-slate-400" title="Segure e arraste o card">
          <GripVertical size={17} />
        </span>
        <div className="flex -space-x-2">
          {task.assignedTo.map((id) => <Avatar key={id} profile={profileById.get(id)} size="xs" />)}
        </div>
      </div>
      <div className="mt-3 w-full text-left">
        <div className="flex items-center gap-1.5">
          {task.isPrivate && <span className="text-xs" title="Só você vê esta atividade">🔒</span>}
          <h4 className="font-black">{task.title}</h4>
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-slate-500">{task.description || "Clique para detalhar esta tarefa."}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone={priorityToneMap[task.priority] ?? "slate"}>{task.priority}</Badge>
        <Badge tone={progressToneMap[task.progress] ?? "slate"}>{task.progress}</Badge>
        <FunnelBadge stage={funnelById.get(task.funnelStageId)} />
      </div>
    </article>
  );
}

function TaskQuickMenu({ task, columns, x, y, close, setModal, setTasks }: { task: Task; columns: TaskColumn[]; x: number; y: number; close: () => void; setModal: Dispatch<SetStateAction<ModalState>>; setTasks: Dispatch<SetStateAction<Task[]>> }) {
  return (
    <div className="fixed z-[70] w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl" style={{ left: x, top: y }} onMouseLeave={close}>
      <button type="button" onClick={() => { setModal({ kind: "task", id: task.id }); close(); }} className="block w-full rounded-xl px-3 py-2 text-left text-sm font-black hover:bg-blue-50">Editar</button>
      {!task.fixedGoalKey && (
        <button type="button" onClick={() => { setTasks((current) => current.filter((item) => item.id !== task.id && item.parentTaskId !== task.id)); close(); }} className="block w-full rounded-xl px-3 py-2 text-left text-sm font-black text-rose-700 hover:bg-rose-50">Excluir</button>
      )}
      <div className="my-1 border-t border-slate-100" />
      <p className="px-3 py-1 text-[11px] font-black uppercase text-slate-400">Mover para</p>
      {columns.map((column) => (
        <button
          key={column.id}
          type="button"
          onClick={() => {
            setTasks((current) => current.map((item) => item.id === task.id ? { ...item, columnId: column.id } : item));
            close();
          }}
          className="block w-full rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-blue-50"
        >
          {column.name}
        </button>
      ))}
    </div>
  );
}

function CalendarPostsKanban({ posts, setPosts, ideas, currentUser, campaigns, channels, channelById, setModal, createNotifications }: { posts: EditorialPost[]; setPosts: Dispatch<SetStateAction<EditorialPost[]>>; ideas: Idea[]; currentUser: Profile; campaigns: Campaign[]; channels: Channel[]; channelById: Map<string, Channel>; setModal: Dispatch<SetStateAction<ModalState>>; createNotifications: (userIds: string[], title: string, description: string, targetKind: Notification["targetKind"], targetId: string) => void }) {
  const sensors = useSensors(useSensor(AnyButtonPointerSensor, { activationConstraint: { distance: 7 } }));
  const statuses = [...postStatuses, ...(posts.some((post) => !postStatuses.includes(post.status)) ? ["Outros"] : [])];
  const neutralCampaign = campaigns.find((campaign) => normalizeText(campaign.name) === "campanha neutra");
  const unlinkedIdeas = ideas.filter((idea) => !posts.some((post) => post.ideaId === idea.id)).sort((a, b) => a.order - b.order);

  function statusFor(post: EditorialPost) {
    if (post.status === "Ideia") return "Produção";
    return postStatuses.includes(post.status) ? post.status : "Outros";
  }

  function handleDragEnd(event: DragEndEvent) {
    const rawActiveId = String(event.active.id);
    const overId = String(event.over?.id ?? "");
    if (!overId) return;
    const overPost = overId.startsWith("calendar-post:") ? posts.find((post) => `calendar-post:${post.id}` === overId) : undefined;
    const targetStatus = overId.startsWith("calendar-status:")
      ? overId.replace("calendar-status:", "")
      : overPost
        ? statusFor(overPost)
        : "";
    if (!targetStatus) return;

    if (rawActiveId.startsWith("calendar-idea:")) {
      if (targetStatus === "Ideia") return;
      const ideaId = rawActiveId.replace("calendar-idea:", "");
      const idea = ideas.find((item) => item.id === ideaId);
      if (!idea) return;
      const channel = channels.find((item) => item.id === idea.channelId);
      const publishAt = new Date();
      publishAt.setHours(9, 0, 0, 0);
      const normalizedStatus = targetStatus === "Outros" ? "Produção" : targetStatus;
      const newPostId = crypto.randomUUID();
      setPosts((current) => [{
        id: newPostId,
        ideaId: idea.id,
        templateId: idea.templateId,
        title: idea.title,
        channelId: idea.channelId || channels[0]?.id || "",
        campaignId: neutralCampaign?.id ?? "",
        productLineId: idea.productLineId,
        vehicleTypeId: idea.vehicleTypeId,
        contentTypeId: idea.contentTypeId,
        funnelStageId: idea.funnelStageId,
        createdBy: currentUser.id,
        assignedTo: [],
        status: normalizedStatus,
        format: idea.format || defaultPostFormatForChannel(channel),
        order: current.filter((post) => statusFor(post) === normalizedStatus).length + 1,
        publishAt: publishAt.toISOString().slice(0, 16),
        description: idea.description,
        productionChecklist: []
      }, ...current]);
      return;
    }

    const activeId = rawActiveId.replace("calendar-post:", "");

    setPosts((current) => {
      const activePost = current.find((post) => post.id === activeId);
      if (!activePost) return current;
      if (targetStatus === "Ideia") {
        if (activePost.ideaId) return current.filter((post) => post.id !== activeId);
        return current;
      }
      const normalizedStatus = targetStatus === "Outros" ? activePost.status : targetStatus;
      if (normalizedStatus !== activePost.status) {
        if (normalizedStatus === "Revisão") createNotifications(activePost.assignedTo.filter((id) => id !== currentUser.id), "Post entrou em revisão", activePost.title, "post", activePost.id);
        if (normalizedStatus === "Aprovado") createNotifications([activePost.createdBy, ...activePost.assignedTo].filter((id) => id !== currentUser.id), "Post aprovado", activePost.title, "post", activePost.id);
        if (normalizedStatus === "Publicado") createNotifications([activePost.createdBy, ...activePost.assignedTo].filter((id) => id !== currentUser.id), "Post publicado", activePost.title, "post", activePost.id);
      }
      const targetPosts = current.filter((post) => post.id !== activeId && statusFor(post) === targetStatus).sort((a, b) => (a.order ?? 1) - (b.order ?? 1));
      const moved = current.map((post) => post.id === activeId ? { ...post, status: normalizedStatus, order: targetPosts.length + 1 } : post);
      if (!overPost) {
        const reordered = moved.filter((post) => statusFor(post) === targetStatus).sort((a, b) => (a.order ?? 1) - (b.order ?? 1)).map((post, index) => ({ ...post, order: index + 1 }));
        return moved.map((post) => reordered.find((item) => item.id === post.id) ?? post);
      }
      const columnPosts = moved.filter((post) => statusFor(post) === targetStatus).sort((a, b) => (a.order ?? 1) - (b.order ?? 1));
      const oldIndex = columnPosts.findIndex((post) => post.id === activeId);
      const newIndex = columnPosts.findIndex((post) => post.id === overPost.id);
      if (oldIndex < 0 || newIndex < 0) return moved;
      const reordered = arrayMove(columnPosts, oldIndex, newIndex).map((post, index) => ({ ...post, order: index + 1 }));
      return moved.map((post) => reordered.find((item) => item.id === post.id) ?? post);
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={stableCollisionDetection} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto pb-3">
        <div className="flex min-w-full gap-4">
          {statuses.map((status) => (
            <CalendarStatusColumn key={status} status={status} posts={posts.filter((post) => statusFor(post) === status).sort((a, b) => (a.order ?? 1) - (b.order ?? 1))} ideas={status === "Ideia" ? unlinkedIdeas : []} channelById={channelById} setModal={setModal} />
          ))}
        </div>
      </div>
    </DndContext>
  );
}

function CalendarStatusColumn({ status, posts, ideas, channelById, setModal }: { status: string; posts: EditorialPost[]; ideas: Idea[]; channelById: Map<string, Channel>; setModal: Dispatch<SetStateAction<ModalState>> }) {
  const { setNodeRef, isOver } = useDroppable({ id: `calendar-status:${status}` });
  return (
    <section ref={setNodeRef} className={`min-h-[540px] w-80 shrink-0 rounded-[30px] border p-3 transition ${isOver ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white"}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-black">{status}</h3>
        <Badge tone="slate">{posts.length + ideas.length}</Badge>
      </div>
      <SortableContext items={posts.map((post) => `calendar-post:${post.id}`)} strategy={verticalListSortingStrategy}>
        <div className={`min-h-80 space-y-3 rounded-[24px] border border-dashed p-2 transition ${isOver ? "border-blue-300 bg-blue-100/50" : "border-transparent"}`}>
          {ideas.map((idea) => <DraggableCalendarIdeaCard key={idea.id} idea={idea} channel={channelById.get(idea.channelId)} setModal={setModal} />)}
          {posts.map((post) => <SortableCalendarPostCard key={post.id} post={post} channel={channelById.get(post.channelId)} channelById={channelById} setModal={setModal} />)}
          {!posts.length && !ideas.length && <div className="grid min-h-40 place-items-center rounded-3xl bg-slate-50 text-center text-sm font-bold text-slate-400">Solte um post aqui</div>}
        </div>
      </SortableContext>
    </section>
  );
}

function DraggableCalendarIdeaCard({ idea, channel, setModal }: { idea: Idea; channel?: Channel; setModal: Dispatch<SetStateAction<ModalState>> }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `calendar-idea:${idea.id}` });
  return (
    <article
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => setModal({ kind: "idea", id: idea.id })}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.55 : 1 }}
      className={`cursor-grab rounded-3xl border border-blue-100 bg-blue-50 p-4 shadow-sm transition-[border-color,box-shadow,opacity] active:cursor-grabbing ${isDragging ? "ring-2 ring-blue-200" : "hover:border-blue-300 hover:shadow-md"}`}
    >
      <div className="flex items-center gap-2 text-xs font-black text-blue-700">
        <Lightbulb size={14} />
        Ideia · {channel?.name ?? "Canal"}
      </div>
      <h4 className="mt-2 line-clamp-2 font-black">{idea.title}</h4>
      <p className="mt-2 line-clamp-2 text-sm font-bold text-slate-500">{idea.description || "Arraste para uma coluna para virar post."}</p>
    </article>
  );
}

function SortableCalendarPostCard({ post, channel, channelById, setModal }: { post: EditorialPost; channel?: Channel; channelById: Map<string, Channel>; setModal: Dispatch<SetStateAction<ModalState>> }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `calendar-post:${post.id}` });
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const movedPointer = useRef(false);
  const allChannels = [
    ...(channel ? [channel] : []),
    ...(post.extraChannels ?? []).map((e) => channelById.get(e.channelId)).filter((c): c is Channel => !!c),
  ];
  return (
    <article
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onPointerDownCapture={(event) => {
        pointerStart.current = { x: event.clientX, y: event.clientY };
        movedPointer.current = false;
      }}
      onPointerMoveCapture={(event) => {
        if (!pointerStart.current) return;
        if (Math.hypot(event.clientX - pointerStart.current.x, event.clientY - pointerStart.current.y) > 6) movedPointer.current = true;
      }}
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => {
        if (movedPointer.current) return;
        setModal({ kind: "post", id: post.id });
      }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`cursor-grab rounded-3xl border bg-slate-50 p-4 shadow-sm transition-[border-color,box-shadow,opacity] active:cursor-grabbing ${isDragging ? "border-blue-300 opacity-60 ring-2 ring-blue-200" : "border-slate-100 hover:border-blue-200 hover:shadow-md"}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-black text-blue-700">
        {allChannels.length > 0 ? allChannels.map((ch) => (
          <span key={ch.id} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: ch.color }} />
            {ch.name}
          </span>
        )) : <span>Canal</span>}
        <span className="text-slate-400">·</span>
        <span>{new Date(post.publishAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
      </div>
      <h4 className="mt-2 line-clamp-2 font-black">{post.title}</h4>
      {post.status && postStatusConfig[post.status] && (
        <div className="mt-2">
          <Badge tone={postStatusConfig[post.status].tone}>{postStatusConfig[post.status].label}</Badge>
        </div>
      )}
      <p className="mt-2 line-clamp-2 text-sm font-bold text-slate-500">{post.description || "Clique para editar o post."}</p>
    </article>
  );
}

function Ideas({ ideas, posts, setIdeas, view, setView, activeTab, setActiveTab, channelById, lineById, vehicleTypeById, contentTypeById, funnelById, profileById, setModal }: { ideas: Idea[]; posts: EditorialPost[]; setIdeas: Dispatch<SetStateAction<Idea[]>>; view: "Quadro" | "Lista"; setView: Dispatch<SetStateAction<"Quadro" | "Lista">>; activeTab: "Todos" | "Estatísticas" | Idea["type"]; setActiveTab: Dispatch<SetStateAction<"Todos" | "Estatísticas" | Idea["type"]>>; channelById: Map<string, Channel>; lineById: Map<string, ProductLine>; vehicleTypeById: Map<string, VehicleType>; contentTypeById: Map<string, ContentType>; funnelById: Map<string, FunnelStage>; profileById: Map<string, Profile>; setModal: Dispatch<SetStateAction<ModalState>> }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const tabs: ("Todos" | "Estatísticas" | Idea["type"])[] = ["Todos", ...ideaTypes, "Estatísticas"];
  const sortedIdeas = ideas.slice().sort((a, b) => a.order - b.order);
  const filteredIdeas = sortedIdeas.filter((idea) => activeTab === "Todos" || activeTab === "Estatísticas" || idea.type === activeTab);

  function reorderIdeas(event: DragEndEvent) {
    const activeId = String(event.active.id).replace("idea:", "");
    const overId = String(event.over?.id ?? "").replace("idea:", "");
    if (!activeId || !overId || activeId === overId) return;
    setIdeas((current) => {
      const ordered = current.slice().sort((a, b) => a.order - b.order);
      const oldIndex = ordered.findIndex((idea) => idea.id === activeId);
      const newIndex = ordered.findIndex((idea) => idea.id === overId);
      if (oldIndex < 0 || newIndex < 0) return current;
      const reordered = arrayMove(ordered, oldIndex, newIndex).map((idea, index) => ({ ...idea, order: index + 1 }));
      return current.map((idea) => reordered.find((item) => item.id === idea.id) ?? idea);
    });
  }

  function ideaCard(idea: Idea) {
    return (
      <button key={idea.id} onClick={() => setModal({ kind: "idea", id: idea.id })} className="rounded-3xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={idea.priority === "Alta" ? "red" : "blue"}>{idea.priority}</Badge>
          <Badge tone="slate">#{idea.order}</Badge>
          <Badge tone="cyan">{idea.type}</Badge>
        </div>
        <h3 className="mt-3 font-black">{idea.title}</h3>
        <p className="mt-2 text-sm text-slate-500">{lineById.get(idea.productLineId)?.name} · {vehicleTypeById.get(idea.vehicleTypeId)?.name} · {contentTypeById.get(idea.contentTypeId)?.name} · {channelById.get(idea.channelId)?.name}</p>
        {idea.description && <p className="mt-2 line-clamp-2 text-sm font-bold text-slate-500">{idea.description}</p>}
        <p className="mt-2 text-xs font-bold text-slate-400">Criado por {profileById.get(idea.createdBy)?.name}</p>
        <div className="mt-3"><FunnelBadge stage={funnelById.get(idea.funnelStageId)} /></div>
      </button>
    );
  }

  return (
    <Panel title="Ideias" action={<RoundAdd onClick={() => setModal({ kind: "idea" })} label="Adicionar ideia" />}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-2xl px-4 py-2 text-sm font-black ${activeTab === tab ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="flex rounded-2xl bg-slate-100 p-1">
          {(["Quadro", "Lista"] as const).map((mode) => (
            <button key={mode} type="button" onClick={() => setView(mode)} className={`rounded-xl px-3 py-2 text-sm font-black ${view === mode ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>
              {mode}
            </button>
          ))}
        </div>
      </div>
      {activeTab === "Estatísticas" ? (
        <IdeaStats ideas={ideas} posts={posts} channelById={channelById} lineById={lineById} vehicleTypeById={vehicleTypeById} contentTypeById={contentTypeById} funnelById={funnelById} profileById={profileById} />
      ) : view === "Lista" ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={reorderIdeas}>
          <SortableContext items={filteredIdeas.map((idea) => `idea:${idea.id}`)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {filteredIdeas.map((idea) => <SortableIdeaRow key={idea.id} idea={idea} profileById={profileById} setModal={setModal} />)}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredIdeas.map(ideaCard)}
        </div>
      )}
    </Panel>
  );
}

function SortableIdeaRow({ idea, profileById, setModal }: { idea: Idea; profileById: Map<string, Profile>; setModal: Dispatch<SetStateAction<ModalState>> }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `idea:${idea.id}` });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-3xl border bg-white p-3 shadow-sm ${isDragging ? "border-blue-300 opacity-60 ring-2 ring-blue-200" : "border-slate-100"}`}
    >
      <button {...attributes} {...listeners} className="rounded-2xl bg-slate-100 p-2 text-slate-400" title="Arrastar ideia">
        <GripVertical size={18} />
      </button>
      <button type="button" onClick={() => setModal({ kind: "idea", id: idea.id })} className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="slate">#{idea.order}</Badge>
          <Badge tone="cyan">{idea.type}</Badge>
          <Badge tone={idea.priority === "Alta" ? "red" : "blue"}>{idea.priority}</Badge>
        </div>
        <h3 className="mt-2 truncate font-black">{idea.title}</h3>
        <p className="mt-1 text-xs font-bold text-slate-400">Criado por {profileById.get(idea.createdBy)?.name}</p>
      </button>
    </div>
  );
}

function IdeaStats({
  ideas,
  posts,
  channelById,
  lineById,
  vehicleTypeById,
  contentTypeById,
  funnelById,
  profileById
}: {
  ideas: Idea[];
  posts: EditorialPost[];
  channelById: Map<string, Channel>;
  lineById: Map<string, ProductLine>;
  vehicleTypeById: Map<string, VehicleType>;
  contentTypeById: Map<string, ContentType>;
  funnelById: Map<string, FunnelStage>;
  profileById: Map<string, Profile>;
}) {
  const linkedIdeaIds = new Set(posts.filter((post) => post.status !== "Ideia").map((post) => post.ideaId).filter(Boolean));
  const conversion = ideas.length ? (linkedIdeaIds.size / ideas.length) * 100 : 0;
  const funnelData = aggregateIdeas(ideas, "funnelStageId", funnelById);
  const typeData = aggregateIdeas(ideas, "type");
  const channelData = aggregateIdeas(ideas, "channelId", channelById);
  const lineData = aggregateIdeas(ideas, "productLineId", lineById);
  const vehicleData = aggregateIdeas(ideas, "vehicleTypeId", vehicleTypeById);
  const contentData = aggregateIdeas(ideas, "contentTypeId", contentTypeById);
  const creatorData = aggregateIdeas(ideas, "createdBy", profileById);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricSummaryCard label="Ideias totais" value={String(ideas.length)} />
        <MetricSummaryCard label="Viraram post" value={String(linkedIdeaIds.size)} />
        <MetricSummaryCard label="Conversão" value={formatPercent(conversion)} />
        <MetricSummaryCard label="Com arquivo" value={String(ideas.filter((idea) => idea.attachments?.length).length)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <IdeaBreakdown title="Funil" data={funnelData} />
        <IdeaBreakdown title="Tipo de ideia" data={typeData} />
        <IdeaBreakdown title="Canal" data={channelData} />
        <IdeaBreakdown title="Linha de produto" data={lineData} />
        <IdeaBreakdown title="Tipo de veículo" data={vehicleData} />
        <IdeaBreakdown title="Tipo de conteúdo" data={contentData} />
        <IdeaBreakdown title="Criador" data={creatorData} />
      </div>
    </div>
  );
}

function aggregateIdeas(ideas: Idea[], key: keyof Idea, labels?: Map<string, { name: string }>) {
  const total = Math.max(ideas.length, 1);
  return Object.entries(ideas.reduce<Record<string, number>>((acc, idea) => {
    const id = String(idea[key] ?? "") || "sem-categoria";
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).map(([id, count]) => ({
    id,
    name: labels?.get(id)?.name ?? (id === "sem-categoria" ? "Sem categoria" : id),
    count,
    percent: (count / total) * 100
  }));
}

function IdeaBreakdown({ title, data }: { title: string; data: { id: string; name: string; count: number; percent: number }[] }) {
  return (
    <div className="rounded-[28px] border border-slate-100 bg-white p-4 shadow-sm">
      <h3 className="font-black">{title}</h3>
      <div className="mt-3 space-y-3">
        {data.map((item) => (
          <div key={item.id}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="font-black">{item.name}</span>
              <span className="font-black text-blue-700">{item.count} · {formatPercent(item.percent)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-700" style={{ width: `${Math.min(item.percent, 100)}%` }} />
            </div>
          </div>
        ))}
        {!data.length && <p className="text-sm font-bold text-slate-400">Sem dados ainda.</p>}
      </div>
    </div>
  );
}

function Campaigns({ campaigns, lineById, vehicleTypeById, funnelById, profileById, setModal }: { campaigns: Campaign[]; lineById: Map<string, ProductLine>; vehicleTypeById: Map<string, VehicleType>; funnelById: Map<string, FunnelStage>; profileById: Map<string, Profile>; setModal: Dispatch<SetStateAction<ModalState>> }) {
  return (
    <Panel title="Campanhas" action={<RoundAdd onClick={() => setModal({ kind: "campaign" })} label="Adicionar campanha" />}>
      <div className="grid gap-4">
        {campaigns.map((campaign) => (
          <button key={campaign.id} onClick={() => setModal({ kind: "campaign", id: campaign.id })} className="rounded-3xl border border-slate-100 bg-white p-5 text-left shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-blue-700">{lineById.get(campaign.productLineId)?.name} · {vehicleTypeById.get(campaign.vehicleTypeId)?.name}</p>
                <h3 className="mt-1 text-xl font-black">{campaign.name}</h3>
              </div>
              <Badge tone="blue">{campaign.status}</Badge>
            </div>
            <p className="mt-3 text-sm text-slate-500">{campaign.objective}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <FunnelBadge stage={funnelById.get(campaign.funnelStageId)} />
              <Badge tone="slate">{campaign.assignedTo.map((id) => profileById.get(id)?.name).join(", ")}</Badge>
            </div>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function Metrics({
  metrics,
  setMetrics,
  posts,
  campaigns,
  channels,
  productLines,
  vehicleTypes,
  contentTypes,
  funnelStages,
  currentUser,
  taskColumns,
  setTasks,
  setIdeas,
  channelById,
  lineById,
  vehicleTypeById,
  contentTypeById,
  funnelById,
  setModal,
  reloadData
}: {
  metrics: PostMetric[];
  setMetrics: Dispatch<SetStateAction<PostMetric[]>>;
  posts: EditorialPost[];
  campaigns: Campaign[];
  channels: Channel[];
  productLines: ProductLine[];
  vehicleTypes: VehicleType[];
  contentTypes: ContentType[];
  funnelStages: FunnelStage[];
  currentUser: Profile;
  taskColumns: TaskColumn[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  setIdeas: Dispatch<SetStateAction<Idea[]>>;
  channelById: Map<string, Channel>;
  lineById: Map<string, ProductLine>;
  vehicleTypeById: Map<string, VehicleType>;
  contentTypeById: Map<string, ContentType>;
  funnelById: Map<string, FunnelStage>;
  setModal: Dispatch<SetStateAction<ModalState>>;
  reloadData?: () => Promise<void>;
}) {
  const [period, setPeriod] = useState("all");
  const [youtubeImportOpen, setYoutubeImportOpen] = useState(false);
  const [tiktokImportOpen, setTiktokImportOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState<string>("all");
  const [allVideosOpen, setAllVideosOpen] = useState(false);
  const [lineFilter, setLineFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [contentFilter, setContentFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [funnelFilter, setFunnelFilter] = useState("all");
  const [videoTypeFilter, setVideoTypeFilter] = useState("all");
  const [privacyFilter, setPrivacyFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);
  const postById = useMemo(() => new Map(posts.map((post) => [post.id, post])), [posts]);
  const today = new Date();
  const todayMs = today.getTime();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setFiltersOpen(false);
      }
    }
    if (filtersOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filtersOpen]);

  const isYoutubeChannel = useMemo(() =>
    activeChannel !== "all" && (activeChannel === "youtube" || channelById.get(activeChannel)?.name.toLowerCase().includes("youtube")),
  [activeChannel, channelById]);
  const isTikTokChannel = useMemo(() =>
    activeChannel !== "all" && (activeChannel === "tiktok" || channelById.get(activeChannel)?.name.toLowerCase().includes("tiktok")),
  [activeChannel, channelById]);

  const resolvedMetrics = useMemo(() => metrics.map((metric) => {
    const post = metric.postId ? postById.get(metric.postId) : undefined;
    return {
      ...metric,
      postTitle: metric.postTitle || post?.title || "Métrica avulsa",
      channelId: metric.channelId || post?.channelId || "",
      campaignId: metric.campaignId || post?.campaignId || "",
      productLineId: metric.productLineId || post?.productLineId || "",
      vehicleTypeId: metric.vehicleTypeId || post?.vehicleTypeId || "",
      contentTypeId: metric.contentTypeId || post?.contentTypeId || "",
      funnelStageId: metric.funnelStageId || post?.funnelStageId || ""
    } as PostMetric;
  }), [metrics, postById]);

  const channelMetrics = useMemo(() =>
    activeChannel === "all"
      ? resolvedMetrics
      : resolvedMetrics.filter((m) => m.channelId === activeChannel),
  [resolvedMetrics, activeChannel]);

  const filteredMetrics = useMemo(() => resolvedMetrics.filter((metric) => {
    const date = new Date(`${metric.date || todayIso()}T12:00:00`);
    const diffDays = Math.floor((todayMs - date.getTime()) / 86400000);
    if (period !== "all" && diffDays > Number(period)) return false;
    if (activeChannel !== "all" && metric.channelId !== activeChannel) return false;
    if (!metricMatchesFilter(metric.productLineId, lineFilter)) return false;
    if (!metricMatchesFilter(metric.vehicleTypeId, vehicleFilter)) return false;
    if (!metricMatchesFilter(metric.contentTypeId, contentFilter)) return false;
    if (!metricMatchesFilter(metric.campaignId, campaignFilter)) return false;
    if (!metricMatchesFilter(metric.funnelStageId, funnelFilter)) return false;
    if (videoTypeFilter !== "all" && metric.videoType !== videoTypeFilter) return false;
    if (privacyFilter !== "all" && (metric.privacyStatus ?? "public") !== privacyFilter) return false;
    return true;
  }), [resolvedMetrics, period, activeChannel, lineFilter, vehicleFilter, contentFilter, campaignFilter, funnelFilter, videoTypeFilter, privacyFilter, todayMs]);

  const totals = useMemo(() => computeMetricTotals(filteredMetrics), [filteredMetrics]);
  const kpis = useMemo(() => channelKpiConfig(activeChannel, totals, filteredMetrics.length), [activeChannel, totals, filteredMetrics.length]);
  const averageReach = filteredMetrics.length ? totals.reach / filteredMetrics.length : 0;

  const top20 = useMemo(() => filteredMetrics.slice().sort((a, b) => b.reach - a.reach).slice(0, 20), [filteredMetrics]);
  const top10Chart = useMemo(() => top20.slice(0, 10).map((metric) => ({
    name: metric.postTitle.length > 32 ? metric.postTitle.slice(0, 32) + "…" : metric.postTitle,
    alcance: metric.reach
  })), [top20]);
  const dailyData = useMemo(() => Object.values(filteredMetrics.reduce<Record<string, { date: string; alcance: number; leads: number }>>((acc, metric) => {
    const key = metric.date || todayIso();
    acc[key] = acc[key] ?? { date: key.slice(5), alcance: 0, leads: 0 };
    acc[key].alcance += metric.reach;
    acc[key].leads += metric.leads;
    return acc;
  }, {})).sort((a, b) => a.date.localeCompare(b.date)), [filteredMetrics]);

  const top5PeriodData = useMemo(() =>
    filteredMetrics.slice().sort((a, b) => b.reach - a.reach).slice(0, 5).map((m) => ({
      name: m.postTitle.length > 28 ? m.postTitle.slice(0, 28) + "…" : m.postTitle,
      alcance: m.reach
    })),
  [filteredMetrics]);

  const topReach = useMemo(() => filteredMetrics.slice().sort((a, b) => b.reach - a.reach).slice(0, 3), [filteredMetrics]);
  const topLeads = useMemo(() => filteredMetrics.slice().sort((a, b) => b.leads - a.leads).slice(0, 3), [filteredMetrics]);
  const topEngagement = useMemo(() => filteredMetrics.slice().sort((a, b) => metricEngagement(b) - metricEngagement(a)).slice(0, 3), [filteredMetrics]);
  const previewMetrics = useMemo(() => top20.slice(0, 10), [top20]);

  const metricPostIds = useMemo(() => new Set(metrics.map((m) => m.postId).filter(Boolean)), [metrics]);
  const postsWithoutMetric = useMemo(() =>
    posts
      .filter((post) =>
        post.status === "Publicado" &&
        !metricPostIds.has(post.id) &&
        !metrics.some((m) => m.postTitle === post.title)
      )
      .slice(0, 5),
  [posts, metricPostIds, metrics]);
  const winners = useMemo(() => filteredMetrics.filter((m) => m.leads > 0 && metricEngagementRate(m) >= 5).slice(0, 4), [filteredMetrics]);
  const weakMetrics = useMemo(() => filteredMetrics.filter((m) => m.reach < averageReach * 0.7 || m.leads === 0).slice(0, 4), [filteredMetrics, averageReach]);

  const activeFilterCount = [lineFilter, vehicleFilter, contentFilter, campaignFilter, funnelFilter, videoTypeFilter, privacyFilter].filter((f) => f !== "all").length;

  // Período anterior (mesmas dimensões de filtro, janela deslocada)
  const prevFilteredMetrics = useMemo(() => {
    if (period === "all") return [];
    const days = Number(period);
    return resolvedMetrics.filter((metric) => {
      const date = new Date(`${metric.date || todayIso()}T12:00:00`);
      const diffDays = Math.floor((todayMs - date.getTime()) / 86400000);
      if (diffDays <= days || diffDays > days * 2) return false;
      if (activeChannel !== "all" && metric.channelId !== activeChannel) return false;
      if (!metricMatchesFilter(metric.productLineId, lineFilter)) return false;
      if (!metricMatchesFilter(metric.vehicleTypeId, vehicleFilter)) return false;
      if (!metricMatchesFilter(metric.contentTypeId, contentFilter)) return false;
      if (!metricMatchesFilter(metric.campaignId, campaignFilter)) return false;
      if (!metricMatchesFilter(metric.funnelStageId, funnelFilter)) return false;
      if (videoTypeFilter !== "all" && metric.videoType !== videoTypeFilter) return false;
      if (privacyFilter !== "all" && (metric.privacyStatus ?? "public") !== privacyFilter) return false;
      return true;
    });
  }, [resolvedMetrics, period, activeChannel, lineFilter, vehicleFilter, contentFilter, campaignFilter, funnelFilter, videoTypeFilter, privacyFilter, todayMs]);

  const prevTotals = useMemo(() => computeMetricTotals(prevFilteredMetrics), [prevFilteredMetrics]);

  // Exibir layout YouTube quando for canal YouTube ou aba Geral
  const showYoutubeDesign = isYoutubeChannel || activeChannel === "all";
  const showTikTokDesign = isTikTokChannel;

  const tiktokEngagementRate = totals.reach ? (totals.engagement / totals.reach) * 100 : 0;
  const tiktokAverageViews = filteredMetrics.length ? Math.round(totals.reach / filteredMetrics.length) : 0;

  const tiktokDailyData = useMemo(() => Object.values(
    filteredMetrics.reduce<Record<string, { date: string; views: number; engagement: number; likes: number; comments: number; shares: number }>>((acc, metric) => {
      const key = metric.date || todayIso();
      acc[key] = acc[key] ?? { date: key.slice(5), views: 0, engagement: 0, likes: 0, comments: 0, shares: 0 };
      acc[key].views += metric.reach;
      acc[key].engagement += metricEngagement(metric);
      acc[key].likes += metric.likes;
      acc[key].comments += metric.comments;
      acc[key].shares += metric.shares;
      return acc;
    }, {})
  ).sort((a, b) => a.date.localeCompare(b.date)), [filteredMetrics]);

  const tiktokTopEngagement = useMemo(() =>
    filteredMetrics.slice().sort((a, b) => metricEngagement(b) - metricEngagement(a)).slice(0, 8),
  [filteredMetrics]);
  const tiktokTopRates = useMemo(() =>
    filteredMetrics.slice().filter((metric) => metric.reach > 0).sort((a, b) => metricEngagementRate(b) - metricEngagementRate(a)).slice(0, 6),
  [filteredMetrics]);
  const tiktokEngagementMix = useMemo(() => ([
    { id: "likes", name: "Curtidas", value: totals.likes, color: "#ec4899" },
    { id: "comments", name: "Comentários", value: totals.comments, color: "#8b5cf6" },
    { id: "shares", name: "Compartilhamentos", value: totals.shares, color: "#06b6d4" }
  ]).filter((item) => item.value > 0), [totals.likes, totals.comments, totals.shares]);

  // Dados diários de crescimento de inscritos
  const subscriberDailyData = useMemo(() => Object.values(
    filteredMetrics.reduce<Record<string, { date: string; net: number }>>((acc, metric) => {
      const key = metric.date || todayIso();
      acc[key] = acc[key] ?? { date: key.slice(5), net: 0 };
      acc[key].net += (metric.subscribersGained ?? 0) - (metric.subscribersLost ?? 0);
      return acc;
    }, {})
  ).sort((a, b) => a.date.localeCompare(b.date)), [filteredMetrics]);

  // Dados diários de impressões & CTR
  const impressionsDailyData = useMemo(() => Object.values(
    filteredMetrics.reduce<Record<string, { date: string; impressions: number; ctrSum: number; count: number }>>((acc, metric) => {
      const key = metric.date || todayIso();
      acc[key] = acc[key] ?? { date: key.slice(5), impressions: 0, ctrSum: 0, count: 0 };
      acc[key].impressions += metric.impressions ?? 0;
      if (metric.impressionClickThroughRate != null) {
        acc[key].ctrSum += metric.impressionClickThroughRate;
        acc[key].count += 1;
      }
      return acc;
    }, {})
  ).sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ date: d.date, impressions: d.impressions, ctr: d.count ? Number((d.ctrSum / d.count).toFixed(2)) : 0 })),
  [filteredMetrics]);

  const channelCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of resolvedMetrics) {
      map.set(m.channelId, (map.get(m.channelId) ?? 0) + 1);
    }
    return map;
  }, [resolvedMetrics]);
  const activeChannelName = activeChannel === "all" ? "Geral" : (channelById.get(activeChannel)?.name ?? activeChannel);

  function createImprovementTask(metric: PostMetric) {
    const column = taskColumns.slice().sort((a, b) => a.order - b.order)[0];
    if (!column) return;
    setTasks((current) => [{
      id: crypto.randomUUID(),
      title: `Melhorar resultado: ${metric.postTitle}`,
      columnId: column.id,
      order: current.filter((task) => task.columnId === column.id).length + 1,
      priority: metric.leads === 0 ? "Alta" : "Média",
      progress: "Atenção",
      createdBy: currentUser.id,
      assignedTo: [],
      relatedTo: "Métricas",
      funnelStageId: metric.funnelStageId,
      dueDate: todayIso(),
      description: `Analisar métrica do post "${metric.postTitle}". Alcance: ${metric.reach}. Leads: ${metric.leads}. Aprendizado registrado: ${metric.learning || "sem aprendizado registrado"}.`,
      checklist: [
        { id: crypto.randomUUID(), label: "Identificar hipótese do baixo desempenho", done: false },
        { id: crypto.randomUUID(), label: "Propor ajuste de conteúdo ou campanha", done: false }
      ],
      comments: [],
      attachments: [],
      ...defaultTaskResetFields()
    }, ...current]);
  }

  function createPostIdea(metric: PostMetric) {
    setIdeas((current) => [{
      id: crypto.randomUUID(),
      title: `Replicar formato: ${metric.postTitle}`,
      description: `Ideia criada a partir de uma métrica com bom resultado. Aprendizado: ${metric.learning || "sem aprendizado registrado"}.`,
      productLineId: metric.productLineId,
      vehicleTypeId: metric.vehicleTypeId,
      contentTypeId: metric.contentTypeId,
      type: "Postagem",
      channelId: metric.channelId,
      format: defaultPostFormatForChannel(channelById.get(metric.channelId)),
      funnelStageId: metric.funnelStageId,
      createdBy: currentUser.id,
      priority: "Alta",
      order: current.length + 1,
      attachments: []
    }, ...current]);
  }

  const metricBreakdowns = useMemo(() => {
    const list: { title: string; unit: string; data: MetricBreakdownItem[] }[] = [];
    if (activeChannel === "all") {
      list.push({
        title: "Leads por canal",
        unit: "leads",
        data: aggregateMetricBreakdown(filteredMetrics, "channelId", new Map(channels.map((item) => [item.id, item])), (m) => m.leads)
      });
    }
    list.push({
      title: "Alcance por linha",
      unit: "alcance",
      data: aggregateMetricBreakdown(filteredMetrics, "productLineId", new Map(productLines.map((item) => [item.id, item])), (m) => m.reach)
    });
    list.push({
      title: "Conversões por funil",
      unit: "conv.",
      data: aggregateMetricBreakdown(filteredMetrics, "funnelStageId", new Map(funnelStages.map((item) => [item.id, item])), (m) => m.leads)
    });
    return list;
  }, [filteredMetrics, activeChannel, channels, productLines, funnelStages]);

  return (
    <Panel title="Métricas" action={
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setYoutubeImportOpen(true)} className="flex items-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-sm font-black text-red-700 hover:bg-red-100">
          <Youtube size={15} /> Importar do YouTube
        </button>
        <button type="button" onClick={() => setTiktokImportOpen(true)} className="flex items-center gap-2 rounded-2xl bg-slate-950 px-3 py-2 text-sm font-black text-white hover:bg-slate-700">
          <Play size={15} /> Trazer dados do TikTok
        </button>
        <RoundAdd onClick={() => setModal({ kind: "metric" })} label="Adicionar métrica" />
      </div>
    }>
      <div className="mb-4 -mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1">
        {[{ id: "all", name: "Geral", color: "#0f172a" } as Channel, ...channels].map((ch) => {
          const count = ch.id === "all" ? resolvedMetrics.length : (channelCounts.get(ch.id) ?? 0);
          const isActive = activeChannel === ch.id;
          return (
            <button key={ch.id} type="button" onClick={() => setActiveChannel(ch.id)}
              className={`shrink-0 border-b-2 px-4 py-2 text-sm font-black transition ${isActive ? "text-slate-950" : "border-transparent text-slate-500 hover:text-slate-700"}`}
              style={isActive ? { borderColor: ch.color } : undefined}
            >
              {ch.name} <span className="ml-1 text-xs font-bold text-slate-400">({count})</span>
            </button>
          );
        })}
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <FilterSelect label="Período" value={period} onChange={setPeriod} options={[["30", "Últimos 30 dias"], ["7", "Últimos 7 dias"], ["90", "Últimos 90 dias"], ["all", "Todo período"]]} />
        <div ref={filtersRef} className="relative">
          <button type="button" onClick={() => setFiltersOpen((v) => !v)}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-blue-400 hover:bg-slate-50"
          >
            Filtros
            {activeFilterCount > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">{activeFilterCount}</span>}
            <span className="text-slate-400">{filtersOpen ? "▴" : "▾"}</span>
          </button>
          {filtersOpen && (
            <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-[24px] border border-slate-200 bg-white p-4 shadow-xl">
              <div className="grid gap-3">
                <FilterSelect label="Linha" value={lineFilter} onChange={setLineFilter} options={[["all", "Todas"], ...productLines.map((item) => [item.id, item.name])]} />
                <FilterSelect label="Veículo" value={vehicleFilter} onChange={setVehicleFilter} options={[["all", "Todos"], ...vehicleTypes.map((item) => [item.id, item.name])]} />
                <FilterSelect label="Conteúdo" value={contentFilter} onChange={setContentFilter} options={[["all", "Todos"], ...contentTypes.map((item) => [item.id, item.name])]} />
                <FilterSelect label="Campanha" value={campaignFilter} onChange={setCampaignFilter} options={[["all", "Todas"], ...campaigns.map((item) => [item.id, item.name])]} />
                <FilterSelect label="Funil" value={funnelFilter} onChange={setFunnelFilter} options={[["all", "Todos"], ...funnelStages.map((item) => [item.id, item.name])]} />
                {isYoutubeChannel && (
                  <FilterSelect label="Tipo" value={videoTypeFilter} onChange={setVideoTypeFilter} options={[["all", "Todos"], ["video", "Vídeo"], ["short", "Shorts"]]} />
                )}
                {isYoutubeChannel && (
                  <FilterSelect label="Visibilidade" value={privacyFilter} onChange={setPrivacyFilter} options={[["all", "Todas"], ["public", "Público"], ["unlisted", "Não listado"], ["private", "Privado"]]} />
                )}
                {activeFilterCount > 0 && (
                  <button type="button" onClick={() => { setLineFilter("all"); setVehicleFilter("all"); setContentFilter("all"); setCampaignFilter("all"); setFunnelFilter("all"); setVideoTypeFilter("all"); setPrivacyFilter("all"); }}
                    className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-200"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showYoutubeDesign ? (
        /* ── LAYOUT YOUTUBE ─────────────────────────────────────────── */
        <div className="grid gap-6">

          {/* A — KPI Cards com comparação */}
          <section>
            <h3 className="mb-3 font-black">Resumo · {activeChannelName}</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricKpiCard label="Visualizações" value={formatNumber(totals.reach)} delta={period !== "all" ? deltaPercent(totals.reach, prevTotals.reach) : undefined} />
              <MetricKpiCard label="Impressões" value={totals.impressions ? formatNumber(totals.impressions) : "—"} delta={period !== "all" && totals.impressions > 0 ? deltaPercent(totals.impressions, prevTotals.impressions) : undefined} />
              <MetricKpiCard label="CTR" value={totals.impressionCount ? formatPercent(totals.impressionClickThroughRate / totals.impressionCount) : "—"} delta={period !== "all" && totals.impressionCount > 0 && prevTotals.impressionCount > 0 ? deltaPercent(totals.impressionClickThroughRate / totals.impressionCount, prevTotals.impressionClickThroughRate / prevTotals.impressionCount) : undefined} />
              <MetricKpiCard label="Vídeos" value={formatNumber(filteredMetrics.length)} delta={period !== "all" ? deltaPercent(filteredMetrics.length, prevFilteredMetrics.length) : undefined} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricKpiCard label="Inscritos líquidos" value={formatNumber(totals.subscribersGained - totals.subscribersLost)} delta={period !== "all" ? deltaPercent(totals.subscribersGained - totals.subscribersLost, prevTotals.subscribersGained - prevTotals.subscribersLost) : undefined} />
              <MetricKpiCard label="Média views/vídeo" value={filteredMetrics.length ? formatNumber(Math.round(totals.reach / filteredMetrics.length)) : "—"} delta={period !== "all" && filteredMetrics.length > 0 && prevFilteredMetrics.length > 0 ? deltaPercent(totals.reach / filteredMetrics.length, prevTotals.reach / prevFilteredMetrics.length) : undefined} />
              <MetricKpiCard label="Retenção média" value={totals.analyticsCount ? formatPercent(totals.averageViewPercentage / totals.analyticsCount) : "—"} delta={period !== "all" && totals.analyticsCount > 0 && prevTotals.analyticsCount > 0 ? deltaPercent(totals.averageViewPercentage / totals.analyticsCount, prevTotals.averageViewPercentage / prevTotals.analyticsCount) : undefined} />
              <MetricKpiCard label="Taxa curtidas" value={totals.reach ? formatPercent((totals.likes / totals.reach) * 100) : "—"} delta={period !== "all" && totals.reach > 0 && prevTotals.reach > 0 ? deltaPercent((totals.likes / totals.reach) * 100, (prevTotals.likes / prevTotals.reach) * 100) : undefined} />
            </div>
          </section>

          {/* B + C — Evolução de views + Crescimento inscritos */}
          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-[28px] border border-slate-100 bg-slate-50 p-4">
              <h3 className="font-black">Evolução de Visualizações</h3>
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  {period === "all" ? (
                    <BarChart data={top5PeriodData} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tickFormatter={(v) => formatNumber(Number(v))} tick={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fontWeight: 700, fill: "#334155" }} />
                      <Tooltip formatter={(v: number) => [formatNumber(v), "Views"]} />
                      <Bar dataKey="alcance" fill="#2563eb" radius={[0, 6, 6, 0]} name="Views" />
                    </BarChart>
                  ) : (
                    <AreaChart data={dailyData}>
                      <defs>
                        <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} />
                      <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} tickFormatter={(v) => formatNumber(Number(v))} />
                      <Tooltip formatter={(v: number) => [formatNumber(v), "Views"]} />
                      <Area type="monotone" dataKey="alcance" stroke="#2563eb" fill="url(#viewsGradient)" strokeWidth={2.5} name="Views" dot={false} activeDot={{ r: 5 }} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-100 bg-slate-50 p-4">
              <h3 className="font-black">Crescimento de Inscritos</h3>
              <p className="mt-0.5 text-xs font-bold text-slate-400">Líquido por dia (ganhos − perdidos)</p>
              <div className="mt-3 h-52">
                {subscriberDailyData.some((d) => d.net !== 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subscriberDailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} />
                      <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} allowDecimals={false} />
                      <Tooltip formatter={(v: number) => [v > 0 ? `+${v}` : String(v), "Inscritos"]} />
                      <Bar dataKey="net" radius={[4, 4, 0, 0]} name="Inscritos">
                        {subscriberDailyData.map((entry, i) => (
                          <Cell key={i} fill={entry.net >= 0 ? "#10b981" : "#f43f5e"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm font-bold text-slate-400">Dados de inscritos não disponíveis para este período</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* D — Impressões & CTR */}
          {impressionsDailyData.some((d) => d.impressions > 0) && (
            <section>
              <div className="rounded-[28px] border border-slate-100 bg-slate-50 p-4">
                <h3 className="font-black">Impressões & CTR</h3>
                <p className="mt-0.5 text-xs font-bold text-slate-400">Quantas vezes o thumbnail apareceu e % que clicaram</p>
                <div className="mt-4 h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={impressionsDailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} tickFormatter={(v) => formatNumber(Number(v))} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fontWeight: 700, fill: "#f97316" }} tickFormatter={(v) => `${Number(v).toFixed(1)}%`} />
                      <Tooltip formatter={(value: number, name: string) => name === "CTR" ? [`${value.toFixed(2)}%`, "CTR"] : [formatNumber(Math.round(value)), "Impressões"]} />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="impressions" stroke="#2563eb" strokeWidth={2} dot={false} name="Impressões" />
                      <Line yAxisId="right" type="monotone" dataKey="ctr" stroke="#f97316" strokeWidth={2} strokeDasharray="5 3" dot={false} name="CTR" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          )}

          {/* E — Cards de vídeo */}
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-black">Top vídeos · {activeChannelName}</h3>
              <button type="button" onClick={() => setAllVideosOpen(true)} className="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-700">
                Ver todos os {channelMetrics.length} →
              </button>
            </div>
            {top20.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {top20.slice(0, 12).map((metric) => {
                  const thumb = thumbnailFor(metric);
                  return (
                    <button key={metric.id} type="button" onClick={() => setModal({ kind: "metric", id: metric.id })} className="overflow-hidden rounded-3xl bg-white text-left shadow-sm transition hover:shadow-md hover:-translate-y-0.5">
                      <div className="relative aspect-video bg-slate-100">
                        <MetricThumbnail src={thumb} className="h-full w-full object-cover" fallbackClassName="h-full w-full" />
                        {metric.privacyStatus === "private" && <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-black text-white">🔒 Privado</span>}
                        {metric.privacyStatus === "unlisted" && <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-black text-white">🔗 Não listado</span>}
                      </div>
                      <div className="p-3">
                        <p className="line-clamp-2 text-sm font-black text-slate-800 leading-snug">{metric.postTitle}</p>
                        {metric.date && <p className="mt-0.5 text-[10px] font-bold text-slate-400">{new Date(`${metric.date}T12:00:00`).toLocaleDateString("pt-BR")}</p>}
                        <div className="mt-2 grid grid-cols-3 divide-x divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50 text-center">
                          <div className="py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Views</p>
                            <p className="text-sm font-black text-slate-700">{formatNumber(metric.reach)}</p>
                          </div>
                          <div className="py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">CTR</p>
                            <p className="text-sm font-black text-slate-700">{metric.impressionClickThroughRate ? formatPercent(metric.impressionClickThroughRate) : "—"}</p>
                          </div>
                          <div className="py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Retenção</p>
                            <p className="text-sm font-black text-slate-700">{metric.averageViewPercentage ? formatPercent(metric.averageViewPercentage) : "—"}</p>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-500">Nenhuma métrica encontrada com os filtros atuais.</p>
            )}
          </section>
        </div>
      ) : showTikTokDesign ? (
        /* ── LAYOUT TIKTOK ─────────────────────────────────────────── */
        <div className="grid gap-6">
          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="font-black">Resumo · TikTok</h3>
                <p className="mt-1 text-sm font-bold text-slate-400">Dados reais do Sandbox agora, métricas avançadas preparadas para produção.</p>
              </div>
              <button type="button" onClick={() => setTiktokImportOpen(true)} className="rounded-2xl bg-slate-950 px-4 py-2 text-xs font-black text-white hover:bg-slate-700">
                Atualizar TikTok
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricKpiCard label="Visualizações" value={formatNumber(totals.reach)} delta={period !== "all" ? deltaPercent(totals.reach, prevTotals.reach) : undefined} />
              <MetricKpiCard label="Engajamento" value={formatNumber(totals.engagement)} delta={period !== "all" ? deltaPercent(totals.engagement, prevTotals.engagement) : undefined} />
              <MetricKpiCard label="Taxa engaj." value={formatPercent(tiktokEngagementRate)} delta={period !== "all" && prevTotals.reach > 0 ? deltaPercent(tiktokEngagementRate, (prevTotals.engagement / prevTotals.reach) * 100) : undefined} />
              <MetricKpiCard label="Vídeos" value={formatNumber(filteredMetrics.length)} delta={period !== "all" ? deltaPercent(filteredMetrics.length, prevFilteredMetrics.length) : undefined} />
              <MetricKpiCard label="Curtidas" value={formatNumber(totals.likes)} delta={period !== "all" ? deltaPercent(totals.likes, prevTotals.likes) : undefined} />
              <MetricKpiCard label="Comentários" value={formatNumber(totals.comments)} delta={period !== "all" ? deltaPercent(totals.comments, prevTotals.comments) : undefined} />
              <MetricKpiCard label="Compartilhamentos" value={formatNumber(totals.shares)} delta={period !== "all" ? deltaPercent(totals.shares, prevTotals.shares) : undefined} />
              <MetricKpiCard label="Média views/vídeo" value={tiktokAverageViews ? formatNumber(tiktokAverageViews) : "—"} delta={period !== "all" && prevFilteredMetrics.length > 0 ? deltaPercent(tiktokAverageViews, Math.round(prevTotals.reach / prevFilteredMetrics.length)) : undefined} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricKpiCard label="Tempo assistido" value={totals.watchTimeMinutes ? `${formatNumber(Math.round(totals.watchTimeMinutes))} min` : "—"} />
              <MetricKpiCard label="Retenção média" value={totals.analyticsCount ? formatPercent(totals.averageViewPercentage / totals.analyticsCount) : "—"} />
              <MetricKpiCard label="Impressões" value={totals.impressions ? formatNumber(totals.impressions) : "—"} />
              <MetricKpiCard label="CTR" value={totals.impressionCount ? formatPercent(totals.impressionClickThroughRate / totals.impressionCount) : "—"} />
            </div>
            <p className="mt-2 rounded-2xl bg-slate-50 px-4 py-2 text-xs font-bold text-slate-500">
              Tempo assistido, retenção, impressões e CTR aparecem automaticamente quando a conexão TikTok em produção retornar esses dados.
            </p>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-[28px] border border-slate-100 bg-slate-50 p-4">
              <h3 className="font-black">Evolução de visualizações e engajamento</h3>
              <p className="mt-0.5 text-xs font-bold text-slate-400">Views e interações por dia</p>
              <div className="mt-4 h-64">
                {tiktokDailyData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={tiktokDailyData}>
                      <defs>
                        <linearGradient id="tiktokViewsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#111827" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#111827" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="tiktokEngagementGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ec4899" stopOpacity={0.22} />
                          <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} />
                      <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} tickFormatter={(v) => formatNumber(Number(v))} />
                      <Tooltip formatter={(value: number, name: string) => [formatNumber(Number(value)), name === "views" ? "Visualizações" : "Engajamento"]} />
                      <Area type="monotone" dataKey="views" stroke="#111827" fill="url(#tiktokViewsGradient)" strokeWidth={2.5} name="Visualizações" dot={false} />
                      <Area type="monotone" dataKey="engagement" stroke="#ec4899" fill="url(#tiktokEngagementGradient)" strokeWidth={2.5} name="Engajamento" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-bold text-slate-400">Importe vídeos do TikTok para montar a evolução.</div>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-100 bg-slate-50 p-4">
              <h3 className="font-black">Top vídeos por engajamento</h3>
              <p className="mt-0.5 text-xs font-bold text-slate-400">Curtidas + comentários + compartilhamentos</p>
              <div className="mt-4 h-64">
                {tiktokTopEngagement.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tiktokTopEngagement.map((metric) => ({ name: metric.postTitle.length > 26 ? `${metric.postTitle.slice(0, 26)}…` : metric.postTitle, engagement: metricEngagement(metric) }))} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tickFormatter={(value) => formatNumber(Number(value))} tick={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} />
                      <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} />
                      <Tooltip formatter={(value: number) => [formatNumber(value), "Engajamento"]} />
                      <Bar dataKey="engagement" fill="#ec4899" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-bold text-slate-400">Sem engajamento importado no período.</div>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
            {tiktokEngagementMix.length ? (
              <BreakdownChart title="Distribuição do engajamento" data={tiktokEngagementMix} unit="interações" />
            ) : (
              <div className="rounded-[28px] border border-slate-100 bg-white p-4 shadow-sm">
                <h3 className="font-black">Distribuição do engajamento</h3>
                <div className="mt-3 flex h-44 items-center justify-center rounded-3xl bg-slate-50 text-sm font-bold text-slate-400">Sem curtidas, comentários ou compartilhamentos.</div>
              </div>
            )}
            <div className="rounded-[28px] border border-slate-100 bg-white p-4 shadow-sm">
              <h3 className="font-black">Taxas mais fortes por vídeo</h3>
              <p className="mt-0.5 text-xs font-bold text-slate-400">Taxa de engajamento, compartilhamento e comentário</p>
              <div className="mt-3 grid gap-2">
                {tiktokTopRates.map((metric) => (
                  <button key={metric.id} type="button" onClick={() => setModal({ kind: "metric", id: metric.id })} className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-left transition hover:border-pink-200 hover:bg-white md:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-black text-slate-800">{metric.postTitle}</p>
                      <p className="mt-0.5 text-xs font-bold text-slate-400">{formatNumber(metric.reach)} views · {formatNumber(metricEngagement(metric))} interações</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-black">
                      <span className="rounded-full bg-pink-100 px-2 py-1 text-pink-700">{formatPercent(metricEngagementRate(metric))} engaj.</span>
                      <span className="rounded-full bg-cyan-100 px-2 py-1 text-cyan-700">{formatPercent(metric.reach ? (metric.shares / metric.reach) * 100 : 0)} compart.</span>
                      <span className="rounded-full bg-violet-100 px-2 py-1 text-violet-700">{formatPercent(metric.reach ? (metric.comments / metric.reach) * 100 : 0)} coment.</span>
                    </div>
                  </button>
                ))}
                {!tiktokTopRates.length && <p className="rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-500">Ainda não há vídeos com visualizações para calcular taxas.</p>}
              </div>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-black">Top vídeos · TikTok</h3>
                <p className="text-xs font-bold text-slate-400">Ordenado por visualizações</p>
              </div>
              <button type="button" onClick={() => setAllVideosOpen(true)} className="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-700">
                Ver todos os {channelMetrics.length} →
              </button>
            </div>
            {top20.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {top20.slice(0, 12).map((metric) => {
                  const thumb = thumbnailFor(metric);
                  return (
                    <button key={metric.id} type="button" onClick={() => setModal({ kind: "metric", id: metric.id })} className="overflow-hidden rounded-3xl bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                      <div className="relative aspect-[9/12] bg-slate-100">
                        <MetricThumbnail src={thumb} className="h-full w-full object-cover" fallbackClassName="h-full w-full" />
                        <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-black text-white">TikTok</span>
                      </div>
                      <div className="p-3">
                        <p className="line-clamp-2 text-sm font-black leading-snug text-slate-800">{metric.postTitle}</p>
                        {metric.date && <p className="mt-0.5 text-[10px] font-bold text-slate-400">{new Date(`${metric.date}T12:00:00`).toLocaleDateString("pt-BR")}</p>}
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-black">
                          <span className="rounded-2xl bg-slate-50 px-2 py-1 text-slate-700">{formatNumber(metric.reach)} views</span>
                          <span className="rounded-2xl bg-pink-50 px-2 py-1 text-pink-700">{formatNumber(metricEngagement(metric))} engaj.</span>
                          <span className="rounded-2xl bg-violet-50 px-2 py-1 text-violet-700">{formatNumber(metric.comments)} coment.</span>
                          <span className="rounded-2xl bg-cyan-50 px-2 py-1 text-cyan-700">{formatNumber(metric.shares)} compart.</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-500">Nenhuma métrica do TikTok encontrada com os filtros atuais.</p>
            )}
          </section>
        </div>
      ) : (
        /* ── LAYOUT OUTROS CANAIS ───────────────────────────────────── */
        <div className="grid gap-5">
          <section>
            <h3 className="mb-3 font-black">Resumo · {activeChannelName}</h3>
            <div className={`grid gap-3 md:grid-cols-2 ${kpis.length >= 6 ? "xl:grid-cols-6" : "xl:grid-cols-4"}`}>
              {kpis.map((kpi) => <MetricSummaryCard key={kpi.label} label={kpi.label} value={kpi.value} />)}
            </div>
          </section>
          <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[28px] border border-slate-100 bg-slate-50 p-4">
              <h3 className="font-black">Evolução do período</h3>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  {period === "all" ? (
                    <BarChart data={top5PeriodData} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tickFormatter={(value) => formatNumber(Number(value))} tick={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} />
                      <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} />
                      <Tooltip formatter={(value: number) => formatNumber(value)} />
                      <Bar dataKey="alcance" fill="#2563eb" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  ) : (
                    <AreaChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12, fontWeight: 700, fill: "#334155" }} />
                      <YAxis tick={{ fontSize: 12, fontWeight: 700, fill: "#334155" }} tickFormatter={(value) => formatNumber(Number(value))} />
                      <Tooltip />
                      <Area dataKey="alcance" stroke="#2563eb" fill="#bfdbfe" />
                      <Area dataKey="leads" stroke="#0891b2" fill="#cffafe" />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-[28px] border border-slate-100 bg-slate-50 p-4">
              <h3 className="font-black">Top 10 mais visualizados</h3>
              <div className="mt-4 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top10Chart} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tickFormatter={(value) => formatNumber(Number(value))} tick={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} />
                    <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} />
                    <Tooltip formatter={(value: number) => formatNumber(value)} />
                    <Bar dataKey="alcance" fill="#2563eb" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
          <section className={`grid gap-5 ${metricBreakdowns.length === 3 ? "xl:grid-cols-3" : "xl:grid-cols-2"}`}>
            {metricBreakdowns.map((breakdown) => (
              <BreakdownChart key={breakdown.title} title={breakdown.title} data={breakdown.data} unit={breakdown.unit} />
            ))}
          </section>
          <section>
            <h3 className="mb-3 font-black">Análise</h3>
            <div className="grid gap-4 lg:grid-cols-3">
              <RankingCard title="Mais alcance" metrics={topReach} value={(metric) => formatNumber(metric.reach)} />
              <RankingCard title="Mais leads" metrics={topLeads} value={(metric) => `${metric.leads} leads`} />
              <RankingCard title="Mais engajamento" metrics={topEngagement} value={(metric) => formatNumber(metricEngagement(metric))} />
            </div>
          </section>
          <section className="grid gap-4 lg:grid-cols-3">
            <ActionList title="Conteúdos vencedores" empty="Nenhum destaque ainda." items={winners} actionLabel="Criar ideia parecida" onAction={createPostIdea} description={(metric) => `${formatPercent(metricEngagementRate(metric))} engajamento · ${metric.leads} leads`} />
            <ActionList title="Precisam de ajuste" empty="Nada crítico no filtro atual." items={weakMetrics} actionLabel="Criar tarefa" onAction={createImprovementTask} description={(metric) => `${formatNumber(metric.reach)} alcance · ${metric.leads} leads`} />
            <div className="rounded-[28px] border border-amber-100 bg-amber-50 p-4">
              <h3 className="font-black text-amber-900">Posts sem métrica</h3>
              <div className="mt-3 space-y-2">
                {postsWithoutMetric.map((post) => (
                  <div key={post.id} className="rounded-2xl bg-white/70 p-3">
                    <p className="line-clamp-2 text-sm font-black">{post.title}</p>
                    <p className="mt-1 text-xs font-bold text-amber-700">{channelById.get(post.channelId)?.name} · {new Date(post.publishAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                ))}
                {!postsWithoutMetric.length && <p className="text-sm font-bold text-amber-700">Todos os posts têm métrica registrada.</p>}
              </div>
            </div>
          </section>
          <section className="mt-2">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-black">Top 10 · {activeChannelName}</h3>
              <button type="button" onClick={() => setAllVideosOpen(true)} className="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-700">
                Ver todos os {channelMetrics.length} vídeos →
              </button>
            </div>
            <div className="grid gap-2">
              {previewMetrics.map((metric) => {
                const thumb = thumbnailFor(metric);
                return (
                  <button key={metric.id} onClick={() => setModal({ kind: "metric", id: metric.id })} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left transition hover:border-blue-200 hover:bg-slate-50">
                    <MetricThumbnail src={thumb} className="h-14 w-24 shrink-0 rounded-lg object-cover" fallbackClassName="h-14 w-24 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 font-black">{metric.postTitle}</p>
                      <p className="text-xs font-bold text-slate-500">{metric.date ? new Date(`${metric.date}T12:00:00`).toLocaleDateString("pt-BR") : "Sem data"}{metric.channelId && ` · ${channelById.get(metric.channelId)?.name ?? metric.channelId}`}</p>
                      <p className="mt-0.5 text-xs font-bold text-slate-700">{formatNumber(metric.reach)} alcance · {formatNumber(metric.likes)} curtidas · {formatNumber(metric.comments)} coment.</p>
                    </div>
                  </button>
                );
              })}
              {!previewMetrics.length && <p className="rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-500">Nenhuma métrica encontrada com os filtros atuais.</p>}
            </div>
          </section>
        </div>
      )}
      {youtubeImportOpen && (
        <YouTubeImportModal
          metrics={metrics}
          setMetrics={setMetrics}
          posts={posts}
          channels={channels}
          productLines={productLines}
          funnelStages={funnelStages}
          onClose={() => setYoutubeImportOpen(false)}
          reloadData={reloadData}
        />
      )}
      {tiktokImportOpen && (
        <TikTokImportModal
          metrics={metrics}
          setMetrics={setMetrics}
          channels={channels}
          onClose={() => setTiktokImportOpen(false)}
          reloadData={reloadData}
        />
      )}
      {allVideosOpen && (
        <AllVideosModal
          metrics={channelMetrics}
          channelLabel={activeChannelName}
          channelById={channelById}
          onClose={() => setAllVideosOpen(false)}
          onPick={(id) => { setAllVideosOpen(false); setModal({ kind: "metric", id }); }}
        />
      )}
    </Panel>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return (
    <label className="text-xs font-black uppercase text-slate-500">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black normal-case text-slate-700 outline-none focus:border-blue-500">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function MetricSummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[26px] border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4"><p className="text-xs font-black uppercase text-blue-600">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p></div>;
}

function MetricKpiCard({ label, value, delta }: { label: string; value: string; delta?: { pct: number; positive: boolean } | null }) {
  return (
    <div className="rounded-[26px] border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1.5 text-2xl font-black text-slate-900">{value}</p>
      {delta !== undefined && (
        delta ? (
          <p className={`mt-1 flex items-center gap-1 text-xs font-bold ${delta.positive ? "text-emerald-600" : "text-rose-600"}`}>
            <span>{delta.positive ? "▲" : "▼"}</span>
            <span>{delta.pct.toFixed(1)}% vs anterior</span>
          </p>
        ) : (
          <p className="mt-1 text-xs font-bold text-slate-300">— sem dados anteriores</p>
        )
      )}
    </div>
  );
}

function MetricThumbnail({ src, className, fallbackClassName = "" }: { src: string | null; className: string; fallbackClassName?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 ${fallbackClassName}`}>
        <FileVideo size={28} className="text-slate-300" />
      </div>
    );
  }
  return <img src={src} className={className} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

function ChartValueList({ data }: { data: { label: string; value: string }[] }) {
  if (!data.length) return null;
  return (
    <div className="mt-3 grid gap-2 md:grid-cols-2">
      {data.map((item) => (
        <p key={`${item.label}-${item.value}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 text-xs font-bold text-slate-500">
          <span className="min-w-0 truncate">{item.label}</span>
          <span className="shrink-0 font-black text-slate-950">{item.value}</span>
        </p>
      ))}
    </div>
  );
}

function BreakdownChart({ title, data, unit }: { title: string; data: { id: string; name: string; value: number; color: string }[]; unit: string }) {
  return (
    <div className="rounded-[28px] border border-slate-100 bg-white p-4 shadow-sm">
      <h3 className="font-black">{title}</h3>
      <div className="mt-3 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={34} outerRadius={62} labelLine={false} label={renderInsidePieLabel}>
              {data.map((item, index) => <Cell key={item.id} fill={item.color || ["#2563eb", "#38bdf8", "#64748b", "#22c55e"][index % 4]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 space-y-1">
        {data.slice(0, 4).map((item) => <p key={item.id} className="flex justify-between gap-2 text-xs font-bold text-slate-500"><span className="truncate">{item.name}</span><span className="font-black text-slate-800">{formatNumber(item.value)} {unit}</span></p>)}
      </div>
    </div>
  );
}

function renderInsidePieLabel(props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
  value?: number;
  payload?: { value?: number };
}) {
  const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0, value = 0, payload } = props;
  const sliceValue = Number(payload?.value ?? value);
  if (percent < 0.08 || !sliceValue) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.58;
  const x = cx + radius * Math.cos((-midAngle * Math.PI) / 180);
  const y = cy + radius * Math.sin((-midAngle * Math.PI) / 180);
  return (
    <text x={x} y={y} fill="#ffffff" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={900}>
      {formatNumber(sliceValue)}
    </text>
  );
}

function RankingCard({ title, metrics, value }: { title: string; metrics: PostMetric[]; value: (metric: PostMetric) => string }) {
  return (
    <div className="rounded-[28px] border border-slate-100 bg-slate-50 p-4">
      <h3 className="font-black">{title}</h3>
      <div className="mt-3 space-y-2">
        {metrics.map((metric, index) => (
          <div key={metric.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3">
            <p className="min-w-0 truncate text-sm font-black">{index + 1}. {metric.postTitle}</p>
            <span className="shrink-0 text-sm font-black text-blue-700">{value(metric)}</span>
          </div>
        ))}
        {!metrics.length && <p className="text-sm font-bold text-slate-400">Sem dados.</p>}
      </div>
    </div>
  );
}

function ActionList({ title, empty, items, actionLabel, onAction, description }: { title: string; empty: string; items: PostMetric[]; actionLabel: string; onAction: (metric: PostMetric) => void; description: (metric: PostMetric) => string }) {
  return (
    <div className="rounded-[28px] border border-slate-100 bg-white p-4 shadow-sm">
      <h3 className="font-black">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.map((metric) => (
          <div key={metric.id} className="rounded-2xl bg-slate-50 p-3">
            <p className="line-clamp-2 text-sm font-black">{metric.postTitle}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">{description(metric)}</p>
            <button type="button" onClick={() => onAction(metric)} className="mt-3 rounded-2xl bg-blue-700 px-3 py-2 text-xs font-black text-white motion-smooth hover:bg-blue-800">
              {actionLabel}
            </button>
          </div>
        ))}
        {!items.length && <p className="text-sm font-bold text-slate-400">{empty}</p>}
      </div>
    </div>
  );
}

function SettingsPanel(props: {
  activeArea: AppArea;
  currentUser: Profile;
  profiles: Profile[];
  profileAreas: ProfileArea[];
  profileModulePermissions: ProfileModulePermission[];
  channels: Channel[];
  campaignAudiences: CampaignAudience[];
  postTemplates: PostTemplate[];
  productLines: ProductLine[];
  vehicleTypes: VehicleType[];
  contentTypes: ContentType[];
  funnelStages: FunnelStage[];
  calendarDates: CalendarDate[];
  configTab: ConfigTab;
  setConfigTab: Dispatch<SetStateAction<ConfigTab>>;
  setProfiles: Dispatch<SetStateAction<Profile[]>>;
  setProfileAreas: Dispatch<SetStateAction<ProfileArea[]>>;
  setProfileModulePermissions: Dispatch<SetStateAction<ProfileModulePermission[]>>;
  setChannels: Dispatch<SetStateAction<Channel[]>>;
  setCampaignAudiences: Dispatch<SetStateAction<CampaignAudience[]>>;
  setPostTemplates: Dispatch<SetStateAction<PostTemplate[]>>;
  setProductLines: Dispatch<SetStateAction<ProductLine[]>>;
  setVehicleTypes: Dispatch<SetStateAction<VehicleType[]>>;
  setContentTypes: Dispatch<SetStateAction<ContentType[]>>;
  setFunnelStages: Dispatch<SetStateAction<FunnelStage[]>>;
  setCalendarDates: Dispatch<SetStateAction<CalendarDate[]>>;
  uploadProfilePhoto: (profileId: string, file: File) => void;
  sendPasswordResetForProfile: (profile: Profile) => Promise<void>;
  setModal: Dispatch<SetStateAction<ModalState>>;
}) {
  const tabs = props.activeArea === "marketing" ? marketingConfigTabs : salesConfigTabs;
  const canManageSharedSettings =
    hasModulePermission(props.currentUser, "marketing", "configuracoes", "manage", props.profileAreas, props.profileModulePermissions) ||
    hasModulePermission(props.currentUser, "vendas", "configuracoes", "manage", props.profileAreas, props.profileModulePermissions);
  return (
    <div className="space-y-5">
      <Panel title="Configurações">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button key={tab} onClick={() => props.setConfigTab(tab)} className={`rounded-2xl px-4 py-2 text-sm font-black ${props.configTab === tab ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}>
              {tab}
            </button>
          ))}
        </div>
      </Panel>
      {props.configTab === "Equipe" && <TeamSettings {...props} />}
      {props.activeArea === "marketing" && props.configTab === "Funil" && <FunnelSettings funnelStages={props.funnelStages} setFunnelStages={props.setFunnelStages} />}
      {props.activeArea === "marketing" && props.configTab === "Filtros" && <ChannelsLinesSettings channels={props.channels} campaignAudiences={props.campaignAudiences} productLines={props.productLines} vehicleTypes={props.vehicleTypes} contentTypes={props.contentTypes} setChannels={props.setChannels} setCampaignAudiences={props.setCampaignAudiences} setProductLines={props.setProductLines} setVehicleTypes={props.setVehicleTypes} setContentTypes={props.setContentTypes} />}
      {props.activeArea === "marketing" && props.configTab === "Modelos" && <PostTemplateSettings templates={props.postTemplates} setTemplates={props.setPostTemplates} channels={props.channels} contentTypes={props.contentTypes} funnelStages={props.funnelStages} />}
      {props.activeArea === "marketing" && props.configTab === "Datas" && <CalendarDateSettings calendarDates={props.calendarDates} setCalendarDates={props.setCalendarDates} />}
      {props.configTab === "Conta e Permissões" && <PermissionsSettings currentUser={props.currentUser} setProfiles={props.setProfiles} canManageIntegrations={canManageSharedSettings} />}
    </div>
  );
}

function TeamSettings({ profiles, profileAreas, profileModulePermissions, setProfiles, uploadProfilePhoto, currentUser, setModal, sendPasswordResetForProfile }: Parameters<typeof SettingsPanel>[0]) {
  const canManageTeam =
    hasModulePermission(currentUser, "marketing", "configuracoes", "manage", profileAreas, profileModulePermissions) ||
    hasModulePermission(currentUser, "vendas", "configuracoes", "manage", profileAreas, profileModulePermissions);
  const [teamFilter, setTeamFilter] = useState<"Todos" | "Marketing" | "Vendas" | "Sem equipe">("Todos");
  const [resettingProfileId, setResettingProfileId] = useState("");
  const [sendingMagicLinkId, setSendingMagicLinkId] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const pendingCount = profiles.filter((p) => !p.active).length;
  const areaSetForProfile = (profileId: string) => new Set(profileAreas.filter((area) => area.profileId === profileId && area.active).map((area) => area.area));
  const filteredProfiles = profiles.filter((profile) => {
    const areas = areaSetForProfile(profile.id);
    if (teamFilter === "Marketing") return areas.has("marketing");
    if (teamFilter === "Vendas") return areas.has("vendas");
    if (teamFilter === "Sem equipe") return areas.size === 0;
    return true;
  });
  const sortedProfiles = [...filteredProfiles].sort((a, b) => {
    if (a.active === b.active) return a.name.localeCompare(b.name);
    return a.active ? 1 : -1;
  });
  const filterCounts = {
    Todos: profiles.length,
    Marketing: profiles.filter((profile) => areaSetForProfile(profile.id).has("marketing")).length,
    Vendas: profiles.filter((profile) => areaSetForProfile(profile.id).has("vendas")).length,
    "Sem equipe": profiles.filter((profile) => areaSetForProfile(profile.id).size === 0).length
  };
  async function sendMagicLink(profile: Profile) {
    if (!canManageTeam || sendingMagicLinkId || !supabase) return;
    setSendingMagicLinkId(profile.id);
    setResetMessage("");
    setResetError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: profile.email });
      if (error) throw error;
      setResetMessage(`Link de acesso enviado para ${profile.email}.`);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : "Não foi possível enviar o link de acesso.");
    } finally {
      setSendingMagicLinkId("");
    }
  }

  async function sendReset(profile: Profile) {
    if (!canManageTeam || resettingProfileId) return;
    setResettingProfileId(profile.id);
    setResetMessage("");
    setResetError("");
    try {
      await sendPasswordResetForProfile(profile);
      setResetMessage(`Email de redefinição enviado para ${profile.email}.`);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : "Não foi possível enviar o email de redefinição.");
    } finally {
      setResettingProfileId("");
    }
  }
  return (
    <Panel title="Equipe">
      {pendingCount > 0 && canManageTeam && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          ⚠️ {pendingCount} cadastro{pendingCount === 1 ? "" : "s"} aguardando sua aprovação. Clique em "editar" e marque "Membro ativo" para liberar o acesso.
        </div>
      )}
      {canManageTeam && (
        <div className="mb-5 rounded-3xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-900">
          Novas pessoas entram pelo botão "Criar conta" na tela de login. Depois disso, um Gestor ou Administrador aprova o cadastro aqui.
        </div>
      )}
      {resetMessage && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{resetMessage}</div>}
      {resetError && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{resetError}</div>}
      <div className="mb-5 flex flex-wrap gap-2">
        {(["Todos", "Marketing", "Vendas", "Sem equipe"] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setTeamFilter(filter)}
            className={`rounded-2xl px-4 py-2 text-sm font-black transition ${teamFilter === filter ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"}`}
          >
            {filter} <span className="opacity-70">{filterCounts[filter]}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-3">
        {sortedProfiles.map((profile) => (
          <div
            key={profile.id}
            className={`grid gap-3 rounded-3xl border p-4 shadow-sm md:grid-cols-[auto_1fr_190px_auto_auto] md:items-center ${
              !profile.active ? "border-amber-300 bg-amber-50/40" : "border-slate-100 bg-white"
            }`}
          >
            <label className="cursor-pointer">
              <Avatar profile={profile} size="md" />
              {canManageTeam && <input type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && uploadProfilePhoto(profile.id, event.target.files[0])} />}
            </label>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-black">{profile.name}</p>
                {!profile.active && <Badge tone="amber">PENDENTE</Badge>}
              </div>
              <p className="text-sm text-slate-500">{profile.email}</p>
              <p className="mt-1 text-xs font-bold text-slate-400">{profile.phone || "Sem telefone"} · {profile.active ? "Ativo" : "Aguardando aprovação"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {areaSetForProfile(profile.id).has("marketing") && <Badge tone="blue">Marketing</Badge>}
                {areaSetForProfile(profile.id).has("vendas") && <Badge tone="purple">Vendas</Badge>}
                {areaSetForProfile(profile.id).size === 0 && <Badge tone="slate">Sem equipe</Badge>}
              </div>
            </div>
            <Badge tone="blue">{roleLabel[profile.role]}</Badge>
            {canManageTeam && (
              <div className="flex flex-wrap gap-2">
                <div className="relative group">
                  <button
                    type="button"
                    disabled={sendingMagicLinkId === profile.id}
                    onClick={() => sendMagicLink(profile)}
                    className="rounded-2xl bg-violet-100 p-2 text-violet-700 transition hover:bg-violet-200 disabled:cursor-wait disabled:opacity-50"
                    aria-label="Enviar magic link"
                  >
                    {sendingMagicLinkId === profile.id ? <span className="block h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" /> : <Wand2 size={16} />}
                  </button>
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-48 -translate-x-1/2 rounded-2xl bg-slate-900 px-3 py-2 text-center text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                    Magic link — envia um link por email para a pessoa entrar sem precisar de senha
                  </div>
                </div>
                <button
                  type="button"
                  disabled={resettingProfileId === profile.id}
                  onClick={() => sendReset(profile)}
                  className="rounded-2xl bg-emerald-100 px-3 py-2 text-sm font-black text-emerald-700 disabled:cursor-wait disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {resettingProfileId === profile.id ? "Enviando..." : "Redefinir senha"}
                </button>
                <button onClick={() => setModal({ kind: "teamMember", id: profile.id })} className="rounded-2xl bg-blue-100 px-3 py-2 text-sm font-black text-blue-700">editar</button>
                <button onClick={() => setProfiles((current) => current.filter((item) => item.id !== profile.id))} className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600">excluir</button>
              </div>
            )}
          </div>
        ))}
        {!sortedProfiles.length && <p className="rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-400">Nenhum membro encontrado neste filtro.</p>}
      </div>
    </Panel>
  );
}

function FunnelSettings({ funnelStages, setFunnelStages }: { funnelStages: FunnelStage[]; setFunnelStages: Dispatch<SetStateAction<FunnelStage[]>> }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  function addStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name"));
    setFunnelStages((current) => [...current, { id: slug(name), name, color: String(form.get("color")), order: current.length + 1 }]);
    event.currentTarget.reset();
  }
  function reorder(event: DragEndEvent) {
    const active = String(event.active.id);
    const over = String(event.over?.id ?? "");
    if (!over || active === over) return;
    setFunnelStages((current) => {
      const sorted = current.slice().sort((a, b) => a.order - b.order);
      const next = arrayMove(sorted, sorted.findIndex((item) => item.id === active), sorted.findIndex((item) => item.id === over));
      return next.map((item, index) => ({ ...item, order: index + 1 }));
    });
  }
  const sorted = funnelStages.slice().sort((a, b) => a.order - b.order);
  return (
    <Panel title="Funil visual">
      <form onSubmit={addStage} className="mb-5 grid gap-3 md:grid-cols-[1fr_90px_auto] md:items-end">
        <TextInput name="name" label="Nova etapa" required />
        <label className="block text-sm font-bold text-slate-600">Cor<input name="color" type="color" defaultValue="#2563eb" className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white p-1" /></label>
        <SubmitButton>Adicionar</SubmitButton>
      </form>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={reorder}>
        <SortableContext items={sorted.map((stage) => stage.id)} strategy={verticalListSortingStrategy}>
          <div className="mx-auto max-w-3xl space-y-2">
            {sorted.map((stage, index) => <FunnelStageRow key={stage.id} stage={stage} index={index} total={sorted.length} setFunnelStages={setFunnelStages} />)}
          </div>
        </SortableContext>
      </DndContext>
    </Panel>
  );
}

function FunnelStageRow({ stage, index, total, setFunnelStages }: { stage: FunnelStage; index: number; total: number; setFunnelStages: Dispatch<SetStateAction<FunnelStage[]>> }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: stage.id });
  const width = 100 - index * (42 / Math.max(total - 1, 1));
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, width: `${width}%`, backgroundColor: stage.color }} className="mx-auto flex items-center gap-3 rounded-3xl px-4 py-4 text-white shadow-lg">
      <button {...attributes} {...listeners} className="rounded-xl bg-white/20 p-1"><GripVertical size={18} /></button>
      <input value={stage.name} onChange={(event) => setFunnelStages((current) => current.map((item) => item.id === stage.id ? { ...item, name: event.target.value } : item))} lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences" className="min-w-0 flex-1 bg-transparent font-black outline-none" />
      <button onClick={() => window.confirm("Excluir etapa do funil?") && setFunnelStages((current) => current.filter((item) => item.id !== stage.id).map((item, nextIndex) => ({ ...item, order: nextIndex + 1 })))} className="rounded-xl bg-white/20 p-1" title="Excluir etapa">
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function ChannelsLinesSettings({
  channels,
  campaignAudiences,
  productLines,
  vehicleTypes,
  contentTypes,
  setChannels,
  setCampaignAudiences,
  setProductLines,
  setVehicleTypes,
  setContentTypes
}: {
  channels: Channel[];
  campaignAudiences: CampaignAudience[];
  productLines: ProductLine[];
  vehicleTypes: VehicleType[];
  contentTypes: ContentType[];
  setChannels: Dispatch<SetStateAction<Channel[]>>;
  setCampaignAudiences: Dispatch<SetStateAction<CampaignAudience[]>>;
  setProductLines: Dispatch<SetStateAction<ProductLine[]>>;
  setVehicleTypes: Dispatch<SetStateAction<VehicleType[]>>;
  setContentTypes: Dispatch<SetStateAction<ContentType[]>>;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Canais">
        <button onClick={() => { const name = window.prompt("Novo canal"); if (name) setChannels((current) => [...current, { id: slug(name), name, color: "#2563eb" }]); }} className="mb-4 rounded-2xl bg-blue-700 px-4 py-2 text-sm font-black text-white">Adicionar canal</button>
        <div className="space-y-2">{channels.map((channel) => <div key={channel.id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 font-black"><span>{channel.name}</span><button onClick={() => window.confirm("Excluir canal?") && setChannels((current) => current.filter((item) => item.id !== channel.id))} className="text-rose-600"><Trash2 size={16} /></button></div>)}</div>
      </Panel>
      <SimpleConfigPanel title="Públicos" addLabel="Adicionar público" promptLabel="Novo público" deleteLabel="Excluir público?" items={campaignAudiences} setItems={setCampaignAudiences} />
      <SimpleConfigPanel title="Linhas de produto" addLabel="Adicionar linha" promptLabel="Nova linha de produto" deleteLabel="Excluir linha de produto?" items={productLines} setItems={setProductLines} />
      <SimpleConfigPanel title="Tipos de veículo" addLabel="Adicionar tipo" promptLabel="Novo tipo de veículo" deleteLabel="Excluir tipo de veículo?" items={vehicleTypes} setItems={setVehicleTypes} />
      <SimpleConfigPanel title="Tipos de conteúdo" addLabel="Adicionar tipo" promptLabel="Novo tipo de conteúdo" deleteLabel="Excluir tipo de conteúdo?" items={contentTypes} setItems={setContentTypes} />
    </div>
  );
}

function SimpleConfigPanel<T extends { id: string; name: string }>({ title, addLabel, promptLabel, deleteLabel, items, setItems }: { title: string; addLabel: string; promptLabel: string; deleteLabel: string; items: T[]; setItems: Dispatch<SetStateAction<T[]>> }) {
  return (
    <Panel title={title}>
      <button onClick={() => { const name = window.prompt(promptLabel); if (name) setItems((current) => [...current, { id: slug(name), name } as T]); }} className="mb-4 rounded-2xl bg-blue-700 px-4 py-2 text-sm font-black text-white">{addLabel}</button>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex gap-2">
            <input value={item.name} onChange={(event) => setItems((current) => current.map((currentItem) => currentItem.id === item.id ? { ...currentItem, name: event.target.value } : currentItem))} lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences" className="min-w-0 flex-1 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 font-black outline-none focus:border-blue-500" />
            <button onClick={() => window.confirm(deleteLabel) && setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))} className="rounded-2xl bg-rose-100 px-3 text-rose-700"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PostTemplateSettings({ templates, setTemplates, channels, contentTypes, funnelStages }: { templates: PostTemplate[]; setTemplates: Dispatch<SetStateAction<PostTemplate[]>>; channels: Channel[]; contentTypes: ContentType[]; funnelStages: FunnelStage[] }) {
  const [editingTemplate, setEditingTemplate] = useState<PostTemplate | "new" | null>(null);
  return (
    <Panel title="Modelos de postagem">
      <div className="mb-5 grid place-items-center rounded-3xl border border-dashed border-blue-200 bg-blue-50/60 p-6">
        <RoundAdd onClick={() => setEditingTemplate("new")} label="Adicionar modelo" />
        <p className="mt-3 text-sm font-black text-blue-700">Adicionar modelo</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {templates.map((template) => (
          <div key={template.id} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-black">{template.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm font-bold text-slate-500">{template.description}</p>
              </div>
              <Badge tone="blue">{channels.find((channel) => channel.id === template.channelId)?.name ?? "Canal"}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="slate">{contentTypes.find((type) => type.id === template.contentTypeId)?.name ?? "Conteúdo"}</Badge>
              <Badge tone="slate">{template.format || "Formato"}</Badge>
              {template.suggestedTime && <Badge tone="amber">{template.suggestedTime}</Badge>}
              <Badge tone="slate">{funnelStages.find((stage) => stage.id === template.funnelStageId)?.name ?? "Sem funil"}</Badge>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setEditingTemplate(template)} className="rounded-2xl bg-blue-100 px-3 py-2 text-sm font-black text-blue-700">Editar</button>
              <button type="button" onClick={() => window.confirm("Excluir este modelo?") && setTemplates((current) => current.filter((item) => item.id !== template.id))} className="rounded-2xl bg-rose-100 px-3 py-2 text-rose-700"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>
      {editingTemplate && <PostTemplateModal template={editingTemplate === "new" ? undefined : editingTemplate} setTemplates={setTemplates} channels={channels} contentTypes={contentTypes} funnelStages={funnelStages} close={() => setEditingTemplate(null)} />}
    </Panel>
  );
}

function PostTemplateModal({ template, setTemplates, channels, contentTypes, funnelStages, close }: { template?: PostTemplate; setTemplates: Dispatch<SetStateAction<PostTemplate[]>>; channels: Channel[]; contentTypes: ContentType[]; funnelStages: FunnelStage[]; close: () => void }) {
  const [selectedChannelId, setSelectedChannelId] = useState(template?.channelId ?? channels[0]?.id ?? "");
  const [structureItems, setStructureItems] = useState<string[]>(template?.structureItems?.length ? template.structureItems : textLines(template?.structure ?? ""));
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(template?.checklistItems?.length ? template.checklistItems : textLines(template?.checklist ?? "").map((label, index) => ({ id: `draft-check-${index + 1}`, label, done: false })));
  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId);
  const formatOptions = postFormatOptionsForChannel(selectedChannel);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    if (!name) return;
    const value: PostTemplate = {
      id: template?.id ?? `${slug(name)}-${crypto.randomUUID().slice(0, 6)}`,
      name,
      description: String(form.get("description")),
      contentTypeId: String(form.get("contentTypeId")),
      channelId: String(form.get("channelId")),
      format: String(form.get("format")),
      suggestedTime: String(form.get("suggestedTime")),
      funnelStageId: String(form.get("funnelStageId")),
      structure: structureItems.join("\n"),
      checklist: checklistItems.map((item) => item.label).join("\n"),
      structureItems,
      checklistItems,
      visualGuidance: String(form.get("visualGuidance")),
      captionExample: String(form.get("captionExample"))
    };
    setTemplates((current) => template ? current.map((item) => item.id === template.id ? value : item) : [value, ...current]);
    close();
  }
  return (
    <CenteredModal close={close}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-blue-700">Padrão editorial</p>
            <h3 className="text-2xl font-black">{template ? "Editar modelo" : "Novo modelo"}</h3>
          </div>
          <button type="button" onClick={close} className="rounded-2xl bg-slate-100 p-2 text-slate-600"><X size={18} /></button>
        </div>
        <EntityForm onSubmit={submit}>
          <TextInput name="name" label="Nome do modelo" required defaultValue={template?.name} />
          <Select name="contentTypeId" label="Tipo de conteúdo" defaultValue={template?.contentTypeId ?? ""} options={[["", "Sem tipo de conteúdo"], ...contentTypes.map((item) => [item.id, item.name])]} />
          <label className="block text-sm font-bold text-slate-600">Canal recomendado<select name="channelId" value={selectedChannelId} onChange={(event) => setSelectedChannelId(event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-950 outline-none focus:border-blue-500">{channels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <Select key={selectedChannelId} name="format" label="Formato recomendado" defaultValue={template?.format ?? defaultPostFormatForChannel(selectedChannel)} options={formatOptions.map((item) => [item, item])} />
          <TextInput name="suggestedTime" label="Horário sugerido" type="time" defaultValue={template?.suggestedTime ?? ""} />
          <Select name="funnelStageId" label="Funil recomendado" defaultValue={template?.funnelStageId ?? ""} options={[["", "Sem funil"], ...funnelStages.map((item) => [item.id, item.name])]} />
          <TextArea name="description" label="Descrição" defaultValue={template?.description} />
          <ListEditor title="Roteiro/estrutura" items={structureItems} setItems={setStructureItems} />
          <ChecklistEditor title="Checklist de produção" items={checklistItems} setItems={setChecklistItems} />
          <TextArea name="visualGuidance" label="Orientação para arte/vídeo" defaultValue={template?.visualGuidance} />
          <TextArea name="captionExample" label="Exemplo de legenda/copy" defaultValue={template?.captionExample} />
          <SubmitButton>{template ? "Salvar" : "Criar"}</SubmitButton>
        </EntityForm>
    </CenteredModal>
  );
}

function ListEditor({ title, items, setItems }: { title: string; items: string[]; setItems: Dispatch<SetStateAction<string[]>> }) {
  return (
    <div className="space-y-2 rounded-3xl border border-slate-100 bg-slate-50 p-3 md:col-span-2">
      <p className="text-sm font-black text-slate-600">{title}</p>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-blue-100 text-xs font-black text-blue-700">{index + 1}</span>
          <input value={item} onChange={(event) => setItems((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences" className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 font-bold outline-none focus:border-blue-500" />
          <button type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-xl bg-rose-100 p-2 text-rose-700"><Trash2 size={15} /></button>
        </div>
      ))}
      <button type="button" onClick={() => setItems((current) => [...current, ""])} className="rounded-2xl bg-blue-100 px-3 py-2 text-sm font-black text-blue-700">Adicionar item</button>
    </div>
  );
}

function ChecklistEditor({ title, items, setItems }: { title: string; items: ChecklistItem[]; setItems: Dispatch<SetStateAction<ChecklistItem[]>> }) {
  return (
    <div className="space-y-2 rounded-3xl border border-slate-100 bg-slate-50 p-3 md:col-span-2">
      <p className="text-sm font-black text-slate-600">{title}</p>
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <input type="checkbox" checked={item.done} onChange={(event) => setItems((current) => current.map((value) => value.id === item.id ? { ...value, done: event.target.checked } : value))} />
          <input value={item.label} onChange={(event) => setItems((current) => current.map((value) => value.id === item.id ? { ...value, label: event.target.value } : value))} lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences" className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 font-bold outline-none focus:border-blue-500" />
          <button type="button" onClick={() => setItems((current) => current.filter((value) => value.id !== item.id))} className="rounded-xl bg-rose-100 p-2 text-rose-700"><Trash2 size={15} /></button>
        </div>
      ))}
      <button type="button" onClick={() => setItems((current) => [...current, { id: crypto.randomUUID(), label: "", done: false }])} className="rounded-2xl bg-blue-100 px-3 py-2 text-sm font-black text-blue-700">Adicionar item</button>
    </div>
  );
}

function CalendarDateSettings({ calendarDates, setCalendarDates }: { calendarDates: CalendarDate[]; setCalendarDates: Dispatch<SetStateAction<CalendarDate[]>> }) {
  const [editingDate, setEditingDate] = useState<CalendarDate | "new" | null>(null);
  const sorted = calendarDates.slice().sort((a, b) => a.date.localeCompare(b.date));
  return (
    <Panel title="Datas comemorativas e feriados">
      <div className="mb-5 grid place-items-center rounded-3xl border border-dashed border-blue-200 bg-blue-50/60 p-6">
        <RoundAdd onClick={() => setEditingDate("new")} label="Adicionar data" />
        <p className="mt-3 text-sm font-black text-blue-700">Adicionar data</p>
      </div>
      <div className="grid gap-3">
        {sorted.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="min-w-0">
              <p className="font-black">{item.name}</p>
              <p className="mt-1 text-sm font-bold text-slate-500">{formatDateOnly(new Date(`${item.date}T12:00:00`))} · {item.type}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: item.color }} />
              <button type="button" onClick={() => setEditingDate(item)} className="rounded-2xl bg-blue-100 px-3 py-2 text-sm font-black text-blue-700">Editar</button>
              <button type="button" onClick={() => window.confirm("Excluir esta data?") && setCalendarDates((current) => current.filter((date) => date.id !== item.id))} className="rounded-2xl bg-rose-100 px-3 py-2 text-rose-700"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>
      {editingDate && <CalendarDateModal date={editingDate === "new" ? undefined : editingDate} setCalendarDates={setCalendarDates} close={() => setEditingDate(null)} />}
    </Panel>
  );
}

function CalendarDateModal({ date, setCalendarDates, close }: { date?: CalendarDate; setCalendarDates: Dispatch<SetStateAction<CalendarDate[]>>; close: () => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    if (!name) return;
    const value: CalendarDate = {
      id: date?.id ?? `${slug(name)}-${crypto.randomUUID().slice(0, 6)}`,
      name,
      date: String(form.get("date")),
      type: String(form.get("type")) as CalendarDate["type"],
      color: String(form.get("color")),
      notes: String(form.get("notes"))
    };
    setCalendarDates((current) => date ? current.map((item) => item.id === date.id ? value : item) : [...current, value]);
    close();
  }
  return (
    <CenteredModal close={close}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className="text-2xl font-black">{date ? "Editar data" : "Nova data"}</h3>
          <button type="button" onClick={close} className="rounded-2xl bg-slate-100 p-2 text-slate-600"><X size={18} /></button>
        </div>
        <EntityForm onSubmit={submit}>
          <TextInput name="name" label="Nome da data" required defaultValue={date?.name} />
          <TextInput name="date" label="Data" type="date" required defaultValue={date?.date ?? todayIso()} />
          <Select name="type" label="Tipo" defaultValue={date?.type} options={["Feriado", "Data comemorativa", "Interno", "Outro"].map((item) => [item, item])} />
          <label className="block text-sm font-bold text-slate-600">Cor<input name="color" type="color" defaultValue={date?.color ?? "#2563eb"} className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white p-1" /></label>
          <TextArea name="notes" label="Observações" defaultValue={date?.notes} />
          <SubmitButton>{date ? "Salvar" : "Adicionar"}</SubmitButton>
        </EntityForm>
    </CenteredModal>
  );
}

function PermissionsSettings({ currentUser, setProfiles, canManageIntegrations }: { currentUser: Profile; setProfiles: Dispatch<SetStateAction<Profile[]>>; canManageIntegrations: boolean }) {
  const [googleStatus, setGoogleStatus] = useState<GoogleConnectionStatus | null>(null);
  const [googleLoading, setGoogleLoading] = useState(true);
  const [googleBusy, setGoogleBusy] = useState<GoogleService | null>(null);
  const [googleError, setGoogleError] = useState("");
  const [tiktokStatus, setTikTokStatus] = useState<TikTokConnectionStatus | null>(null);
  const [tiktokLoading, setTikTokLoading] = useState(true);
  const [tiktokBusy, setTikTokBusy] = useState(false);
  const [tiktokError, setTikTokError] = useState("");

  async function loadGoogleStatus() {
    setGoogleLoading(true);
    setGoogleError("");
    try {
      setGoogleStatus(await getGoogleStatus());
    } catch (error) {
      setGoogleError(error instanceof Error ? error.message : "Erro ao carregar integracao Google.");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function loadTikTokStatus() {
    setTikTokLoading(true);
    setTikTokError("");
    try {
      setTikTokStatus(await getTikTokStatus());
    } catch (error) {
      setTikTokError(error instanceof Error ? error.message : "Erro ao carregar integracao TikTok.");
    } finally {
      setTikTokLoading(false);
    }
  }

  useEffect(() => {
    loadGoogleStatus();
    loadTikTokStatus();
  }, []);

  async function connectGoogle(service: GoogleService) {
    setGoogleBusy(service);
    setGoogleError("");
    try {
      const url = await startGoogleConnection(service);
      window.location.href = url;
    } catch (error) {
      setGoogleError(error instanceof Error ? error.message : "Erro ao iniciar conexao Google.");
      setGoogleBusy(null);
    }
  }

  async function disconnectGoogle(service: GoogleService) {
    const label = service === "youtube" ? "YouTube" : "Google Drive";
    if (!window.confirm(`Desconectar ${label} para toda a equipe?`)) return;
    setGoogleBusy(service);
    setGoogleError("");
    try {
      await disconnectGoogleConnection(service);
      await loadGoogleStatus();
    } catch (error) {
      setGoogleError(error instanceof Error ? error.message : "Erro ao desconectar Google.");
    } finally {
      setGoogleBusy(null);
    }
  }

  async function connectTikTok() {
    setTikTokBusy(true);
    setTikTokError("");
    try {
      const url = await startTikTokConnection();
      window.location.href = url;
    } catch (error) {
      setTikTokError(error instanceof Error ? error.message : "Erro ao iniciar conexao TikTok.");
      setTikTokBusy(false);
    }
  }

  async function disconnectTikTok() {
    if (!window.confirm("Desconectar TikTok Sandbox para toda a equipe?")) return;
    setTikTokBusy(true);
    setTikTokError("");
    try {
      await disconnectTikTokConnection();
      await loadTikTokStatus();
    } catch (error) {
      setTikTokError(error instanceof Error ? error.message : "Erro ao desconectar TikTok.");
    } finally {
      setTikTokBusy(false);
    }
  }

  const googleIntegrations: Array<{ service: GoogleService; title: string; description: string }> = [
    {
      service: "drive",
      title: "Google Drive",
      description: "Arquivos, pastas, previews e links do Drive usados em anexos e revisoes."
    },
    {
      service: "youtube",
      title: "YouTube",
      description: "Importacao de videos e metricas do canal conectado."
    }
  ];

  return (
    <Panel title="Conta e permissões">
      <div className="space-y-4 rounded-3xl bg-slate-50 p-5">
        <div>
          <p className="font-black">{currentUser.name}</p>
          <p className="mt-1 text-sm text-slate-500">{currentUser.email}</p>
          <p className="mt-4 text-sm font-bold text-blue-700">Função atual: {roleLabel[currentUser.role]}</p>
        </div>
        <label className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4">
          <span>
            <span className="block font-black">Som de notificações</span>
            <span className="text-sm font-bold text-slate-500">Tocar um aviso quando chegar algo novo.</span>
          </span>
          <input type="checkbox" checked={currentUser.notificationSound} onChange={(event) => setProfiles((current) => current.map((profile) => profile.id === currentUser.id ? { ...profile, notificationSound: event.target.checked } : profile))} className="h-5 w-5" />
        </label>
        <div className="rounded-3xl bg-white p-4">
          <div>
            <p className="font-black">Integrações Google corporativas</p>
            <p className="mt-1 text-sm font-bold text-slate-500">
              Conecte Drive e YouTube separadamente. Cada integracao fica salva para toda a equipe.
            </p>
            {!canManageIntegrations && (
              <p className="mt-2 text-xs font-bold text-slate-400">
                Apenas Administrador ou Gestor pode conectar ou desconectar integrações Google.
              </p>
            )}
            {googleError && <p className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{googleError}</p>}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {googleIntegrations.map((integration) => {
              const serviceStatus = googleStatus?.[integration.service];
              const busy = googleBusy === integration.service;
              const connectedEmail = serviceStatus?.googleEmail?.trim();
              return (
                <div key={integration.service} className="rounded-[26px] border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{integration.title}</p>
                      <p className="mt-1 text-sm font-bold text-slate-500">{integration.description}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${serviceStatus?.connected ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                      {googleLoading ? "Verificando" : serviceStatus?.connected ? "Conectado" : "Desconectado"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-black text-slate-700">
                    {googleLoading
                      ? "Verificando conexao..."
                      : serviceStatus?.connected
                        ? "Conta conectada"
                        : "Nenhuma conta conectada"}
                  </p>
                  {serviceStatus?.connected && (
                    <div className="mt-2 rounded-2xl border border-emerald-100 bg-white px-3 py-2">
                      <p className="text-xs font-black uppercase text-slate-400">Email conectado</p>
                      <p className="mt-0.5 break-all text-sm font-black text-emerald-700">
                        {connectedEmail || "Email nao identificado pelo Google"}
                      </p>
                    </div>
                  )}
                  {serviceStatus?.connectedAt && (
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      Conectado em {new Date(serviceStatus.connectedAt).toLocaleString("pt-BR")}
                    </p>
                  )}
                  {canManageIntegrations && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" disabled={Boolean(googleBusy) || googleLoading} onClick={() => connectGoogle(integration.service)} className="rounded-2xl bg-blue-700 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400">
                        {busy ? "Abrindo..." : serviceStatus?.connected ? "Reconectar" : "Conectar"}
                      </button>
                      {serviceStatus?.connected && (
                        <button type="button" disabled={Boolean(googleBusy) || googleLoading} onClick={() => disconnectGoogle(integration.service)} className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-600 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50">
                          Desconectar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-[26px] border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black">TikTok Sandbox</p>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Conexão OAuth em sandbox para ler perfil, estatísticas básicas e vídeos públicos.
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${tiktokStatus?.connected ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                {tiktokLoading ? "Verificando" : tiktokStatus?.connected ? "Conectado" : "Desconectado"}
              </span>
            </div>
            {tiktokError && <p className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{tiktokError}</p>}
            <div className="mt-3 rounded-2xl border border-slate-100 bg-white px-3 py-2">
              <p className="text-xs font-black uppercase text-slate-400">Status</p>
              <div className="mt-1 flex items-center gap-3">
                {tiktokStatus?.avatarUrl && <img src={tiktokStatus.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />}
                <div>
                  <p className="break-all text-sm font-black text-slate-800">
                    {tiktokLoading
                      ? "Verificando conexao..."
                      : tiktokStatus?.connected
                        ? `Conectado como ${tiktokStatus.displayName || tiktokStatus.openId || "conta TikTok"}`
                        : "Nenhuma conta TikTok conectada"}
                  </p>
                  <p className="text-xs font-bold text-slate-400">
                    Ambiente: {tiktokStatus?.environment === "production" ? "Produção" : "Sandbox"}
                  </p>
                </div>
              </div>
            </div>
            {tiktokStatus?.connectedAt && (
              <p className="mt-1 text-xs font-bold text-slate-400">
                Conectado em {new Date(tiktokStatus.connectedAt).toLocaleString("pt-BR")}
              </p>
            )}
            {canManageIntegrations ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={tiktokBusy || tiktokLoading} onClick={connectTikTok} className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400">
                  {tiktokBusy ? "Abrindo..." : tiktokStatus?.connected ? "Reconectar" : "Conectar TikTok Sandbox"}
                </button>
                {tiktokStatus?.connected && (
                  <button type="button" disabled={tiktokBusy || tiktokLoading} onClick={disconnectTikTok} className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-600 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50">
                    Desconectar
                  </button>
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs font-bold text-slate-400">Apenas Administrador ou Gestor pode conectar ou desconectar TikTok.</p>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function EntityModal(props: {
  modal: ModalState;
  setModal: Dispatch<SetStateAction<ModalState>>;
  currentUser: Profile;
  profiles: Profile[];
  profileAreas: ProfileArea[];
  profileModulePermissions: ProfileModulePermission[];
  profileById: Map<string, Profile>;
  channels: Channel[];
  productLines: ProductLine[];
  vehicleTypes: VehicleType[];
  contentTypes: ContentType[];
  funnelStages: FunnelStage[];
  campaigns: Campaign[];
  campaignAudiences: CampaignAudience[];
  postTemplates: PostTemplate[];
  posts: EditorialPost[];
  setPosts: Dispatch<SetStateAction<EditorialPost[]>>;
  postReviewAssets: PostReviewAsset[];
  addPostReviewAssets: (post: EditorialPost, files: FileList | File[], isCover?: boolean) => void;
  addPostReviewExternalAsset: (post: EditorialPost, url: string, previewUrl?: string, mimeType?: string, isCover?: boolean) => void;
  deletePostReviewAsset: (assetId: string) => void;
  setReviewAssetStatus: (assetId: string, status: ReviewAssetStatus, message?: string) => void;
  addReviewComment: (assetId: string, message: string) => void;
  ideas: Idea[];
  setIdeas: Dispatch<SetStateAction<Idea[]>>;
  addIdeaAttachment: (ideaId: string, file: File) => void;
  addIdeaExternalLink: (ideaId: string, url: string) => void;
  prepareIdeaAttachment: (ideaId: string, file: File) => Promise<TaskAttachment>;
  openMediaPreview: (item: MediaPreviewItem) => void;
  createNotifications: (userIds: string[], title: string, description: string, targetKind: Notification["targetKind"], targetId: string) => void;
  setCampaigns: Dispatch<SetStateAction<Campaign[]>>;
  metrics: PostMetric[];
  setMetrics: Dispatch<SetStateAction<PostMetric[]>>;
  setProfiles: Dispatch<SetStateAction<Profile[]>>;
  setProfileAreas: Dispatch<SetStateAction<ProfileArea[]>>;
  setProfileModulePermissions: Dispatch<SetStateAction<ProfileModulePermission[]>>;
  uploadProfilePhoto: (profileId: string, file: File) => void;
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  taskColumns: TaskColumn[];
  taskBoards: TaskBoard[];
  updateTask: (taskId: string, updater: (task: Task) => Task) => void;
  addTaskAttachment: (taskId: string, file: File) => void;
  deleteTaskAttachment: (taskId: string, attachment: TaskAttachment) => void;
  addTaskExternalLink: (taskId: string, url: string) => void;
  addSubtask: (task: Task, title?: string) => void;
}) {
  if (!props.modal) return null;
  const modal = props.modal;
  const close = () => props.setModal(null);
  const task = modal.kind === "task" ? props.tasks.find((item) => item.id === modal.id) : undefined;
  const modalContentRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (modal.kind === "task") {
      modalContentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [modal.kind, task?.id]);
  return (
    <CenteredModal
      close={close}
      panelRef={modalContentRef}
      closeOnOverlay={modal.kind !== "publish"}
    >
        <div className="mb-5 flex items-start justify-between gap-4 rounded-[26px] bg-gradient-to-r from-blue-50 to-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-black text-blue-700">Gestão Embrepoli</p>
            <h2 className="text-2xl font-black">{modalTitle(modal)}</h2>
          </div>
          <button onClick={close} className="rounded-2xl bg-white p-2 text-slate-500 shadow-sm transition hover:text-slate-950"><X size={20} /></button>
        </div>
        {modal.kind === "task" && task && <TaskModal key={task.id} task={task} {...props} close={close} />}
        {modal.kind === "post" && <PostModalV2 {...props} close={close} />}
        {modal.kind === "idea" && <IdeaModalV2 {...props} close={close} />}
        {modal.kind === "campaign" && <CampaignModalV2 {...props} close={close} />}
        {modal.kind === "metric" && <MetricModalV2 {...props} close={close} />}
        {modal.kind === "profile" && <ProfileModal {...props} close={close} />}
        {modal.kind === "teamMember" && <TeamMemberModal {...props} close={close} />}
        {modal.kind === "publish" && (() => {
          const publishPost = props.posts.find((p) => p.id === modal.postId);
          if (!publishPost) return null;
          return <PublishModal post={publishPost} postReviewAssets={props.postReviewAssets} channels={props.channels} setPosts={props.setPosts} addPostReviewAssets={props.addPostReviewAssets} close={close} />;
        })()}
    </CenteredModal>
  );
}

function modalTitle(modal: NonNullable<ModalState>) {
  if (modal.kind === "task") return "Editar tarefa";
  if (modal.kind === "post") return modal.id ? "Editar post" : "Novo post";
  if (modal.kind === "idea") return modal.id ? "Editar ideia" : "Nova ideia";
  if (modal.kind === "campaign") return modal.id ? "Editar campanha" : "Nova campanha";
  if (modal.kind === "profile") return "Editar perfil";
  if (modal.kind === "teamMember") return "Editar membro";
  if (modal.kind === "publish") return "Publicar / Agendar";
  return modal.id ? "Editar métrica" : "Nova métrica";
}

function MediaPreviewModal({ item, close }: { item: MediaPreviewItem; close: () => void }) {
  return (
    <CenteredModal close={close} zClass="z-[120]" variant="media" className="bg-slate-950/75" panelClassName="border-0 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="line-clamp-1 font-black">{item.name}</h3>
          <button type="button" onClick={close} className="rounded-2xl bg-slate-100 p-2 text-slate-600"><X size={18} /></button>
        </div>
        <MediaPreviewContent item={item} large />
    </CenteredModal>
  );
}

function MediaPreviewContent({ item, large = false }: { item: MediaPreviewItem; large?: boolean }) {
  const source = item.previewUrl || item.url;
  if (item.source === "external") {
    return <iframe src={source} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className={`${large ? "h-[72vh]" : "aspect-video"} w-full rounded-3xl border border-slate-200 bg-white`} />;
  }
  if (item.type === "foto") {
    return <img src={source} alt={item.name} className={`${large ? "max-h-[72vh]" : "max-h-64"} w-full rounded-3xl object-contain bg-slate-50`} />;
  }
  if (item.type === "video") {
    return <video src={source} controls className={`${large ? "max-h-[72vh]" : "max-h-64"} w-full rounded-3xl bg-black`} />;
  }
  if (isDocumentFile(item)) {
    return (
      <div className="space-y-3">
        <iframe
          src={buildEmbeddedViewerUrl(item)}
          title={item.name}
          className={`${large ? "h-[64vh]" : "h-96"} w-full rounded-3xl border border-slate-200 bg-white`}
        />
        <div className="flex flex-wrap gap-2">
          <a href={buildOnlineViewerUrl(item)} target="_blank" rel="noreferrer"
             className="flex-1 rounded-2xl bg-blue-700 px-4 py-3 text-center text-sm font-black text-white hover:bg-blue-800">
            Abrir em tela cheia
          </a>
          <a href={buildDownloadUrl(item)} download={item.name} target="_blank" rel="noreferrer"
             className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm font-black text-slate-700 hover:bg-slate-200">
            Baixar
          </a>
        </div>
      </div>
    );
  }
  return <a href={item.url} target="_blank" className="block rounded-3xl bg-slate-50 p-8 text-center font-black text-blue-700">Abrir arquivo: {item.name}</a>;
}

function FileActionButtons({ item, onPreview }: {
  item: { name: string; url: string; previewUrl?: string; mimeType?: string; source: "upload" | "external" };
  onPreview?: () => void;
}) {
  const isDoc = isDocumentFile(item);
  return (
    <div className="flex items-center gap-1">
      {onPreview && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onPreview(); }}
          className="rounded-xl bg-slate-100 p-1.5 text-slate-600 hover:bg-blue-100 hover:text-blue-700"
          title="Visualizar">
          <Eye size={14} />
        </button>
      )}
      {isDoc && (
        <a href={buildOnlineViewerUrl(item)} target="_blank" rel="noreferrer"
           onClick={(e) => e.stopPropagation()}
           className="rounded-xl bg-slate-100 p-1.5 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700"
           title="Abrir online (sem baixar)">
          <FileText size={14} />
        </a>
      )}
      <a href={buildDownloadUrl(item)} download={item.name} target="_blank" rel="noreferrer"
         onClick={(e) => e.stopPropagation()}
         className="rounded-xl bg-slate-100 p-1.5 text-slate-600 hover:bg-blue-100 hover:text-blue-700"
         title="Baixar">
        <Download size={14} />
      </a>
    </div>
  );
}

const SELECTABLE_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "video/mp4", "video/quicktime", "video/avi", "video/webm", "video/mov",
  "application/pdf",
]);

function driveItemIcon(item: DriveItem) {
  if (item.isFolder) return <Folder size={20} className="shrink-0 text-yellow-500" />;
  if (item.mimeType.startsWith("image/")) return <FileImage size={20} className="shrink-0 text-blue-400" />;
  if (item.mimeType.startsWith("video/")) return <FileVideo size={20} className="shrink-0 text-purple-400" />;
  return <File size={20} className="shrink-0 text-slate-400" />;
}

function DriveThumb({ fileId, alt, className, fallback }: {
  fileId: string; alt: string; className?: string; fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (!fileId) return;
    let active = true;
    let objectUrl = "";
    setFailed(false);
    fetchDriveThumbnailObjectUrl(fileId)
      .then((url) => {
        objectUrl = url;
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  if (!src || failed) return <>{fallback}</>;
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}

function DriveExplorerModal({ onSelect, onClose }: { onSelect: (file: DriveFile) => void; onClose: () => void }) {
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([{ id: "root", name: "Meu Drive" }]);
  const currentFolder = breadcrumb[breadcrumb.length - 1];

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const files = await listDriveFolder("root");
        if (!active) return;
        setItems(files);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Erro ao acessar o Google Drive.");
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => { active = false; };
  }, []);

  async function openFolder(folder: DriveItem) {
    setLoading(true);
    setError("");
    setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name }]);
    try {
      const files = await listDriveFolder(folder.id);
      setItems(files);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao abrir pasta.");
    } finally {
      setLoading(false);
    }
  }

  async function navigateTo(index: number) {
    const target = breadcrumb[index];
    setLoading(true);
    setError("");
    setBreadcrumb((prev) => prev.slice(0, index + 1));
    try {
      const files = await listDriveFolder(target.id);
      setItems(files);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao navegar.");
    } finally {
      setLoading(false);
    }
  }

  function selectFile(item: DriveItem) {
    onSelect({
      id: item.id,
      name: item.name,
      mimeType: item.mimeType,
      url: `https://drive.google.com/file/d/${item.id}/view`,
      previewUrl: `https://drive.google.com/file/d/${item.id}/preview`,
      thumbnailUrl: item.thumbnailLink,
    });
    onClose();
  }

  const folders = items.filter((i) => i.isFolder);
  const files = items.filter((i) => !i.isFolder && SELECTABLE_MIME_TYPES.has(i.mimeType));
  const others = items.filter((i) => !i.isFolder && !SELECTABLE_MIME_TYPES.has(i.mimeType));

  return (
    <CenteredModal close={onClose} zClass="z-[120]" variant="fullscreen-ish" className="bg-slate-950/75" panelClassName="flex h-[82vh] flex-col overflow-hidden rounded-[28px] border-0 p-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <HardDrive size={20} className="text-blue-600" />
            <h2 className="font-black">Google Drive</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl bg-slate-100 p-2 hover:bg-slate-200"><X size={18} /></button>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-0.5 overflow-x-auto border-b border-slate-100 px-4 py-2">
          {breadcrumb.map((crumb, i) => (
            <div key={crumb.id} className="flex shrink-0 items-center gap-0.5">
              {i > 0 && <ChevronRight size={14} className="text-slate-400" />}
              <button
                type="button"
                onClick={() => i < breadcrumb.length - 1 && navigateTo(i)}
                className={`rounded-lg px-2 py-1 text-sm font-bold transition ${i === breadcrumb.length - 1 ? "text-slate-900" : "cursor-pointer text-blue-600 hover:bg-blue-50"}`}
              >
                {crumb.name}
              </button>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm font-bold text-slate-400">Carregando...</p>
            </div>
          )}
          {error && (
            (() => {
              const isTokenError = /expired|revoked|invalid.grant|invalid_grant/i.test(error);
              return (
                <div className="rounded-2xl bg-rose-50 p-5 text-rose-700">
                  {isTokenError ? (
                    <div className="space-y-3 text-center">
                      <p className="text-3xl">🔗</p>
                      <p className="font-black">Conexão com o Google Drive expirou</p>
                      <p className="text-sm font-bold text-rose-500">O acesso precisa ser renovado.</p>
                      <p className="text-sm font-bold text-rose-500">
                        Feche este modal e vá em <span className="rounded bg-rose-100 px-1.5 py-0.5">Configurações → Google → Reconectar Google Drive</span>.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm font-bold">{error}</p>
                  )}
                </div>
              );
            })()
          )}
          {!loading && !error && items.length === 0 && (
            <p className="py-10 text-center text-sm font-bold text-slate-400">Pasta vazia.</p>
          )}
          {!loading && !error && (
            <div className="space-y-5">
              {folders.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">Pastas</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {folders.map((folder) => (
                      <button key={folder.id} type="button" onClick={() => openFolder(folder)}
                        className="flex items-center gap-2 rounded-2xl border border-slate-200 p-3 text-left transition hover:border-yellow-300 hover:bg-yellow-50">
                        <Folder size={22} className="shrink-0 text-yellow-500" />
                        <span className="min-w-0 truncate text-sm font-bold">{folder.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {files.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">Arquivos</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {files.map((file) => (
                      <button key={file.id} type="button" onClick={() => selectFile(file)}
                        className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 text-left transition hover:border-blue-400 hover:shadow-md">
                        <div className="aspect-video w-full overflow-hidden bg-slate-50">
                          {file.thumbnailLink ? (
                            <DriveThumb
                              fileId={file.id}
                              alt={file.name}
                              className="h-full w-full object-cover"
                              fallback={
                                <div className="flex h-full items-center justify-center">
                                  {driveItemIcon(file)}
                                </div>
                              }
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              {driveItemIcon(file)}
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="line-clamp-2 text-xs font-bold leading-snug">{file.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {others.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">Outros arquivos</p>
                  <div className="space-y-1">
                    {others.map((file) => (
                      <div key={file.id} className="flex items-center gap-2 rounded-2xl border border-slate-100 px-3 py-2 text-sm text-slate-400">
                        {driveItemIcon(file)}
                        <span className="truncate text-xs font-bold">{file.name}</span>
                        <span className="ml-auto text-xs">não suportado</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-3">
          <p className="text-xs font-bold text-slate-400">
            {currentFolder.name} · {folders.length} pasta{folders.length !== 1 ? "s" : ""}, {files.length} arquivo{files.length !== 1 ? "s" : ""}
          </p>
        </div>
    </CenteredModal>
  );
}

type AllVideosSort = "views" | "recent" | "oldest" | "engagement" | "leads" | "az";

function AllVideosModal({ metrics, channelLabel, channelById, onClose, onPick }: {
  metrics: PostMetric[];
  channelLabel: string;
  channelById: Map<string, Channel>;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<AllVideosSort>("views");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? metrics.filter((m) => m.postTitle.toLowerCase().includes(q)) : metrics;
  }, [metrics, search]);

  const sorted = useMemo(() => {
    const arr = searched.slice();
    if (sortBy === "views") return arr.sort((a, b) => b.reach - a.reach);
    if (sortBy === "recent") return arr.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    if (sortBy === "oldest") return arr.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    if (sortBy === "engagement") return arr.sort((a, b) => metricEngagement(b) - metricEngagement(a));
    if (sortBy === "leads") return arr.sort((a, b) => b.leads - a.leads);
    return arr.sort((a, b) => a.postTitle.localeCompare(b.postTitle, "pt-BR"));
  }, [searched, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = useMemo(() => sorted.slice(start, start + PAGE_SIZE), [sorted, start]);

  useEffect(() => { setPage(1); }, [search, sortBy]);

  function pageWindow(): (number | "…")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const set = new Set<number>([1, totalPages, safePage, safePage - 1, safePage + 1]);
    const sortedNums = Array.from(set).filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
    const out: (number | "…")[] = [];
    sortedNums.forEach((n, i) => {
      if (i > 0 && n - sortedNums[i - 1] > 1) out.push("…");
      out.push(n);
    });
    return out;
  }

  return (
    <CenteredModal close={onClose} zClass="z-[120]" variant="fullscreen-ish" className="bg-slate-950/75" panelClassName="flex h-[88vh] flex-col overflow-hidden rounded-[28px] border-0 p-0">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="font-black">Todos os vídeos · {channelLabel}</h2>
            <p className="text-xs font-bold text-slate-500">{sorted.length} registro{sorted.length === 1 ? "" : "s"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl bg-slate-100 p-2 hover:bg-slate-200"><X size={18} /></button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-6 py-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título…"
            lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences"
            className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as AllVideosSort)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="views">Mais visualizados</option>
            <option value="recent">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
            <option value="engagement">Mais engajamento</option>
            <option value="leads">Mais leads</option>
            <option value="az">A–Z</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {pageItems.length === 0 ? (
            <p className="py-10 text-center text-sm font-bold text-slate-400">Nenhum vídeo encontrado.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {pageItems.map((metric) => {
                const thumb = thumbnailFor(metric);
                return (
                  <button key={metric.id} onClick={() => onPick(metric.id)} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left transition hover:border-blue-200 hover:bg-slate-50">
                    <MetricThumbnail src={thumb} className="h-14 w-24 shrink-0 rounded-lg object-cover" fallbackClassName="h-14 w-24 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="line-clamp-1 font-black">{metric.postTitle}</p>
                        {metric.privacyStatus === "private" && (
                          <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700">🔒 Privado</span>
                        )}
                        {metric.privacyStatus === "unlisted" && (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">🔗 Não listado</span>
                        )}
                        {(metric.privacyStatus === "public" || metric.privacyStatus == null) && metric.externalId?.startsWith("yt:") && (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">🌐 Público</span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-500">
                        {metric.date ? new Date(`${metric.date}T12:00:00`).toLocaleDateString("pt-BR") : "Sem data"}
                        {metric.channelId && ` · ${channelById.get(metric.channelId)?.name ?? metric.channelId}`}
                      </p>
                      <p className="mt-0.5 text-xs font-bold text-slate-700">
                        {formatNumber(metric.reach)} views · {formatNumber(metric.likes)} curtidas · {formatNumber(metric.comments)} coment.
                      </p>
                      {(metric.watchTimeMinutes != null || metric.averageViewPercentage != null || metric.impressions != null) && (
                        <p className="mt-0.5 text-xs font-bold text-blue-700">
                          {metric.watchTimeMinutes != null && `${formatNumber(Math.round(metric.watchTimeMinutes))} min assistidos`}
                          {metric.averageViewPercentage != null && ` · ${formatPercent(metric.averageViewPercentage)} retenção`}
                          {metric.impressions != null && ` · ${formatNumber(metric.impressions)} impressões`}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-6 py-3">
          <p className="text-xs font-bold text-slate-500">
            {sorted.length === 0 ? "0 resultados" : `Mostrando ${start + 1}–${Math.min(start + PAGE_SIZE, sorted.length)} de ${sorted.length}`}
          </p>
          <div className="flex items-center gap-1">
            <button type="button" disabled={safePage === 1} onClick={() => setPage(1)} className="rounded-xl bg-slate-100 px-2 py-1 text-xs font-black text-slate-700 disabled:opacity-40">«</button>
            <button type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)} className="rounded-xl bg-slate-100 px-2 py-1 text-xs font-black text-slate-700 disabled:opacity-40">‹</button>
            {pageWindow().map((p, i) =>
              p === "…" ? (
                <span key={`gap-${i}`} className="px-1 text-xs font-bold text-slate-400">…</span>
              ) : (
                <button key={p} type="button" onClick={() => setPage(p)} className={`min-w-[2rem] rounded-xl px-2 py-1 text-xs font-black ${p === safePage ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{p}</button>
              )
            )}
            <button type="button" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)} className="rounded-xl bg-slate-100 px-2 py-1 text-xs font-black text-slate-700 disabled:opacity-40">›</button>
            <button type="button" disabled={safePage === totalPages} onClick={() => setPage(totalPages)} className="rounded-xl bg-slate-100 px-2 py-1 text-xs font-black text-slate-700 disabled:opacity-40">»</button>
          </div>
        </div>
    </CenteredModal>
  );
}

function YouTubeImportModal({ metrics, setMetrics, posts, channels, productLines, funnelStages, onClose, reloadData }: {
  metrics: PostMetric[];
  setMetrics: Dispatch<SetStateAction<PostMetric[]>>;
  posts: EditorialPost[];
  channels: Channel[];
  productLines: ProductLine[];
  funnelStages: FunnelStage[];
  onClose: () => void;
  reloadData?: () => Promise<void>;
}) {
  const [phase, setPhase] = useState<"auth" | "fetching" | "importing" | "done" | "error">("auth");
  const [progress, setProgress] = useState<YouTubeImportProgress | null>(null);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({ created: 0, updated: 0 });
  const ran = useRef(false);

  async function run() {
    setError("");
    setPhase("auth");
    try {
      setPhase("fetching");
      const videos = await listMyYouTubeChannelVideos(setProgress);
      setPhase("importing");

      const youtubeChannelId =
        channels.find((c) => c.id === "youtube")?.id ??
        channels.find((c) => c.name.toLowerCase().includes("youtube"))?.id ??
        "youtube";
      const defaultLineId = productLines[0]?.id ?? "";
      const defaultFunnelId = funnelStages[0]?.id ?? "";

      const byExt = new Map(
        metrics.filter((m) => m.externalId).map((m) => [m.externalId!, m] as const)
      );
      // Métricas manuais (sem externalId) vinculadas a posts pelo publishedVideoId
      const byPostId = new Map(
        metrics
          .filter((m) => !m.externalId && m.postId)
          .map((m) => [m.postId!, m] as const)
      );

      let created = 0;
      let updated = 0;
      // Deduplica vídeos por videoId — a API do YouTube pode retornar duplicatas
      const uniqueVideos = Array.from(new Map(videos.map((v) => [v.videoId, v])).values());

      const importedRows: PostMetric[] = uniqueVideos.map((v) => {
        const externalId = `yt:${v.videoId}`;
        const linkedPost = posts.find((p) => p.publishedVideoId === v.videoId);
        const existing = byExt.get(externalId) ?? (linkedPost ? byPostId.get(linkedPost.id) : undefined);
        if (existing) updated += 1;
        else created += 1;
        return {
          // Campos manuais: preserva os existentes, usa padrão só se for novo
          id:            existing?.id            ?? crypto.randomUUID(),
          campaignId:    existing?.campaignId    ?? "",
          productLineId: existing?.productLineId ?? defaultLineId,
          vehicleTypeId: existing?.vehicleTypeId ?? "",
          contentTypeId: existing?.contentTypeId ?? "",
          funnelStageId: existing?.funnelStageId ?? defaultFunnelId,
          shares:        existing?.shares        ?? 0,
          clicks:        existing?.clicks        ?? 0,
          leads:         existing?.leads         ?? 0,
          notes:         existing?.notes         ?? "",
          learning:      existing?.learning      ?? "",
          // Campos do YouTube: sempre atualiza com dados frescos
          externalId,
          videoType: v.isShort ? "short" as const : "video" as const,
          privacyStatus: v.privacyStatus,
          postId:    linkedPost?.id,
          postTitle: v.title,
          channelId: youtubeChannelId,
          date:      v.publishedAt,
          reach:     v.viewCount,
          likes:     v.likeCount,
          comments:  v.commentCount,
          watchTimeMinutes: v.watchTimeMinutes,
          averageViewDurationSeconds: v.averageViewDurationSeconds,
          averageViewPercentage: v.averageViewPercentage,
          subscribersGained: v.subscribersGained,
          subscribersLost: v.subscribersLost,
          impressions: v.impressions,
          impressionClickThroughRate: v.impressionClickThroughRate,
        };
      });

      // Coleta snapshots dos vídeos existentes cujos valores mudaram (guarda os valores ANTIGOS)
      const snapshots: PostMetricSnapshot[] = uniqueVideos
        .map((v) => {
          const externalId = `yt:${v.videoId}`;
          const linkedPost = posts.find((p) => p.publishedVideoId === v.videoId);
          const existing = byExt.get(externalId) ?? (linkedPost ? byPostId.get(linkedPost.id) : undefined);
          if (!existing) return null;
          // Só salva snapshot se algo mudou
          if (
            existing.reach === v.viewCount &&
            existing.likes === v.likeCount &&
            existing.comments === v.commentCount
          ) return null;
          return {
            id: crypto.randomUUID(),
            metricId: existing.id,
            capturedAt: new Date().toISOString(),
            reach: existing.reach,
            likes: existing.likes,
            comments: existing.comments,
            shares: existing.shares,
            clicks: existing.clicks,
            leads: existing.leads,
          } satisfies PostMetricSnapshot;
        })
        .filter((s): s is PostMetricSnapshot => s !== null);

      if (snapshots.length && supabase) {
        await saveMetricSnapshots(supabase, snapshots);
      }

      if (supabase) {
        await replaceMetrics(supabase, importedRows, metrics);
      }
      void reloadData?.();
      setSummary({ created, updated });
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido ao importar.");
      setPhase("error");
    }
  }

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    run();
  }, []);

  const progressLabel = (() => {
    if (phase === "auth") return "Aguardando autorização do Google…";
    if (phase === "fetching") {
      if (!progress) return "Conectando ao YouTube…";
      if (progress.phase === "fetching-channel") return "Buscando informações do canal…";
      if (progress.phase === "listing") return `Listando vídeos (${progress.collected} encontrados)…`;
      if (progress.phase === "stats") return `Buscando estatísticas (${progress.done}/${progress.total})…`;
    }
    if (phase === "importing") return "Salvando no banco de dados…";
    if (phase === "done") return `${summary.created} novos · ${summary.updated} atualizados`;
    if (phase === "error") return "Erro";
    return "";
  })();

  return (
    <CenteredModal close={onClose} closeOnOverlay={phase !== "fetching" && phase !== "importing"} zClass="z-[120]" variant="compact" className="bg-slate-950/75" panelClassName="rounded-[28px] border-0">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Youtube size={22} className="text-red-600" />
            <h2 className="font-black">Importar do YouTube</h2>
          </div>
          {(phase === "done" || phase === "error") && (
            <button type="button" onClick={onClose} className="rounded-2xl bg-slate-100 p-2 hover:bg-slate-200">
              <X size={18} />
            </button>
          )}
        </div>

        {phase !== "done" && phase !== "error" && (
          <div className="space-y-3">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full animate-pulse rounded-full bg-red-500" style={{ width: "100%" }} />
            </div>
            <p className="text-sm font-bold text-slate-600">{progressLabel}</p>
          </div>
        )}

        {phase === "done" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-green-50 p-4">
              <p className="text-sm font-black text-green-800">Importação concluída!</p>
              <p className="mt-1 text-sm font-bold text-green-700">{summary.created} vídeos novos · {summary.updated} atualizados</p>
            </div>
            <button type="button" onClick={onClose} className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800">
              Fechar
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-rose-50 p-4">
              <p className="text-sm font-black text-rose-800">Não foi possível importar</p>
              <p className="mt-1 text-sm font-bold text-rose-700">{error}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { ran.current = false; run(); ran.current = true; }} className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800">
                Tentar novamente
              </button>
              <button type="button" onClick={onClose} className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-200">
                Fechar
              </button>
            </div>
          </div>
        )}
    </CenteredModal>
  );
}

function TikTokImportModal({ metrics, setMetrics, channels, onClose, reloadData }: {
  metrics: PostMetric[];
  setMetrics: Dispatch<SetStateAction<PostMetric[]>>;
  channels: Channel[];
  onClose: () => void;
  reloadData?: () => Promise<void>;
}) {
  const [phase, setPhase] = useState<"idle" | "fetching" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({
    created: 0,
    updated: 0,
    videos: 0,
    totalFetched: 0,
    pagesFetched: 0,
    profileVideoCount: 0,
    hasMore: false,
    stoppedByLimit: false
  });
  const [status, setStatus] = useState<TikTokConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setStatusLoading(true);
    getTikTokStatus()
      .then((nextStatus) => {
        if (!cancelled) setStatus(nextStatus);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao consultar conexao TikTok.");
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function videoDate(createTime: number) {
    if (!createTime) return todayIso();
    return new Date(createTime * 1000).toISOString().slice(0, 10);
  }

  async function run() {
    setError("");
    try {
      setPhase("fetching");
      const { profile, videos, importSummary } = await listTikTokVideos();
      setPhase("saving");

      const tiktokChannelId =
        channels.find((channel) => channel.id === "tiktok")?.id ??
        channels.find((channel) => channel.name.toLowerCase().includes("tiktok"))?.id ??
        "tiktok";
      const byExt = new Map(metrics.filter((metric) => metric.externalId).map((metric) => [metric.externalId!, metric] as const));

      let created = 0;
      let updated = 0;
      const importedRows: PostMetric[] = videos.map((video) => {
        const externalId = `tiktok:${video.id}`;
        const existing = byExt.get(externalId);
        if (existing) updated += 1;
        else created += 1;
        return {
          id: existing?.id ?? crypto.randomUUID(),
          externalId,
          postId: existing?.postId,
          postTitle: video.title || video.description || "Video TikTok",
          channelId: tiktokChannelId,
          campaignId: existing?.campaignId ?? "",
          productLineId: existing?.productLineId ?? "",
          vehicleTypeId: existing?.vehicleTypeId ?? "",
          contentTypeId: existing?.contentTypeId ?? "",
          funnelStageId: existing?.funnelStageId ?? "",
          date: videoDate(video.createTime),
          reach: video.viewCount,
          likes: video.likeCount,
          comments: video.commentCount,
          shares: video.shareCount,
          clicks: existing?.clicks ?? 0,
          leads: existing?.leads ?? 0,
          notes: existing?.notes ?? "Importado do TikTok Sandbox.",
          learning: existing?.learning ?? "",
          videoType: "video",
          privacyStatus: "public",
          watchTimeMinutes: existing?.watchTimeMinutes,
          averageViewDurationSeconds: existing?.averageViewDurationSeconds,
          averageViewPercentage: existing?.averageViewPercentage,
          subscribersGained: existing?.subscribersGained,
          subscribersLost: existing?.subscribersLost,
          impressions: existing?.impressions,
          impressionClickThroughRate: existing?.impressionClickThroughRate,
          thumbnailUrl: video.coverImageUrl || existing?.thumbnailUrl,
          sourceUrl: video.shareUrl || existing?.sourceUrl,
          embedUrl: video.embedLink || existing?.embedUrl
        };
      });

      const previousRows = importedRows
        .map((row) => metrics.find((metric) => metric.id === row.id))
        .filter((row): row is PostMetric => Boolean(row));
      if (supabase && importedRows.length) {
        await replaceMetrics(supabase, importedRows, previousRows);
      }
      setMetrics((current) => {
        const byId = new Map(current.map((metric) => [metric.id, metric] as const));
        importedRows.forEach((metric) => byId.set(metric.id, metric));
        return Array.from(byId.values());
      });
      void reloadData?.();
      setSummary({
        created,
        updated,
        videos: videos.length,
        totalFetched: importSummary?.totalFetched ?? videos.length,
        pagesFetched: importSummary?.pagesFetched ?? 0,
        profileVideoCount: profile.videoCount,
        hasMore: Boolean(importSummary?.hasMore),
        stoppedByLimit: Boolean(importSummary?.stoppedByLimit)
      });
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido ao importar TikTok.");
      setPhase("error");
    }
  }

  return (
    <CenteredModal close={onClose} closeOnOverlay={phase !== "fetching" && phase !== "saving"} zClass="z-[120]" variant="compact" className="bg-slate-950/75" panelClassName="rounded-[28px] border-0">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play size={22} className="text-slate-950" />
            <h2 className="font-black">Trazer dados do TikTok</h2>
          </div>
          {(phase === "idle" || phase === "done" || phase === "error") && (
            <button type="button" onClick={onClose} className="rounded-2xl bg-slate-100 p-2 hover:bg-slate-200">
              <X size={18} />
            </button>
          )}
        </div>

        {phase === "idle" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-800">Importação Sandbox</p>
              <p className="mt-1 text-sm font-bold text-slate-500">
                O sistema vai buscar perfil, estatísticas básicas e vídeos públicos da conta conectada no TikTok Sandbox.
              </p>
              <div className="mt-3 rounded-2xl border border-slate-100 bg-white px-3 py-2">
                <p className="text-xs font-black uppercase text-slate-400">Conexão</p>
                <p className={`mt-1 text-sm font-black ${status?.connected ? "text-emerald-700" : "text-slate-500"}`}>
                  {statusLoading
                    ? "Verificando conexão..."
                    : status?.connected
                      ? `Conectado como ${status.displayName || status.openId || "conta TikTok"}`
                      : "TikTok Sandbox não conectado"}
                </p>
              </div>
              {error && <p className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{error}</p>}
            </div>
            <button type="button" disabled={statusLoading || !status?.connected} onClick={run} className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400">
              {status?.connected ? "Importar dados do TikTok" : "Conecte o TikTok em Conta e Permissões"}
            </button>
          </div>
        )}

        {(phase === "fetching" || phase === "saving") && (
          <div className="space-y-3">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full animate-pulse rounded-full bg-slate-950" style={{ width: "100%" }} />
            </div>
            <p className="text-sm font-bold text-slate-600">
              {phase === "fetching" ? "Buscando dados no TikTok Sandbox..." : "Salvando métricas no sistema..."}
            </p>
          </div>
        )}

        {phase === "done" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-green-50 p-4">
              <p className="text-sm font-black text-green-800">Importação concluída!</p>
              <p className="mt-1 text-sm font-bold text-green-700">
                {summary.videos} vídeos encontrados · {summary.created} novos · {summary.updated} atualizados
              </p>
              <p className="mt-1 text-xs font-bold text-green-700/80">
                {summary.pagesFetched ? `${summary.pagesFetched} página${summary.pagesFetched === 1 ? "" : "s"} buscada${summary.pagesFetched === 1 ? "" : "s"}` : "Busca concluída"}
                {summary.profileVideoCount ? ` · Perfil informa ${formatNumber(summary.profileVideoCount)} vídeos` : ""}
              </p>
              {summary.stoppedByLimit && (
                <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                  A API ainda indicou mais vídeos após o limite de segurança. Reexecute a importação ou aumente o limite técnico se isso continuar acontecendo.
                </p>
              )}
            </div>
            <button type="button" onClick={onClose} className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800">
              Fechar
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-rose-50 p-4">
              <p className="text-sm font-black text-rose-800">Não foi possível importar</p>
              <p className="mt-1 text-sm font-bold text-rose-700">{error}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={run} className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800">
                Tentar novamente
              </button>
              <button type="button" onClick={onClose} className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-200">
                Fechar
              </button>
            </div>
          </div>
        )}
    </CenteredModal>
  );
}

function YouTubeSearchModal({ onSelect, onClose }: { onSelect: (video: YouTubeVideo) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const videos = await searchYouTube(query.trim());
      setResults(videos);
      if (!videos.length) setError("Nenhum vídeo encontrado. Tente outra busca.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar vídeos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CenteredModal close={onClose} zClass="z-[120]" className="bg-slate-950/75" panelClassName="border-0">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Youtube size={20} className="text-red-600" />
            <h2 className="font-black">Buscar no YouTube</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl bg-slate-100 p-2 hover:bg-slate-200"><X size={18} /></button>
        </div>
        <form onSubmit={search} className="mb-4 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar vídeos no YouTube..."
            autoFocus
            lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences"
            className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-2 outline-none focus:border-red-400"
          />
          <button disabled={loading || !query.trim()} className="rounded-2xl bg-red-600 px-4 font-black text-white disabled:bg-slate-200 disabled:text-slate-400">
            {loading ? "..." : "Buscar"}
          </button>
        </form>
        {error && <p className="mb-3 rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
        {!results.length && !loading && !error && (
          <p className="py-6 text-center text-sm font-bold text-slate-400">Digite uma busca para encontrar vídeos.</p>
        )}
        <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto">
          {results.map((video) => (
            <button
              key={video.videoId}
              type="button"
              onClick={() => { onSelect(video); onClose(); }}
              className="rounded-2xl border border-slate-200 p-3 text-left transition hover:border-red-300 hover:bg-red-50"
            >
              <img src={video.thumbnail} alt={video.title} className="mb-2 w-full rounded-xl object-cover aspect-video" />
              <p className="line-clamp-2 text-sm font-black leading-snug">{video.title}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">{video.channelTitle}</p>
            </button>
          ))}
        </div>
    </CenteredModal>
  );
}

function TaskModal({ task, profiles, profileById, funnelStages, taskColumns, taskBoards, tasks, currentUser, updateTask, addTaskAttachment, deleteTaskAttachment, addTaskExternalLink, addSubtask, setModal, setTasks, openMediaPreview, createNotifications, close }: Parameters<typeof EntityModal>[0] & { task: Task; close: () => void }) {
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const subtasks = tasks.filter((item) => item.parentTaskId === task.id);
  const parentTask = task.parentTaskId ? tasks.find((item) => item.id === task.parentTaskId) : undefined;
  const isGoalTask = isGoalColumn(task.columnId);
  const columnBoardId = taskColumns.find((column) => column.id === task.columnId)?.boardId;
  const taskBoardId = isGoalTask ? findMetasBoardId(taskBoards) : columnBoardId;
  const showResetSchedule = isMetasBoardId(taskBoardId, taskBoards);
  const availableColumns = taskBoardId ? taskColumns.filter((column) => column.boardId === taskBoardId) : taskColumns;
  const isTaskCompleted = isCompletedTask(task);
  const doneSubtasks = subtasks.filter(isCompletedTask).length;

  function columnsForTask(item: Task) {
    const boardId = taskColumns.find((column) => column.id === item.columnId)?.boardId;
    return boardId ? taskColumns.filter((column) => column.boardId === boardId) : taskColumns;
  }

  function completedColumnFor(item: Task) {
    return columnsForTask(item).find((column) => normalizeText(column.name).includes("concluido"));
  }

  function isCompletedTask(item: Task) {
    const doneColumn = completedColumnFor(item);
    return Boolean(doneColumn && item.columnId === doneColumn.id);
  }

  function toggleTaskCompletedById(taskId: string) {
    updateTask(taskId, (current) => {
      const columns = columnsForTask(current);
      const doneColumn = columns.find((column) => normalizeText(column.name).includes("concluido"));
      if (isCompletedTask(current)) {
        return {
          ...current,
          columnId: current.previousColumnId || columns.find((column) => column.id !== doneColumn?.id)?.id || current.columnId,
          previousColumnId: undefined,
          progress: "No prazo"
        };
      }
      return { ...current, previousColumnId: current.columnId, columnId: doneColumn?.id ?? current.columnId, progress: "Finalizando" };
    });
  }

  function toggleTaskCompleted() {
    toggleTaskCompletedById(task.id);
  }

  function addChecklist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    updateTask(task.id, (current) => ({ ...current, checklist: [...current.checklist, { id: crypto.randomUUID(), label: String(form.get("label")), done: false }] }));
    event.currentTarget.reset();
  }

  function addNamedSubtask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = subtaskTitle.trim();
    if (!title) return;
    addSubtask(task, title);
    setSubtaskTitle("");
  }

  function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    updateTask(task.id, (current) => ({ ...current, comments: [{ id: crypto.randomUUID(), authorId: currentUser.id, message: String(form.get("message")), createdAt: new Date().toISOString() }, ...current.comments] }));
    event.currentTarget.reset();
  }

  function addExternalAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    addTaskExternalLink(task.id, String(form.get("externalUrl")));
    event.currentTarget.reset();
  }

  const [ytOpen, setYtOpen] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);

  function addDriveFileToTask(file: DriveFile) {
    const attachment: TaskAttachment = { id: crypto.randomUUID(), name: file.name, type: file.mimeType.startsWith("image/") ? "foto" : file.mimeType.startsWith("video/") ? "video" : "arquivo", source: "external", url: file.url, previewUrl: file.previewUrl, originalSize: 0, compressedSize: 0, mimeType: file.mimeType };
    updateTask(task.id, (current) => ({ ...current, attachments: [attachment, ...current.attachments] }));
  }

  function addYouTubeToTask(video: YouTubeVideo) {
    const attachment: TaskAttachment = { id: crypto.randomUUID(), name: video.title, type: "video", source: "external", url: video.url, previewUrl: video.previewUrl, originalSize: 0, compressedSize: 0, mimeType: "text/html" };
    updateTask(task.id, (current) => ({ ...current, attachments: [attachment, ...current.attachments] }));
  }

  function updateResetSchedule(patch: Partial<Task>) {
    updateTask(task.id, (current) => {
      const next = { ...current, ...patch };
      const updated: Task = { ...next, nextResetAt: calculateNextResetAt(next) };
      if (isGoalColumn(current.columnId) && patch.resetFrequency !== undefined) {
        const targetCol = goalsColumnByFrequency.get(patch.resetFrequency);
        if (targetCol) updated.columnId = targetCol.id;
      }
      return updated;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleTaskCompleted}
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-black transition ${isTaskCompleted ? "border-emerald-200 bg-emerald-100 text-emerald-800" : "border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50"}`}
          >
            <CheckCircle2 size={17} /> {isTaskCompleted ? "Concluída" : "Marcar como concluída"}
          </button>
          <InlineTagSelect
            label="Prioridade"
            value={task.priority}
            options={priorities}
            tone={priorityToneMap[task.priority] ?? "slate"}
            toneForOption={(value) => priorityToneMap[value] ?? "slate"}
            onChange={(value) => updateTask(task.id, (current) => ({ ...current, priority: value as TaskPriority }))}
          />
          <InlineTagSelect
            label="Andamento"
            value={task.progress}
            options={progresses}
            tone={progressToneMap[task.progress] ?? "slate"}
            toneForOption={(value) => progressToneMap[value] ?? "slate"}
            onChange={(value) => updateTask(task.id, (current) => ({ ...current, progress: value as TaskProgress }))}
          />
          {parentTask && (
            <button type="button" onClick={() => setModal({ kind: "task", id: parentTask.id })} className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 transition hover:border-blue-300 hover:bg-blue-100">
              Voltar para tarefa anterior
            </button>
          )}
        </div>
        {!task.fixedGoalKey && (
          <DeleteButton
            label="Excluir tarefa"
            onDelete={() => {
              setTasks((current) => current.filter((item) => item.id !== task.id && item.parentTaskId !== task.id));
              close();
            }}
          />
        )}
      </div>

      <input value={task.title} onChange={(event) => updateTask(task.id, (current) => ({ ...current, title: event.target.value }))} lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences" className="w-full rounded-2xl border-0 bg-transparent px-0 py-1 text-3xl font-black outline-none focus:ring-0" />
      {task.fixedGoalKey && <Badge tone="purple">Card fixo de metas</Badge>}

      <div className="grid gap-3 lg:grid-cols-2">
        <DetailRow label="Criado por"><span className="font-bold text-slate-600">{profileById.get(task.createdBy)?.name}</span></DetailRow>
        <DetailRow label="Responsáveis"><MultiSelect label="" values={task.assignedTo} profiles={profiles} onChange={(values) => {
          const added = values.filter((id) => !task.assignedTo.includes(id) && id !== currentUser.id);
          if (added.length) createNotifications(added, "Tarefa atribuída", task.title, "task", task.id);
          updateTask(task.id, (current) => ({ ...current, assignedTo: values }));
        }} /></DetailRow>
        <DetailRow label="Data de conclusão"><input value={task.dueDate} type="date" onChange={(event) => updateTask(task.id, (current) => ({ ...current, dueDate: event.target.value }))} className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500" /></DetailRow>
        <DetailRow label="Funil"><SelectControlled label="" value={task.funnelStageId} options={[["", "Sem funil"], ...funnelStages.map((stage) => [stage.id, stage.name])]} onChange={(value) => updateTask(task.id, (current) => ({ ...current, funnelStageId: value }))} /></DetailRow>
        {task.columnId.startsWith("vendas-atividades") && (
          <DetailRow label="Visibilidade">
            <div className="flex rounded-2xl bg-slate-100 p-1 gap-1">
              {([false, true] as const).map((priv) => (
                <button key={String(priv)} type="button"
                  onClick={() => updateTask(task.id, (current) => ({ ...current, isPrivate: priv }))}
                  className={`flex-1 rounded-xl py-1.5 text-sm font-black transition ${(task.isPrivate ?? false) === priv ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  {priv ? "🔒 Só eu" : "👁 Todos"}
                </button>
              ))}
            </div>
          </DetailRow>
        )}
      </div>

      <section className="space-y-2">
        <h3 className="font-black">Descrição</h3>
        <textarea value={task.description} rows={7} placeholder="Do que se trata esta tarefa?" onChange={(event) => updateTask(task.id, (current) => ({ ...current, description: event.target.value }))} lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences" className="w-full resize-none rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-500" />
      </section>

      {isGoalTask && (
        <section className="space-y-3 border-t border-slate-200 pt-4">
          <h3 className="font-black">Valor da meta</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block text-sm font-bold text-slate-600">Alvo
              <input
                type="number"
                min={0}
                value={task.targetValue ?? ""}
                onChange={(event) => updateTask(task.id, (current) => ({ ...current, targetValue: event.target.value === "" ? undefined : Number(event.target.value) }))}
                placeholder="Ex: 30"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-blue-500"
              />
            </label>
            <label className="block text-sm font-bold text-slate-600">Atual
              <input
                type="number"
                min={0}
                value={task.currentValue ?? 0}
                onChange={(event) => updateTask(task.id, (current) => ({ ...current, currentValue: Math.max(0, Number(event.target.value) || 0) }))}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-blue-500"
              />
            </label>
            <label className="block text-sm font-bold text-slate-600">Unidade
              <input
                type="text"
                value={task.unit ?? ""}
                onChange={(event) => updateTask(task.id, (current) => ({ ...current, unit: event.target.value }))}
                placeholder="posts, leads, R$..."
                lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-blue-500"
              />
            </label>
          </div>
          {task.targetValue ? (
            (() => {
              const s = computeGoalStatus(task);
              const c = goalStatusColors(s.kind);
              return (
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-black">{(task.currentValue ?? 0).toLocaleString("pt-BR")} / {task.targetValue.toLocaleString("pt-BR")} {task.unit ?? ""}</span>
                    <Badge tone={c.badge}>{c.label}</Badge>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full transition-all" style={{ width: `${s.pct}%`, background: c.bar }} />
                  </div>
                </div>
              );
            })()
          ) : null}
        </section>
      )}

      {showResetSchedule && (
        <section className="space-y-3 border-t border-slate-200 pt-4">
          <div>
            <h3 className="font-black">Reset automático</h3>
            <p className="mt-1 text-sm font-bold text-slate-500">{resetScheduleLabel(task)}</p>
            {task.nextResetAt && <p className="mt-1 text-xs font-black text-blue-700">Próximo reset: {formatDate(task.nextResetAt)}</p>}
            {task.lastResetAt && <p className="mt-1 text-xs font-bold text-slate-400">Último reset: {formatDate(task.lastResetAt)}</p>}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <SelectControlled
              label="Frequência"
              value={task.resetFrequency ?? "none"}
              options={resetFrequencies.map((item) => [item.value, item.label])}
              onChange={(value) => {
                const frequency = value as TaskResetFrequency;
                updateResetSchedule({
                  resetFrequency: frequency,
                  resetTime: task.resetTime || "23:59",
                  resetWeekday: frequency === "weekly" ? task.resetWeekday ?? 0 : task.resetWeekday,
                  resetMonthDay: frequency === "monthly" && !task.resetMonthLastDay ? task.resetMonthDay ?? 1 : task.resetMonthDay,
                  resetMonthLastDay: frequency === "monthly" ? task.resetMonthLastDay ?? false : false,
                  nextResetAt: frequency === "none" ? "" : task.nextResetAt
                });
              }}
            />
            {task.resetFrequency !== "none" && <TextInputControlled label="Horário" type="time" value={task.resetTime || "23:59"} onChange={(value) => updateResetSchedule({ resetTime: value || "23:59" })} />}
            {task.resetFrequency === "weekly" && (
              <SelectControlled label="Dia da semana" value={String(task.resetWeekday ?? 0)} options={weekDays.map((day, index) => [String(index), day])} onChange={(value) => updateResetSchedule({ resetWeekday: Number(value) })} />
            )}
            {task.resetFrequency === "monthly" && (
              <>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">
                  <input type="checkbox" checked={task.resetMonthLastDay} onChange={(event) => updateResetSchedule({ resetMonthLastDay: event.target.checked })} />
                  Último dia do mês
                </label>
                {!task.resetMonthLastDay && (
                  <TextInputControlled label="Dia do mês" type="number" min={1} max={31} value={String(task.resetMonthDay ?? 1)} onChange={(value) => updateResetSchedule({ resetMonthDay: Math.min(31, Math.max(1, Number(value) || 1)) })} />
                )}
              </>
            )}
          </div>
        </section>
      )}

      <section className="space-y-3 border-t border-slate-200 pt-4">
        <div className="flex items-center gap-2">
          <h3 className="font-black">Subtarefas</h3>
          <Badge tone="slate">{doneSubtasks}/{subtasks.length}</Badge>
        </div>
        <form onSubmit={addNamedSubtask} className="flex gap-2">
          <input value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} placeholder="Nova subtarefa" lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences" className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500" />
          <button disabled={!subtaskTitle.trim()} className="rounded-2xl bg-blue-700 px-3 text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"><Plus size={17} /></button>
        </form>
        <div className="divide-y divide-slate-200 rounded-2xl border border-slate-100">
          {subtasks.map((subtask) => {
            const done = isCompletedTask(subtask);
            return (
              <div key={subtask.id} className="flex items-center gap-3 px-3 py-3 hover:bg-blue-50">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleTaskCompletedById(subtask.id);
                  }}
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition ${done ? "border-emerald-200 bg-emerald-100 text-emerald-700" : "border-slate-300 bg-white text-slate-400 hover:border-emerald-300 hover:text-emerald-600"}`}
                  title={done ? "Marcar como pendente" : "Marcar como concluída"}
                >
                  <CheckCircle2 size={17} />
                </button>
                <button type="button" onClick={() => setModal({ kind: "task", id: subtask.id })} className={`min-w-0 flex-1 text-left font-bold ${done ? "text-emerald-800" : "text-slate-950"}`}>
                  {subtask.title}
                </button>
              </div>
            );
          })}
          {!subtasks.length && <p className="px-3 py-3 text-sm font-bold text-slate-400">Nenhuma subtarefa criada.</p>}
        </div>
      </section>

      <section className="space-y-3 border-t border-slate-200 pt-4">
        <div className="flex items-center gap-2">
          <h3 className="font-black">Checklist</h3>
          <Badge tone="slate">{task.checklist.filter((item) => item.done).length}/{task.checklist.length}</Badge>
        </div>
        <div className="space-y-2">
          {task.checklist.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
              <input type="checkbox" checked={item.done} onChange={(event) => updateTask(task.id, (current) => ({ ...current, checklist: current.checklist.map((check) => check.id === item.id ? { ...check, done: event.target.checked } : check) }))} />
              <input value={item.label} onChange={(event) => updateTask(task.id, (current) => ({ ...current, checklist: current.checklist.map((check) => check.id === item.id ? { ...check, label: event.target.value } : check) }))} lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences" className="min-w-0 flex-1 bg-transparent font-bold outline-none" />
              <button type="button" onClick={() => updateTask(task.id, (current) => ({ ...current, checklist: current.checklist.filter((check) => check.id !== item.id) }))} className="rounded-xl bg-rose-100 p-2 text-rose-700" title="Excluir item"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <form onSubmit={addChecklist} className="flex gap-2"><input name="label" required placeholder="Novo item" lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences" className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500" /><button className="rounded-2xl bg-blue-700 px-3 text-white"><Plus size={17} /></button></form>
      </section>

      <section className="space-y-3 border-t border-slate-200 pt-4">
        <h3 className="font-black">Anexos</h3>
        <FileDropZone
          icon="camera"
          title="Adicionar imagem, vídeo ou arquivo"
          hint="Imagens até 2 MB, vídeos até 100 MB"
          onFiles={(files) => files[0] && addTaskAttachment(task.id, files[0])}
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setDriveOpen(true)} className="flex items-center gap-2 rounded-2xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700 hover:bg-blue-100">
            <HardDrive size={15} /> Selecionar do Drive
          </button>
          <button type="button" onClick={() => setYtOpen(true)} className="flex items-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-sm font-black text-red-700 hover:bg-red-100">
            <Youtube size={15} /> Buscar no YouTube
          </button>
        </div>
        <form onSubmit={addExternalAttachment} className="flex gap-2">
          <input name="externalUrl" required placeholder="Ou cole um link do Google Drive / YouTube" className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          <button className="rounded-2xl bg-slate-950 px-4 text-sm font-black text-white">Adicionar</button>
        </form>
        {driveOpen && <DriveExplorerModal onSelect={addDriveFileToTask} onClose={() => setDriveOpen(false)} />}
        {ytOpen && <YouTubeSearchModal onSelect={addYouTubeToTask} onClose={() => setYtOpen(false)} />}
        <div className="space-y-2">{task.attachments.map((attachment) => (
          <div key={attachment.id} className="rounded-2xl bg-slate-50 p-3 text-sm font-black">
            <div className="flex items-start justify-between gap-3">
              <a href={attachment.url} target="_blank" className="text-blue-700">{attachment.type}: {attachment.name}</a>
              <div className="flex items-center gap-1">
                <FileActionButtons item={attachment} onPreview={() => openMediaPreview(attachment)} />
                <button type="button" onClick={() => deleteTaskAttachment(task.id, attachment)} className="rounded-xl bg-rose-100 p-1.5 text-rose-700 transition hover:bg-rose-200" title="Excluir anexo">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs font-bold text-slate-400">{attachment.source === "external" ? externalMediaLabel(attachment) : `${formatBytes(attachment.compressedSize || attachment.originalSize)}${attachment.originalSize && attachment.compressedSize && attachment.originalSize !== attachment.compressedSize ? ` após compressão de ${formatBytes(attachment.originalSize)}` : ""}`}</p>
            <button type="button" onClick={() => openMediaPreview(attachment)} className="mt-3 block w-full overflow-hidden rounded-2xl text-left">
              <MediaPreviewContent item={attachment} />
            </button>
          </div>
        ))}</div>
      </section>

      <section className="sticky bottom-0 -mx-5 border-t border-slate-200 bg-white px-5 py-4">
        <form onSubmit={addComment} className="flex gap-3">
          <Avatar profile={profileById.get(currentUser.id)} size="sm" />
          <input name="message" required placeholder="Adicionar um comentário" lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences" className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" />
          <button className="rounded-2xl bg-blue-700 px-4 text-white"><MessageSquare size={17} /></button>
        </form>
        <div className="mt-3 space-y-2">{task.comments.map((comment) => <div key={comment.id} className="rounded-2xl bg-slate-50 p-3"><p className="font-black">{profileById.get(comment.authorId)?.name}</p><p className="text-sm text-slate-600">{comment.message}</p></div>)}</div>
      </section>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid gap-2 rounded-3xl border border-slate-100 bg-slate-50/70 px-4 py-3 md:grid-cols-[150px_1fr] md:items-center"><p className="text-sm font-black text-slate-600">{label}</p><div className="min-w-0">{children}</div></div>;
}

function InlineTagSelect({ label, value, options, tone, toneForOption, onChange }: { label: string; value: string; options: string[]; tone: BadgeTone; toneForOption?: (value: string) => BadgeTone; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const tones = { blue: "border-blue-200 bg-blue-100 text-blue-700", cyan: "border-cyan-200 bg-cyan-100 text-cyan-700", slate: "border-slate-200 bg-slate-100 text-slate-700", red: "border-rose-200 bg-rose-100 text-rose-700", green: "border-emerald-200 bg-emerald-100 text-emerald-700", amber: "border-amber-200 bg-amber-100 text-amber-700", purple: "border-violet-200 bg-violet-100 text-violet-700" };
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((current) => !current)} className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-black transition hover:shadow-sm ${tones[tone]}`}>
        <span className="text-[11px] uppercase opacity-70">{label}</span>
        {value}
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="absolute left-0 top-12 z-40 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
        {options.map((option) => (
          <button key={option} type="button" onClick={() => { onChange(option); setOpen(false); }} className={`mb-1 block w-full rounded-xl px-3 py-2 text-left text-sm font-black last:mb-0 ${tones[toneForOption?.(option) ?? tone]}`}>
            <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-current" />{option}</span>
          </button>
        ))}
        </div>
      )}
    </div>
  );
}

function normalizeText(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function templateDescription(template: PostTemplate) {
  const structure = template.structureItems?.length ? template.structureItems.map((item, index) => `${index + 1}. ${item}`).join("\n") : template.structure;
  const checklist = template.checklistItems?.length ? template.checklistItems.map((item) => `- ${item.label}`).join("\n") : template.checklist;
  return [
    template.description,
    structure ? `Roteiro/estrutura:\n${structure}` : "",
    checklist ? `Checklist de produção:\n${checklist}` : "",
    template.visualGuidance ? `Orientação para arte/vídeo:\n${template.visualGuidance}` : "",
    template.captionExample ? `Exemplo de legenda/copy:\n${template.captionExample}` : ""
  ].filter(Boolean).join("\n\n");
}

function textLines(value: string) {
  return value.split(/\r?\n/).map((line) => line.replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, "").trim()).filter(Boolean);
}

function externalMediaLabel(item: MediaPreviewItem) {
  if (youtubePreviewUrl(item.url) || item.previewUrl.includes("youtube.com/embed")) return "YouTube";
  if (item.previewUrl.includes("drive.google.com")) return "Google Drive";
  return "Link externo";
}

function setFormValueIfEmpty(form: HTMLFormElement, name: string, value?: string) {
  if (!value) return;
  const field = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  if (field && !field.value) field.value = value;
}

function setFormValue(form: HTMLFormElement, name: string, value?: string) {
  const field = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  if (field) field.value = value ?? "";
}

function cloneChecklist(items?: ChecklistItem[]) {
  return (items ?? []).filter((item) => item.label.trim()).map((item) => ({ id: crypto.randomUUID(), label: item.label, done: false }));
}

function applyTimeToDateTimeLocal(currentValue: string, time: string) {
  if (!time) return currentValue;
  const base = currentValue || toDateTimeLocalValue(new Date());
  const [datePart] = base.split("T");
  return `${datePart}T${time}`;
}

function PostModalV2({ modal, setModal, currentUser, profiles, profileById, channels, productLines, vehicleTypes, contentTypes, funnelStages, campaigns, postTemplates, posts, setPosts, postReviewAssets, addPostReviewAssets, addPostReviewExternalAsset, deletePostReviewAsset, openMediaPreview, setReviewAssetStatus, addReviewComment, createNotifications, ideas, profileAreas, profileModulePermissions, close }: Parameters<typeof EntityModal>[0] & { close: () => void }) {
  const editing = modal?.kind === "post" && modal.id ? posts.find((post) => post.id === modal.id) : undefined;
  const initialIdea = editing?.ideaId ?? (modal?.kind === "post" ? modal.ideaId ?? "" : "");
  const ideaPrefill = ideas.find((idea) => idea.id === initialIdea);
  const initialTemplate = editing?.templateId ?? ideaPrefill?.templateId ?? "";
  const defaultPublishAt = editing?.publishAt ?? (modal?.kind === "post" && modal.date ? toDateTimeLocalValue(modal.date) : "");
  const neutralCampaign = campaigns.find((campaign) => normalizeText(campaign.name) === "campanha neutra");
  const postIdeas = ideas.filter((idea) => idea.type === "Postagem");
  const formRef = useRef<HTMLFormElement | null>(null);
  const [selectedIdeaId, setSelectedIdeaId] = useState(initialIdea);
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplate);
  const [creationMode, setCreationMode] = useState<"zero" | "idea" | "template">(initialIdea ? "idea" : initialTemplate ? "template" : "zero");
  const [channelEntries, setChannelEntries] = useState<PostChannelEntry[]>(() => {
    const mainChannelId = editing?.channelId ?? ideaPrefill?.channelId ?? channels[0]?.id ?? "";
    const mainCh = channels.find((c) => c.id === mainChannelId);
    const mainFormat = editing?.format ?? defaultPostFormatForChannel(mainCh);
    return [{ channelId: mainChannelId, format: mainFormat }, ...(editing?.extraChannels ?? [])];
  });
  const selectedChannelId = channelEntries[0]?.channelId ?? "";
  function setSelectedChannelId(id: string) {
    const ch = channels.find((c) => c.id === id);
    setChannelEntries((prev) => [{ channelId: id, format: defaultPostFormatForChannel(ch) }, ...prev.slice(1)]);
  }
  const [productionChecklist, setProductionChecklist] = useState<ChecklistItem[]>(editing?.productionChecklist ?? []);
  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId);
  const postFormatOptions = postFormatOptionsForChannel(selectedChannel);
  const selectedTemplate = postTemplates.find((template) => template.id === selectedTemplateId);
  const defaultFormat = editing?.format && postFormatOptions.includes(editing.format)
    ? editing.format
    : selectedTemplate?.format && postFormatOptions.includes(selectedTemplate.format)
      ? selectedTemplate.format
      : defaultPostFormatForChannel(selectedChannel);
  const [reviewOpen, setReviewOpen] = useState(false);
  const assets = editing ? postReviewAssets.filter((asset) => asset.postId === editing.id) : [];
  const canReview = hasModulePermission(currentUser, "marketing", "revisoes", "approve", profileAreas, profileModulePermissions);
  const pendingCount = assets.filter((asset) => asset.status === "Aguardando revisão").length;
  const approvedCount = assets.filter((asset) => asset.status === "Aprovado").length;
  const reviewSummary = !assets.length ? "Nenhuma arte enviada" : `${assets.length} arquivo(s) · ${approvedCount} aprovado(s) · ${pendingCount} pendente(s)`;

  function changeCreationMode(mode: "zero" | "idea" | "template") {
    setCreationMode(mode);
    if (mode === "zero") {
      setSelectedIdeaId("");
      setSelectedTemplateId("");
      if (!editing) resetPostDraft();
    }
  }

  function applyIdea(ideaId: string) {
    setSelectedIdeaId(ideaId);
    if (!ideaId) {
      if (!editing) resetPostDraft();
      return;
    }
    const idea = ideas.find((item) => item.id === ideaId);
    if (!idea || !formRef.current) return;
    const form = formRef.current;
    setFormValue(form, "title", idea.title);
    setFormValue(form, "description", idea.description);
    for (const [name, value] of Object.entries({ productLineId: idea.productLineId, vehicleTypeId: idea.vehicleTypeId, contentTypeId: idea.contentTypeId, funnelStageId: idea.funnelStageId, channelId: idea.channelId })) {
      setFormValue(form, name, value);
    }
    if (idea.channelId) {
      const ideaCh = channels.find((c) => c.id === idea.channelId);
      const ideaFmt = idea.format || defaultPostFormatForChannel(ideaCh);
      setChannelEntries((prev) => [{ channelId: idea.channelId, format: ideaFmt }, ...prev.slice(1)]);
    }
    if (idea.templateId) {
      applyTemplate(idea.templateId, { keepTitleAndDescription: true });
    } else {
      setSelectedTemplateId("");
      setProductionChecklist([]);
      setFormValue(form, "templateId", "");
    }
  }

  function applyTemplate(templateId: string, options: { keepTitleAndDescription?: boolean } = {}) {
    setSelectedTemplateId(templateId);
    if (!templateId) {
      if (formRef.current) setFormValue(formRef.current, "templateId", "");
      if (!editing) {
        setProductionChecklist([]);
        if (!selectedIdeaId) resetPostDraft();
      }
      return;
    }
    const template = postTemplates.find((item) => item.id === templateId);
    if (!template || !formRef.current) return;
    const form = formRef.current;
    setFormValue(form, "templateId", templateId);
    setFormValue(form, "contentTypeId", template.contentTypeId);
    setFormValue(form, "funnelStageId", template.funnelStageId);
    if (!options.keepTitleAndDescription) setFormValue(form, "description", templateDescription(template));
    if (template.channelId) {
      const tmplFmt = template.format || defaultPostFormatForChannel(channels.find((c) => c.id === template.channelId));
      setChannelEntries((prev) => [{ channelId: template.channelId, format: tmplFmt }, ...prev.slice(1)]);
    }
    const publishField = form.elements.namedItem("publishAt") as HTMLInputElement | null;
    if (publishField && template.suggestedTime) publishField.value = applyTimeToDateTimeLocal(publishField.value, template.suggestedTime);
    setProductionChecklist(cloneChecklist(template.checklistItems));
  }

  function resetPostDraft() {
    if (!formRef.current) return;
    const form = formRef.current;
    const fallbackChannelId = channels[0]?.id ?? "";
    setSelectedTemplateId("");
    const fallbackCh = channels.find((c) => c.id === fallbackChannelId);
    setChannelEntries([{ channelId: fallbackChannelId, format: defaultPostFormatForChannel(fallbackCh) }]);
    setProductionChecklist([]);
    setFormValue(form, "ideaId", "");
    setFormValue(form, "templateId", "");
    setFormValue(form, "title", "");
    setFormValue(form, "description", "");
    setFormValue(form, "productLineId", "");
    setFormValue(form, "vehicleTypeId", "");
    setFormValue(form, "contentTypeId", "");
    setFormValue(form, "funnelStageId", "");
    setFormValue(form, "campaignId", neutralCampaign?.id ?? campaigns[0]?.id ?? "");
    setFormValue(form, "publishAt", defaultPublishAt);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = editing?.status ?? "Produção";
    const validEntries = channelEntries.filter((e) => e.channelId);
    const [mainEntry, ...extraEntries] = validEntries.length ? validEntries : [{ channelId: "", format: "" }];
    const value: EditorialPost = { id: editing?.id ?? crypto.randomUUID(), ideaId: String(form.get("ideaId") ?? "") || undefined, templateId: String(form.get("templateId") ?? "") || undefined, title: String(form.get("title")), channelId: mainEntry.channelId, campaignId: String(form.get("campaignId")), productLineId: String(form.get("productLineId")), vehicleTypeId: String(form.get("vehicleTypeId")), contentTypeId: String(form.get("contentTypeId")), funnelStageId: String(form.get("funnelStageId")), createdBy: editing?.createdBy ?? currentUser.id, assignedTo: form.getAll("assignedTo").map(String), status, format: mainEntry.format || defaultPostFormatForChannel(selectedChannel), extraChannels: extraEntries, order: editing?.order ?? posts.filter((post) => post.status === status).length + 1, publishAt: String(form.get("publishAt")), description: String(form.get("description")), productionChecklist };
    setPosts((current) => editing ? current.map((post) => post.id === value.id ? value : post) : [value, ...current]);
    const newAssignees = value.assignedTo.filter((id) => id !== currentUser.id && !(editing?.assignedTo ?? []).includes(id));
    if (newAssignees.length) createNotifications(newAssignees, "Post atribuído", value.title, "post", value.id);
    if (editing && editing.status !== value.status) {
      if (value.status === "Revisão") createNotifications(value.assignedTo.filter((id) => id !== currentUser.id), "Post entrou em revisão", value.title, "post", value.id);
      if (value.status === "Aprovado") createNotifications([value.createdBy, ...value.assignedTo].filter((id) => id !== currentUser.id), "Post aprovado", value.title, "post", value.id);
      if (value.status === "Publicado") createNotifications([value.createdBy, ...value.assignedTo].filter((id) => id !== currentUser.id), "Post publicado", value.title, "post", value.id);
    }
    close();
  }

  return (
    <div className={`grid gap-5 ${reviewOpen && editing ? "xl:grid-cols-[minmax(0,1fr)_420px]" : ""}`}>
      <div>
        <EntityForm onSubmit={submit} formRef={formRef}>
          {!editing && (
            <div className="flex gap-2 rounded-2xl bg-slate-100 p-1 md:col-span-2">
              {(["zero", "idea", "template"] as const).map((mode) => (
                <button key={mode} type="button" onClick={() => changeCreationMode(mode)} className={`flex-1 rounded-xl px-3 py-2 text-sm font-black ${creationMode === mode ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"}`}>
                  {mode === "zero" ? "Criar do zero" : mode === "idea" ? "Usar ideia" : "Usar modelo"}
                </button>
              ))}
            </div>
          )}
          {!editing && creationMode === "idea" ? <label className="block text-sm font-bold text-slate-600 md:col-span-2">Ideia de origem<select name="ideaId" value={selectedIdeaId} onChange={(event) => applyIdea(event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-950 outline-none focus:border-blue-500"><option value="">Sem ideia vinculada</option>{postIdeas.map((idea) => <option key={idea.id} value={idea.id}>{idea.title}</option>)}</select></label> : <input type="hidden" name="ideaId" value={selectedIdeaId} />}
          {!editing && creationMode === "template" ? <label className="block text-sm font-bold text-slate-600 md:col-span-2">Usar modelo<select name="templateId" value={selectedTemplateId} onChange={(event) => applyTemplate(event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-950 outline-none focus:border-blue-500"><option value="">Sem modelo</option>{postTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label> : <input type="hidden" name="templateId" value={selectedTemplateId} />}
          {editing?.status && postStatusConfig[editing.status] && (
            <div className="md:col-span-2 -mb-1">
              <Badge tone={postStatusConfig[editing.status].tone}>{postStatusConfig[editing.status].label}</Badge>
            </div>
          )}
          <TextInput name="title" label="Título" required defaultValue={editing?.title ?? ideaPrefill?.title} />
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-bold text-slate-600">Canais</label>
            <div className="space-y-2">
              {channelEntries.map((entry, idx) => {
                const entryChannel = channels.find((c) => c.id === entry.channelId);
                const fmtOpts = postFormatOptionsForChannel(entryChannel);
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={entry.channelId}
                      onChange={(e) => {
                        const newCh = channels.find((c) => c.id === e.target.value);
                        const newFmt = defaultPostFormatForChannel(newCh);
                        if (idx === 0) setSelectedChannelId(e.target.value);
                        setChannelEntries((prev) => prev.map((x, i) => i === idx ? { channelId: e.target.value, format: newFmt } : x));
                      }}
                      className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-500"
                    >
                      {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select
                      value={entry.format}
                      onChange={(e) => setChannelEntries((prev) => prev.map((x, i) => i === idx ? { ...x, format: e.target.value } : x))}
                      className="w-32 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-500"
                    >
                      {fmtOpts.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                    {idx > 0 && (
                      <button type="button" onClick={() => setChannelEntries((prev) => prev.filter((_, i) => i !== idx))}
                        className="rounded-full p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
              <button type="button" onClick={() => {
                const firstUnused = channels.find((c) => !channelEntries.some((e) => e.channelId === c.id));
                const newCh = firstUnused ?? channels[0];
                setChannelEntries((prev) => [...prev, { channelId: newCh?.id ?? "", format: defaultPostFormatForChannel(newCh) }]);
              }} className="flex items-center gap-1.5 text-sm font-black text-blue-600 hover:text-blue-800">
                <Plus size={14} /> Adicionar canal
              </button>
            </div>
          </div>
          <Select name="campaignId" label="Campanha" defaultValue={editing?.campaignId ?? neutralCampaign?.id} options={campaigns.map((item) => [item.id, item.name])} />
          <Select name="productLineId" label="Linha de produto" defaultValue={editing?.productLineId ?? ideaPrefill?.productLineId} options={[["", "Sem linha específica"], ...productLines.map((item) => [item.id, item.name])]} />
          <Select name="vehicleTypeId" label="Tipo de veículo" defaultValue={editing?.vehicleTypeId ?? ideaPrefill?.vehicleTypeId} options={[["", "Sem tipo específico"], ...vehicleTypes.map((item) => [item.id, item.name])]} />
          <Select name="contentTypeId" label="Tipo de conteúdo" defaultValue={editing?.contentTypeId ?? ideaPrefill?.contentTypeId ?? ""} options={[["", "Sem tipo de conteúdo"], ...contentTypes.map((item) => [item.id, item.name])]} />
          <Select name="funnelStageId" label="Funil" defaultValue={editing?.funnelStageId ?? ideaPrefill?.funnelStageId ?? ""} options={[["", "Sem funil"], ...funnelStages.map((item) => [item.id, item.name])]} />
          <MultiSelectField name="assignedTo" label="Responsáveis" profiles={profiles} values={editing?.assignedTo ?? []} />
          <TextInput name="publishAt" label="Data e hora" type="datetime-local" required defaultValue={defaultPublishAt} />
          <TextArea name="description" label="Descrição" defaultValue={editing?.description ?? ideaPrefill?.description} />
          <section className="space-y-3 rounded-3xl border border-slate-100 bg-slate-50 p-4 md:col-span-2">
            <div className="flex items-center gap-2">
              <h3 className="font-black">Checklist de produção</h3>
              <Badge tone="slate">{productionChecklist.filter((item) => item.done).length}/{productionChecklist.length}</Badge>
            </div>
            <div className="space-y-2">
              {productionChecklist.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white p-3">
                  <input type="checkbox" checked={item.done} onChange={(event) => setProductionChecklist((current) => current.map((check) => check.id === item.id ? { ...check, done: event.target.checked } : check))} />
                  <input value={item.label} onChange={(event) => setProductionChecklist((current) => current.map((check) => check.id === item.id ? { ...check, label: event.target.value } : check))} lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences" className="min-w-0 flex-1 bg-transparent font-bold outline-none" />
                  <button type="button" onClick={() => setProductionChecklist((current) => current.filter((check) => check.id !== item.id))} className="rounded-xl bg-rose-100 p-2 text-rose-700" title="Excluir item"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setProductionChecklist((current) => [...current, { id: crypto.randomUUID(), label: "", done: false }])} className="rounded-2xl bg-blue-100 px-3 py-2 text-sm font-black text-blue-700">Adicionar item</button>
          </section>
          {editing && (
            <button type="button" onClick={() => setReviewOpen(true)} className="rounded-3xl border border-blue-100 bg-blue-50 p-4 text-left transition hover:border-blue-300 md:col-span-2">
              <p className="font-black text-blue-900">Artes para revisão</p>
              <p className="mt-1 text-sm font-bold text-blue-600">{reviewSummary}</p>
              <span className="mt-3 inline-flex rounded-2xl bg-blue-700 px-3 py-2 text-sm font-black text-white">{assets.length ? "Abrir revisão" : "Adicionar arte para revisão"}</span>
            </button>
          )}
          {editing && approvedCount > 0 ? (
            <div className="flex gap-3 md:col-span-2">
              <SubmitButton className="flex-1">Salvar</SubmitButton>
              <button
                type="button"
                onClick={() => setModal({ kind: "publish", postId: editing.id })}
                className="flex-1 rounded-3xl bg-blue-700 px-5 py-3 font-black text-white transition hover:bg-blue-800"
              >
                Publicar / Agendar
              </button>
            </div>
          ) : (
            <SubmitButton>{editing ? "Salvar" : "Criar"}</SubmitButton>
          )}
        </EntityForm>
        {editing && <DeleteButton label="Excluir post" onDelete={() => { setPosts((current) => current.filter((post) => post.id !== editing.id)); close(); }} />}
      </div>

      {reviewOpen && editing && (
        <PostReviewPanel
          post={editing}
          assets={assets}
          profileById={profileById}
          canReview={canReview}
          addPostReviewAssets={addPostReviewAssets}
          addPostReviewExternalAsset={addPostReviewExternalAsset}
          deletePostReviewAsset={deletePostReviewAsset}
          openMediaPreview={openMediaPreview}
          setReviewAssetStatus={setReviewAssetStatus}
          addReviewComment={addReviewComment}
          close={() => setReviewOpen(false)}
        />
      )}
    </div>
  );
}

function PostReviewPanel({
  post,
  assets,
  profileById,
  canReview,
  addPostReviewAssets,
  addPostReviewExternalAsset,
  deletePostReviewAsset,
  openMediaPreview,
  setReviewAssetStatus,
  addReviewComment,
  close
}: {
  post: EditorialPost;
  assets: PostReviewAsset[];
  profileById: Map<string, Profile>;
  canReview: boolean;
  addPostReviewAssets: (post: EditorialPost, files: FileList | File[], isCover?: boolean) => void;
  addPostReviewExternalAsset: (post: EditorialPost, url: string, previewUrl?: string, mimeType?: string, isCover?: boolean) => void;
  deletePostReviewAsset: (assetId: string) => void;
  openMediaPreview: (item: MediaPreviewItem) => void;
  setReviewAssetStatus: (assetId: string, status: ReviewAssetStatus, message?: string) => void;
  addReviewComment: (assetId: string, message: string) => void;
  close: () => void;
}) {
  const mainAsset = assets.find((a) => !a.isCover);
  const coverAsset = assets.find((a) => a.isCover);
  const canUploadMain = !mainAsset;
  const canUploadCover = mainAsset?.type === "video" && !coverAsset;

  // Per-asset state maps
  const [adjustmentMessages, setAdjustmentMessages] = useState<Record<string, string>>({});
  const [showAdjustInputs, setShowAdjustInputs] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

  const [externalUrl, setExternalUrl] = useState("");
  const [driveOpen, setDriveOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<PostReviewAsset | null>(null);

  function submitComment(assetId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const msg = comments[assetId] ?? "";
    if (!msg.trim()) return;
    addReviewComment(assetId, msg.trim());
    setComments((prev) => ({ ...prev, [assetId]: "" }));
  }

  function requestAdjustments(assetId: string) {
    const msg = adjustmentMessages[assetId] ?? "";
    if (!msg.trim()) return;
    setReviewAssetStatus(assetId, "Ajustes solicitados", msg.trim());
    setAdjustmentMessages((prev) => ({ ...prev, [assetId]: "" }));
    setShowAdjustInputs((prev) => ({ ...prev, [assetId]: false }));
  }

  function submitExternalAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const addingCover = Boolean(mainAsset) && mainAsset?.type === "video" && !coverAsset;
    addPostReviewExternalAsset(post, externalUrl, undefined, undefined, addingCover);
    setExternalUrl("");
  }

  function driveImagePreview(file: DriveFile): string {
    return file.thumbnailUrl ?? `https://drive.google.com/thumbnail?id=${file.id}&sz=w400`;
  }

  function addDriveFileToReview(file: DriveFile) {
    if (replaceTarget) {
      const isVideo = replaceTarget.type === "video";
      const isCoverReplace = replaceTarget.isCover ?? false;
      const typeOk = isVideo ? file.mimeType.startsWith("video/") : file.mimeType.startsWith("image/");
      if (!typeOk) {
        window.alert(isVideo
          ? "Para trocar um vídeo, selecione outro vídeo do Drive."
          : "Para trocar a capa, selecione uma imagem do Drive.");
        setReplaceTarget(null);
        return;
      }
      deletePostReviewAsset(replaceTarget.id);
      // For covers (images) use thumbnailUrl so preview renders correctly
      const preview = isCoverReplace ? driveImagePreview(file) : file.previewUrl;
      addPostReviewExternalAsset(post, file.url, preview, file.mimeType, isCoverReplace);
      setReplaceTarget(null);
      return;
    }
    const addingCover = Boolean(mainAsset) && mainAsset?.type === "video" && !coverAsset;
    if (addingCover && !file.mimeType.startsWith("image/")) {
      window.alert("Para a capa, envie apenas imagens (JPG, PNG, etc.).");
      return;
    }
    const preview = addingCover ? driveImagePreview(file) : file.previewUrl;
    addPostReviewExternalAsset(post, file.url, preview, file.mimeType, addingCover);
  }

  const driveButtonLabel = canUploadCover ? "Selecionar capa do Drive" : "Selecionar do Drive";

  return (
    <aside className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-blue-700">Revisão de arte</p>
          <h3 className="font-black">{post.title}</h3>
        </div>
        <button type="button" onClick={close} className="rounded-2xl bg-white p-2"><X size={18} /></button>
      </div>

      {canUploadMain && (
        <FileDropZone
          className="mb-4"
          icon="file"
          title="Enviar arte principal"
          hint="Imagens até 2 MB, vídeos até 100 MB"
          onFiles={(files) => addPostReviewAssets(post, files, false)}
        />
      )}
      {canUploadCover && (
        <FileDropZone
          className="mb-4"
          icon="image"
          title="Enviar capa / thumbnail"
          hint="Imagem JPG ou PNG — usada como thumbnail no YouTube"
          accept="image/*"
          onFiles={(files) => addPostReviewAssets(post, files, true)}
        />
      )}

      {(canUploadMain || canUploadCover) && (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setDriveOpen(true)} className="flex items-center gap-2 rounded-2xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700 hover:bg-blue-100">
              <HardDrive size={15} /> {driveButtonLabel}
            </button>
          </div>
          <form onSubmit={submitExternalAsset} className="mb-4 flex gap-2">
            <input value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="Ou cole um link do Google Drive" className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            <button disabled={!externalUrl.trim()} className="rounded-2xl bg-slate-950 px-3 text-sm font-black text-white disabled:bg-slate-200">Adicionar</button>
          </form>
        </>
      )}
      {driveOpen && <DriveExplorerModal onSelect={addDriveFileToReview} onClose={() => { setDriveOpen(false); setReplaceTarget(null); }} />}

      {assets.length > 0 ? (
        <div className="space-y-3">
          {assets.map((asset) => {
            const adjMsg = adjustmentMessages[asset.id] ?? "";
            const showAdj = showAdjustInputs[asset.id] ?? false;
            const commentText = comments[asset.id] ?? "";
            return (
              <div key={asset.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                <button type="button" onClick={() => openMediaPreview(asset)} className="block w-full">
                  <MediaPreviewContent item={asset} />
                </button>
                <div className="space-y-3 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {asset.isCover
                      ? <Badge tone="slate">Capa / Thumbnail</Badge>
                      : <Badge tone={asset.status === "Aprovado" ? "green" : asset.status === "Ajustes solicitados" ? "red" : "blue"}>{asset.status}</Badge>
                    }
                    <Badge tone="slate">{asset.source === "external" ? externalMediaLabel(asset) : formatBytes(asset.compressedSize || asset.originalSize)}</Badge>
                    <span className="text-xs font-bold text-slate-500">Enviado por {profileById.get(asset.uploadedBy)?.name}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <FileActionButtons item={asset} />
                      <button type="button"
                        onClick={() => { setReplaceTarget(asset); setDriveOpen(true); }}
                        className="rounded-2xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-200">
                        Trocar
                      </button>
                      <button type="button"
                        onClick={() => { if (window.confirm("Excluir este arquivo de revisão?")) deletePostReviewAsset(asset.id); }}
                        className="rounded-2xl bg-rose-100 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-200">
                        Excluir
                      </button>
                    </div>
                  </div>

                  {canReview && !asset.isCover && (
                    <div className="rounded-2xl bg-slate-50 p-3">
                      {asset.status === "Aprovado" ? (
                        showAdj ? (
                          <>
                            <textarea value={adjMsg} onChange={(e) => setAdjustmentMessages((prev) => ({ ...prev, [asset.id]: e.target.value }))} placeholder="O que precisa ajustar?" lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences" className="h-24 w-full resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                            <div className="mt-2 flex gap-2">
                              <button type="button" onClick={() => { setShowAdjustInputs((prev) => ({ ...prev, [asset.id]: false })); setAdjustmentMessages((prev) => ({ ...prev, [asset.id]: "" })); }} className="flex-1 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-200">Cancelar</button>
                              <button type="button" onClick={() => requestAdjustments(asset.id)} disabled={!adjMsg.trim()} className="flex-1 rounded-2xl bg-rose-600 px-3 py-2 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-400">Enviar</button>
                            </div>
                          </>
                        ) : (
                          <button type="button" onClick={() => setShowAdjustInputs((prev) => ({ ...prev, [asset.id]: true }))} className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-black text-rose-700 hover:bg-rose-100">Solicitar ajuste</button>
                        )
                      ) : (
                        <div className="space-y-2">
                          <button type="button" onClick={() => setReviewAssetStatus(asset.id, "Aprovado")} className="w-full rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-black text-white">Aprovar arte</button>
                          <textarea value={adjMsg} onChange={(e) => setAdjustmentMessages((prev) => ({ ...prev, [asset.id]: e.target.value }))} placeholder="O que precisa ajustar?" lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences" className="h-24 w-full resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                          <button type="button" onClick={() => requestAdjustments(asset.id)} disabled={!adjMsg.trim()} className="w-full rounded-2xl bg-rose-600 px-3 py-2 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-400">Solicitar ajustes</button>
                        </div>
                      )}
                    </div>
                  )}

                  {!asset.isCover && (
                    <>
                      <form onSubmit={(e) => submitComment(asset.id, e)} className="flex gap-2">
                        <input value={commentText} onChange={(event) => setComments((prev) => ({ ...prev, [asset.id]: event.target.value }))} placeholder="Comentário sobre esta arte" lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences" className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                        <button disabled={!commentText.trim()} className="rounded-2xl bg-blue-700 px-3 text-white disabled:bg-slate-200"><MessageSquare size={16} /></button>
                      </form>
                      {asset.comments.length > 0 && (
                        <div className="space-y-2">
                          {asset.comments.map((item) => (
                            <div key={item.id} className="rounded-2xl bg-slate-50 p-3">
                              <p className="text-sm font-black">{profileById.get(item.authorId)?.name}</p>
                              <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-3xl bg-white p-5 text-sm font-bold text-slate-500">Adicione uma arte para iniciar a revisão.</p>
      )}
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PublishModal — publica ou agenda o post em múltiplos canais simultaneamente
// ─────────────────────────────────────────────────────────────────────────────
type ChannelPublishConfig = {
  channelId: string;
  enabled: boolean;
  format: string;
  title: string;
  description: string;
  status: "idle" | "publishing" | "success" | "error" | "unsupported";
  errorMessage?: string;
};

const formatsByPlatform: Record<string, string[]> = {
  youtube:   ["Vídeo", "Shorts"],
  instagram: ["Feed", "Story", "Reels", "Lives"],
  tiktok:    ["Vídeo", "Story", "Live", "Feed"],
  facebook:  ["Post", "Story", "Reels"],
  linkedin:  ["Post", "Artigo", "Vídeo"],
  outros:    ["Post"],
};

function publishPlatformKey(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("youtube"))   return "youtube";
  if (n.includes("instagram")) return "instagram";
  if (n.includes("tiktok"))    return "tiktok";
  if (n.includes("facebook"))  return "facebook";
  if (n.includes("linkedin"))  return "linkedin";
  return "outros";
}

function PublishModal({
  post,
  postReviewAssets,
  channels,
  setPosts,
  addPostReviewAssets,
  close,
}: {
  post: EditorialPost;
  postReviewAssets: PostReviewAsset[];
  channels: Channel[];
  setPosts: Dispatch<SetStateAction<EditorialPost[]>>;
  addPostReviewAssets: (post: EditorialPost, files: FileList | File[], isCover?: boolean) => void;
  close: () => void;
}) {
  const channelById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);
  const approvedAssets = postReviewAssets.filter((a) => a.postId === post.id && a.status === "Aprovado" && !a.isCover);
  const coverAsset = postReviewAssets.find((a) => a.postId === post.id && a.isCover);

  const allChannelIds = useMemo(() => {
    const ids = [post.channelId, ...(post.extraChannels?.map((e) => e.channelId) ?? [])];
    return [...new Set(ids)];
  }, [post]);

  const [channelConfigs, setChannelConfigs] = useState<ChannelPublishConfig[]>(() =>
    allChannelIds.map((id) => {
      const ch = channelById.get(id);
      const platform = publishPlatformKey(ch?.name ?? "");
      const formats = formatsByPlatform[platform] ?? ["Post"];
      return { channelId: id, enabled: true, format: formats[0], title: post.title, description: post.description ?? "", status: "idle" };
    })
  );
  const [publishMode, setPublishMode] = useState<"now" | "scheduled">("scheduled");
  const [scheduledDate, setScheduledDate] = useState(post.publishAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [scheduledTime, setScheduledTime] = useState(post.publishAt?.slice(11, 16) ?? "09:00");
  const [selectedAssetId, setSelectedAssetId] = useState(approvedAssets[0]?.id ?? "");

  const selectedAsset = approvedAssets.find((a) => a.id === selectedAssetId) ?? approvedAssets[0];

  const [localThumbnailUrl, setLocalThumbnailUrl] = useState<string | null>(null);
  const [localThumbnailPreview, setLocalThumbnailPreview] = useState<string | null>(null);
  const [thumbDriveOpen, setThumbDriveOpen] = useState(false);
  const [thumbFullscreen, setThumbFullscreen] = useState(false);
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false);

  const alreadyPublished = Boolean(post.publishedVideoId) || post.status === "Publicado" || post.status === "Agendado";

  const effectiveThumbnailUrl = coverAsset?.url ?? localThumbnailUrl ?? null;

  function getDriveDisplayUrl(asset: PostReviewAsset): string {
    if (asset.source === "upload") return asset.previewUrl;
    const match = asset.url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w400`;
    return asset.previewUrl;
  }

  const effectiveThumbnailPreview = coverAsset
    ? getDriveDisplayUrl(coverAsset)
    : localThumbnailPreview ?? null;

  function updateConfig(channelId: string, patch: Partial<ChannelPublishConfig>) {
    setChannelConfigs((prev) => prev.map((c) => c.channelId === channelId ? { ...c, ...patch } : c));
  }

  const enabledCount = channelConfigs.filter((c) => c.enabled).length;
  const isPublishing  = channelConfigs.some((c) => c.status === "publishing");
  const isDone = channelConfigs.filter((c) => c.enabled).every((c) => c.status === "success" || c.status === "unsupported" || c.status === "error");

  async function handlePublish() {
    if (!selectedAsset || !supabase) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return;
    const scheduledAt = publishMode === "scheduled" ? `${scheduledDate}T${scheduledTime}:00` : null;
    setChannelConfigs((prev) => prev.map((c) => c.enabled ? { ...c, status: "publishing" } : c));
    await Promise.allSettled(
      channelConfigs.filter((c) => c.enabled).map(async (config) => {
        const ch = channelById.get(config.channelId);
        const platform = publishPlatformKey(ch?.name ?? "");
        if (platform === "youtube") {
          try {
            const res = await fetch("/api/google/youtube/publish", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ assetUrl: selectedAsset.url, title: config.title, description: config.description, format: config.format, scheduledAt, thumbnailUrl: effectiveThumbnailUrl }),
            });
            if (res.ok) {
              const { videoId, privacyStatus } = await res.json() as { videoId: string; privacyStatus?: string };
              const newStatus = (privacyStatus === "private" && scheduledAt) ? "Agendado" : "Publicado";
              updateConfig(config.channelId, { status: "success" });
              setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, publishedVideoId: videoId, status: newStatus, publishedAt: new Date().toISOString() } : p));
            } else {
              const data = await res.json() as { error?: string };
              updateConfig(config.channelId, { status: "error", errorMessage: data.error ?? "Erro ao publicar." });
            }
          } catch {
            updateConfig(config.channelId, { status: "error", errorMessage: "Erro de conexão." });
          }
        } else {
          updateConfig(config.channelId, { status: "unsupported" });
        }
      })
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm font-bold text-slate-500">{post.title}</p>

      {/* Aviso de duplicação */}
      {alreadyPublished && !confirmedDuplicate && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-black text-amber-800">
            ⚠️ Este post já foi {post.status === "Agendado" ? "agendado" : "publicado"}.
            Publicar novamente irá criar uma cópia duplicada no canal.
          </p>
          <button type="button" onClick={() => setConfirmedDuplicate(true)}
            className="mt-2 rounded-2xl bg-amber-600 px-3 py-1.5 text-xs font-black text-white hover:bg-amber-700">
            Entendo, publicar mesmo assim
          </button>
        </div>
      )}

      {/* Arte a publicar */}
      {approvedAssets.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-black uppercase text-slate-500">Arte a publicar</p>
          {approvedAssets.length === 1 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-sm font-black text-slate-900">{approvedAssets[0].name}</p>
            </div>
          ) : (
            <select value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black outline-none focus:border-blue-500">
              {approvedAssets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </section>
      )}

      {/* Agendamento */}
      <section className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
        <p className="mb-3 text-xs font-black uppercase text-slate-500">Agendamento</p>
        <div className="mb-3 flex gap-4">
          {(["scheduled", "now"] as const).map((mode) => (
            <label key={mode} className="flex cursor-pointer items-center gap-2">
              <input type="radio" name="publishMode" checked={publishMode === mode} onChange={() => setPublishMode(mode)} className="accent-blue-700" />
              <span className="text-sm font-black">{mode === "scheduled" ? "Agendar" : "Publicar agora"}</span>
            </label>
          ))}
        </div>
        {publishMode === "scheduled" && (
          <div className="flex gap-3">
            <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black outline-none focus:border-blue-500" />
            <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black outline-none focus:border-blue-500" />
          </div>
        )}
      </section>

      {/* Seleção de canais */}
      <section>
        <p className="mb-3 text-xs font-black uppercase text-slate-500">Canais para publicar</p>
        <div className="flex flex-wrap gap-2">
          {channelConfigs.map((config) => {
            const ch = channelById.get(config.channelId);
            return (
              <label key={config.channelId} className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 transition ${config.enabled ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-400"}`}>
                <input type="checkbox" checked={config.enabled} onChange={(e) => updateConfig(config.channelId, { enabled: e.target.checked })} className="accent-blue-700" />
                <span className="text-sm font-black">{ch?.name ?? config.channelId}</span>
              </label>
            );
          })}
        </div>
      </section>

      {/* Cards por canal */}
      <div className="space-y-3">
        {channelConfigs.filter((c) => c.enabled).map((config) => {
          const ch = channelById.get(config.channelId);
          const name = ch?.name ?? "";
          const platform = publishPlatformKey(name);
          const formats = formatsByPlatform[platform] ?? ["Post"];
          const isYoutube = platform === "youtube";
          const supported = platform === "youtube";
          return (
            <div key={config.channelId} className={`rounded-3xl border p-4 ${config.status === "success" ? "border-emerald-200 bg-emerald-50" : config.status === "error" ? "border-rose-200 bg-rose-50" : "border-slate-100 bg-slate-50"}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="font-black">{name}</p>
                <div className="flex items-center gap-2">
                  {config.status === "success"    && <span className="text-xs font-black text-emerald-700">✓ Publicado</span>}
                  {config.status === "error"      && <span className="text-xs font-black text-rose-700">✕ Erro</span>}
                  {config.status === "publishing" && <span className="text-xs font-black text-blue-700">Publicando…</span>}
                  {supported
                    ? <span className="rounded-xl bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-700">✓ API conectada</span>
                    : <span className="rounded-xl bg-slate-200 px-2 py-0.5 text-xs font-black text-slate-500">Em breve</span>
                  }
                </div>
              </div>
              {/* Formato */}
              <div className="mb-3">
                <p className="mb-1 text-xs font-black text-slate-500">Formato</p>
                <div className="flex flex-wrap gap-3">
                  {formats.map((fmt) => (
                    <label key={fmt} className="flex cursor-pointer items-center gap-1.5">
                      <input type="radio" name={`format-${config.channelId}`} checked={config.format === fmt} onChange={() => updateConfig(config.channelId, { format: fmt })} className="accent-blue-700" />
                      <span className="text-sm font-black">{fmt}</span>
                    </label>
                  ))}
                </div>
              </div>
              {/* Título (YouTube only) */}
              {isYoutube && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-black text-slate-500">Título</p>
                  <input value={config.title} onChange={(e) => updateConfig(config.channelId, { title: e.target.value })} lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences" className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black outline-none focus:border-blue-500" />
                </div>
              )}
              {/* Thumbnail (YouTube only) */}
              {isYoutube && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-black text-slate-500">Thumbnail</p>
                  {effectiveThumbnailPreview ? (
                    <div className="flex items-center gap-3 rounded-2xl bg-white p-3">
                      <button type="button" onClick={() => setThumbFullscreen(true)} className="shrink-0 cursor-zoom-in" title="Ver capa em tamanho grande">
                        <img src={effectiveThumbnailPreview} className="h-14 w-24 rounded-xl object-cover" alt="thumbnail" />
                      </button>
                      <div className="flex-1">
                        <p className="text-sm font-black text-slate-700">{coverAsset ? "Capa da revisão" : "Thumbnail selecionada"}</p>
                        {!coverAsset && (
                          <button type="button" onClick={() => { setLocalThumbnailUrl(null); setLocalThumbnailPreview(null); }} className="mt-1 text-xs font-bold text-rose-600 hover:text-rose-800">
                            Remover
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <FileDropZone
                        icon="image"
                        title="Enviar thumbnail"
                        hint="JPG ou PNG"
                        accept="image/*"
                        onFiles={(files) => addPostReviewAssets(post, files, true)}
                      />
                      <button type="button" onClick={() => setThumbDriveOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700 hover:bg-blue-100">
                        <HardDrive size={15} /> Escolher do Drive
                      </button>
                    </div>
                  )}
                  {thumbDriveOpen && (
                    <DriveExplorerModal
                      onSelect={(file) => { setLocalThumbnailUrl(file.url); setLocalThumbnailPreview(file.thumbnailUrl ?? `https://drive.google.com/thumbnail?id=${file.id}&sz=w400`); setThumbDriveOpen(false); }}
                      onClose={() => setThumbDriveOpen(false)}
                    />
                  )}
                </div>
              )}
              {/* Descrição / Legenda */}
              <div>
                <p className="mb-1 text-xs font-black text-slate-500">{isYoutube ? "Descrição" : "Legenda"}</p>
                <textarea value={config.description} onChange={(e) => updateConfig(config.channelId, { description: e.target.value })} rows={4} lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences" className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
              {config.status === "error" && config.errorMessage && (
                <p className="mt-2 text-xs font-black text-rose-700">{config.errorMessage}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Botão de ação */}
      {!isDone ? (
        <button type="button" disabled={enabledCount === 0 || isPublishing || !selectedAsset || (alreadyPublished && !confirmedDuplicate)} onClick={handlePublish} className="w-full rounded-3xl bg-blue-700 px-4 py-3 font-black text-white transition hover:bg-blue-800 disabled:opacity-50">
          {isPublishing
            ? "Publicando…"
            : publishMode === "now"
              ? `Publicar agora em ${enabledCount} canal${enabledCount !== 1 ? "is" : ""}`
              : `Agendar em ${enabledCount} canal${enabledCount !== 1 ? "is" : ""}`
          }
        </button>
      ) : (
        <button type="button" onClick={close} className="w-full rounded-3xl bg-emerald-600 px-4 py-3 font-black text-white transition hover:bg-emerald-700">
          Concluído ✓
        </button>
      )}

      {/* Fullscreen thumbnail */}
      {thumbFullscreen && effectiveThumbnailPreview && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80"
          onClick={() => setThumbFullscreen(false)}
        >
          <img
            src={effectiveThumbnailPreview}
            className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
            alt="thumbnail"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setThumbFullscreen(false)}
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/40"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function IdeaModalV2({ modal, currentUser, profiles, channels, productLines, vehicleTypes, contentTypes, funnelStages, postTemplates, ideas, setIdeas, prepareIdeaAttachment, openMediaPreview, createNotifications, close }: Parameters<typeof EntityModal>[0] & { close: () => void }) {
  const editing = modal?.kind === "idea" && modal.id ? ideas.find((idea) => idea.id === modal.id) : undefined;
  const [externalUrl, setExternalUrl] = useState("");
  const [ytOpen, setYtOpen] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const draftIdeaId = useRef(editing?.id ?? crypto.randomUUID());
  const [selectedTemplateId, setSelectedTemplateId] = useState(editing?.templateId ?? "");
  const [creationMode, setCreationMode] = useState<"zero" | "template">("zero");
  const [selectedChannelId, setSelectedChannelId] = useState(editing?.channelId ?? channels[0]?.id ?? "");
  const [attachments, setAttachments] = useState<TaskAttachment[]>(editing?.attachments ?? []);
  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId);
  const formatOptions = postFormatOptionsForChannel(selectedChannel);

  function applyTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    const template = postTemplates.find((item) => item.id === templateId);
    if (!template || !formRef.current) return;
    const form = formRef.current;
    setFormValue(form, "description", templateDescription(template));
    if (template.channelId && !editing) setSelectedChannelId(template.channelId);
    for (const [name, value] of Object.entries({ contentTypeId: template.contentTypeId, channelId: template.channelId, funnelStageId: template.funnelStageId, format: template.format })) {
      setFormValue(form, name, value);
    }
  }

  async function addDraftFile(file: File) {
    try {
      const attachment = await prepareIdeaAttachment(draftIdeaId.current, file);
      setAttachments((current) => [attachment, ...current]);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Erro ao enviar arquivo.");
    }
  }

  function addDraftLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const previewUrl = drivePreviewUrl(externalUrl);
    if (!previewUrl) {
      window.alert("Link inválido. Use um link de compartilhamento do Google Drive ou YouTube.");
      return;
    }
    const attachment: TaskAttachment = { id: crypto.randomUUID(), name: youtubePreviewUrl(externalUrl) ? "Exemplo do YouTube" : "Exemplo do Google Drive", type: "video", source: "external", url: externalUrl, previewUrl, originalSize: 0, compressedSize: 0, mimeType: "text/html" };
    setAttachments((current) => [attachment, ...current]);
    setExternalUrl("");
  }

  function addDriveFileToIdea(file: DriveFile) {
    const attachment: TaskAttachment = { id: crypto.randomUUID(), name: file.name, type: file.mimeType.startsWith("image/") ? "foto" : file.mimeType.startsWith("video/") ? "video" : "arquivo", source: "external", url: file.url, previewUrl: file.previewUrl, originalSize: 0, compressedSize: 0, mimeType: file.mimeType };
    setAttachments((current) => [attachment, ...current]);
  }

  function addYouTubeToIdea(video: YouTubeVideo) {
    const attachment: TaskAttachment = { id: crypto.randomUUID(), name: video.title, type: "video", source: "external", url: video.url, previewUrl: video.previewUrl, originalSize: 0, compressedSize: 0, mimeType: "text/html" };
    setAttachments((current) => [attachment, ...current]);
  }

  function changeCreationMode(mode: "zero" | "template") {
    setCreationMode(mode);
    if (mode === "zero") setSelectedTemplateId("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const creating = !editing;
    const value: Idea = { id: draftIdeaId.current, templateId: String(form.get("templateId") ?? "") || undefined, title: String(form.get("title")), description: String(form.get("description")), productLineId: String(form.get("productLineId")), vehicleTypeId: String(form.get("vehicleTypeId")), contentTypeId: String(form.get("contentTypeId")), type: String(form.get("type")) as Idea["type"], channelId: String(form.get("channelId")), format: String(form.get("format")) || defaultPostFormatForChannel(selectedChannel), funnelStageId: String(form.get("funnelStageId")), createdBy: editing?.createdBy ?? currentUser.id, priority: String(form.get("priority")) as Idea["priority"], order: editing?.order ?? ideas.length + 1, attachments };
    setIdeas((current) => editing ? current.map((idea) => idea.id === value.id ? value : idea) : [value, ...current]);
    if (creating) {
      createNotifications(profiles.filter((profile) => profile.id !== currentUser.id && profile.active).map((profile) => profile.id), "Nova ideia cadastrada", value.title, "idea", value.id);
    }
    close();
  }
  return (
    <div className="space-y-5">
      <EntityForm onSubmit={submit} formRef={formRef}>
        <div className="flex gap-2 rounded-2xl bg-slate-100 p-1 md:col-span-2">
          <button type="button" onClick={() => changeCreationMode("zero")} className={`flex-1 rounded-xl px-3 py-2 text-sm font-black ${creationMode === "zero" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"}`}>Criar do zero</button>
          <button type="button" onClick={() => changeCreationMode("template")} className={`flex-1 rounded-xl px-3 py-2 text-sm font-black ${creationMode === "template" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"}`}>Usar modelo</button>
        </div>
        {creationMode === "template" && <label className="block text-sm font-bold text-slate-600 md:col-span-2">Usar modelo<select name="templateId" value={selectedTemplateId} onChange={(event) => applyTemplate(event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-950 outline-none focus:border-blue-500"><option value="">Sem modelo</option>{postTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>}
        {creationMode !== "template" && <input type="hidden" name="templateId" value={selectedTemplateId} />}
        <TextInput name="title" label="Ideia" required defaultValue={editing?.title} />
        <Select name="type" label="Tipo" defaultValue={editing?.type} options={ideaTypes.map((item) => [item, item])} />
        <TextArea name="description" label="Descrição da ideia" defaultValue={editing?.description} />
        <Select name="productLineId" label="Linha de produto" defaultValue={editing?.productLineId} options={[["", "Sem linha específica"], ...productLines.map((item) => [item.id, item.name])]} />
        <Select name="vehicleTypeId" label="Tipo de veículo" defaultValue={editing?.vehicleTypeId} options={[["", "Sem tipo específico"], ...vehicleTypes.map((item) => [item.id, item.name])]} />
        <Select name="contentTypeId" label="Tipo de conteúdo" defaultValue={editing?.contentTypeId} options={[["", "Sem tipo de conteúdo"], ...contentTypes.map((item) => [item.id, item.name])]} />
        <label className="block text-sm font-bold text-slate-600">Canal<select name="channelId" value={selectedChannelId} onChange={(event) => setSelectedChannelId(event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-950 outline-none focus:border-blue-500">{channels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <Select key={selectedChannelId} name="format" label="Formato" defaultValue={editing?.format ?? defaultPostFormatForChannel(selectedChannel)} options={formatOptions.map((item) => [item, item])} />
        <Select name="funnelStageId" label="Funil" defaultValue={editing?.funnelStageId} options={[["", "Sem funil"], ...funnelStages.map((item) => [item.id, item.name])]} />
        <Select name="priority" label="Prioridade" defaultValue={editing?.priority} options={["Alta", "Média", "Baixa"].map((item) => [item, item])} />
        <SubmitButton>{editing ? "Salvar" : "Criar"}</SubmitButton>
      </EntityForm>
      <section className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <h3 className="font-black">Arquivo de exemplo</h3>
          <FileDropZone
            className="mt-3"
            icon="file"
            title="Adicionar imagem, vídeo ou arquivo"
            hint="Imagens até 2 MB, vídeos até 100 MB"
            onFiles={(files) => files[0] && addDraftFile(files[0])}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setDriveOpen(true)} className="flex items-center gap-2 rounded-2xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700 hover:bg-blue-100">
              <HardDrive size={15} /> Selecionar do Drive
            </button>
            <button type="button" onClick={() => setYtOpen(true)} className="flex items-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-sm font-black text-red-700 hover:bg-red-100">
              <Youtube size={15} /> Buscar no YouTube
            </button>
          </div>
          <form onSubmit={addDraftLink} className="mt-3 flex gap-2">
            <input value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="Ou cole um link do Google Drive / YouTube" className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            <button disabled={!externalUrl.trim()} className="rounded-2xl bg-slate-950 px-4 text-sm font-black text-white disabled:bg-slate-200">Adicionar</button>
          </form>
          {driveOpen && <DriveExplorerModal onSelect={addDriveFileToIdea} onClose={() => setDriveOpen(false)} />}
          {ytOpen && <YouTubeSearchModal onSelect={addYouTubeToIdea} onClose={() => setYtOpen(false)} />}
          <div className="mt-3 grid gap-2">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="rounded-2xl bg-white p-3 text-sm font-black">
                <div className="flex items-center justify-between gap-2">
                  <a href={attachment.url} target="_blank" className="text-blue-700">{attachment.name}</a>
                  <div className="flex items-center gap-1">
                    <FileActionButtons item={attachment} onPreview={() => openMediaPreview(attachment)} />
                    <button type="button" onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))} className="rounded-xl bg-rose-100 p-1.5 text-rose-700"><Trash2 size={14} /></button>
                  </div>
                </div>
                <p className="mt-1 text-xs font-bold text-slate-400">{attachment.source === "external" ? externalMediaLabel(attachment) : formatBytes(attachment.compressedSize || attachment.originalSize)}</p>
                <button type="button" onClick={() => openMediaPreview(attachment)} className="mt-3 block w-full overflow-hidden rounded-2xl text-left">
                  <MediaPreviewContent item={attachment} />
                </button>
              </div>
            ))}
          </div>
        </section>
      {editing && <DeleteButton label="Excluir ideia" onDelete={() => { setIdeas((current) => current.filter((idea) => idea.id !== editing.id)); close(); }} />}
    </div>
  );
}

function CampaignModalV2({ modal, currentUser, profiles, campaignAudiences, productLines, vehicleTypes, funnelStages, campaigns, setCampaigns, createNotifications, close }: Parameters<typeof EntityModal>[0] & { close: () => void }) {
  const editing = modal?.kind === "campaign" && modal.id ? campaigns.find((item) => item.id === modal.id) : undefined;
  const audienceNames = campaignAudiences.map((item) => item.name);
  const hasOtherAudience = audienceNames.some((item) => normalizeText(item) === "outros");
  const defaultAudience = audienceNames[0] ?? "Geral";
  const otherAudience = audienceNames.find((item) => normalizeText(item) === "outros") ?? "Outros";
  const initialAudience = editing?.audience && audienceNames.includes(editing.audience) ? editing.audience : editing?.audience && hasOtherAudience ? otherAudience : defaultAudience;
  const [audienceChoice, setAudienceChoice] = useState(initialAudience);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const audience = normalizeText(audienceChoice) === "outros" ? String(form.get("customAudience")).trim() || audienceChoice : audienceChoice;
    const value: Campaign = { id: editing?.id ?? crypto.randomUUID(), name: String(form.get("name")), objective: String(form.get("objective")), audience, message: String(form.get("message")), productLineId: String(form.get("productLineId")), vehicleTypeId: String(form.get("vehicleTypeId")), funnelStageId: String(form.get("funnelStageId")), createdBy: editing?.createdBy ?? currentUser.id, assignedTo: form.getAll("assignedTo").map(String), startDate: String(form.get("startDate")), endDate: String(form.get("endDate")), status: editing?.status ?? "Planejada" };
    setCampaigns((current) => editing ? current.map((item) => item.id === value.id ? value : item) : [value, ...current]);
    const newAssignees = value.assignedTo.filter((id) => id !== currentUser.id && !(editing?.assignedTo ?? []).includes(id));
    if (newAssignees.length) createNotifications(newAssignees, "Campanha atribuída", value.name, "campaign", value.id);
    close();
  }
  return <><EntityForm onSubmit={submit}><TextInput name="name" label="Nome" required defaultValue={editing?.name} /><label className="block text-sm font-bold text-slate-600">Público<select value={audienceChoice} onChange={(event) => setAudienceChoice(event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-950 outline-none focus:border-blue-500">{audienceNames.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>{normalizeText(audienceChoice) === "outros" && <TextInput name="customAudience" label="Qual público?" defaultValue={audienceNames.includes(editing?.audience ?? "") ? "" : editing?.audience} />}<TextArea name="objective" label="Objetivo" defaultValue={editing?.objective} /><TextInput name="message" label="Mensagem" defaultValue={editing?.message} /><Select name="productLineId" label="Linha de produto" defaultValue={editing?.productLineId} options={[["", "Sem linha específica"], ...productLines.map((item) => [item.id, item.name])]} /><Select name="vehicleTypeId" label="Tipo de veículo" defaultValue={editing?.vehicleTypeId} options={[["", "Sem tipo específico"], ...vehicleTypes.map((item) => [item.id, item.name])]} /><Select name="funnelStageId" label="Funil" defaultValue={editing?.funnelStageId} options={[["", "Sem funil"], ...funnelStages.map((item) => [item.id, item.name])]} /><MultiSelectField name="assignedTo" label="Responsáveis" profiles={profiles} values={editing?.assignedTo ?? []} /><TextInput name="startDate" label="Início" type="date" defaultValue={editing?.startDate} /><TextInput name="endDate" label="Fim" type="date" defaultValue={editing?.endDate} /><SubmitButton>{editing ? "Salvar" : "Criar"}</SubmitButton></EntityForm>{editing && <DeleteButton label="Excluir campanha" onDelete={() => { setCampaigns((current) => current.filter((campaign) => campaign.id !== editing.id)); close(); }} />}</>;
}

function thumbnailForModal(metric: PostMetric): string | null {
  if (metric.thumbnailUrl) return proxiedThumbnailUrl(metric.thumbnailUrl);
  const ext = metric.externalId;
  if (ext?.startsWith("yt:")) return `https://i.ytimg.com/vi/${ext.slice(3)}/hqdefault.jpg`;
  return null;
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    slate: "bg-slate-50 text-slate-600 border-slate-100",
    orange: "bg-orange-50 text-orange-700 border-orange-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    red: "bg-rose-50 text-rose-700 border-rose-100",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-100",
  };
  return (
    <div className={`rounded-2xl border p-3 ${colors[color] ?? colors.slate}`}>
      <p className="text-[10px] font-black uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function EngagementBar({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-600">
        <span>{label}</span>
        <span>{formatNumber(value)} <span className="text-slate-400">({pct}%)</span></span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }} />
      </div>
    </div>
  );
}

function FunnelBlock({ label, value, pct, colorClass }: { label: string; value: string; pct: number; colorClass: string }) {
  return (
    <div className={`rounded-2xl border p-3 text-center ${colorClass}`}>
      <p className="text-xs font-bold opacity-70 leading-tight">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
        <div className="h-full rounded-full bg-current opacity-40" style={{ width: `${Math.min(100, Math.max(pct, pct > 0 ? 2 : 0))}%` }} />
      </div>
      <p className="mt-1 text-[10px] font-black opacity-60">{pct.toFixed(1)}%</p>
    </div>
  );
}

function MetricModalV2({ modal, posts, channels, productLines, vehicleTypes, contentTypes, funnelStages, campaigns, metrics, setMetrics, setTasks, taskColumns, setIdeas, currentUser, close }: Parameters<typeof EntityModal>[0] & { close: () => void }) {
  const editing = modal?.kind === "metric" && modal.id ? metrics.find((m) => m.id === modal.id) : undefined;
  const [editOpen, setEditOpen] = useState(false);
  const channelByIdLocal = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);

  const isYt = Boolean(editing?.externalId?.startsWith("yt:"));
  const videoId = isYt ? editing!.externalId!.slice(3) : null;
  const thumbUrl = editing ? thumbnailForModal(editing) : null;

  const engagement = editing ? editing.likes + editing.comments + editing.shares : 0;
  const engagementBase = engagement || 1;
  const likePct = editing ? Math.round((editing.likes / engagementBase) * 100) : 0;
  const commentPct = editing ? Math.round((editing.comments / engagementBase) * 100) : 0;
  const sharePct = editing ? Math.round((editing.shares / engagementBase) * 100) : 0;
  const netSubscribers = editing ? (editing.subscribersGained ?? 0) - (editing.subscribersLost ?? 0) : 0;
  const avgCtr = editing?.impressionClickThroughRate ?? 0;
  const avgRetention = editing?.averageViewPercentage ?? 0;
  const watchTime = editing?.watchTimeMinutes ?? 0;

  function createImprovementTask(metric: PostMetric) {
    const column = taskColumns.slice().sort((a, b) => a.order - b.order)[0];
    if (!column) return;
    setTasks((current) => [{
      id: crypto.randomUUID(),
      title: `Melhorar resultado: ${metric.postTitle}`,
      columnId: column.id,
      order: current.filter((t) => t.columnId === column.id).length + 1,
      priority: metric.leads === 0 ? "Alta" : "Média",
      progress: "Atenção",
      createdBy: currentUser.id,
      assignedTo: [],
      relatedTo: "Métricas",
      funnelStageId: metric.funnelStageId,
      dueDate: todayIso(),
      description: `Analisar métrica do post "${metric.postTitle}". Views: ${metric.reach}. Aprendizado: ${metric.learning || "sem aprendizado registrado"}.`,
      checklist: [
        { id: crypto.randomUUID(), label: "Identificar hipótese do baixo desempenho", done: false },
        { id: crypto.randomUUID(), label: "Propor ajuste de conteúdo ou campanha", done: false }
      ],
      comments: [],
      attachments: [],
      ...defaultTaskResetFields()
    }, ...current]);
  }

  function createPostIdea(metric: PostMetric) {
    setIdeas((current) => [{
      id: crypto.randomUUID(),
      title: `Replicar formato: ${metric.postTitle}`,
      description: `Ideia criada a partir de uma métrica com bom resultado. Aprendizado: ${metric.learning || "sem aprendizado registrado"}.`,
      productLineId: metric.productLineId,
      vehicleTypeId: metric.vehicleTypeId,
      contentTypeId: metric.contentTypeId,
      type: "Postagem",
      channelId: metric.channelId,
      format: defaultPostFormatForChannel(channelByIdLocal.get(metric.channelId)),
      funnelStageId: metric.funnelStageId,
      createdBy: currentUser.id,
      priority: "Alta",
      order: current.length + 1,
      attachments: []
    }, ...current]);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const postId = String(form.get("postId") ?? "");
    const linkedPost = posts.find((p) => p.id === postId);
    const value: PostMetric = {
      ...(editing ?? {} as PostMetric),
      id: editing?.id ?? crypto.randomUUID(),
      postId: postId || undefined,
      postTitle: linkedPost?.title || String(form.get("postTitle")) || "Métrica avulsa",
      channelId: linkedPost?.channelId || String(form.get("channelId")) || "",
      campaignId: linkedPost?.campaignId || String(form.get("campaignId")) || "",
      productLineId: linkedPost?.productLineId || String(form.get("productLineId")) || "",
      vehicleTypeId: linkedPost?.vehicleTypeId || String(form.get("vehicleTypeId")) || "",
      contentTypeId: linkedPost?.contentTypeId || String(form.get("contentTypeId")) || "",
      funnelStageId: linkedPost?.funnelStageId || String(form.get("funnelStageId")) || "",
      date: String(form.get("date")),
      reach: Number(form.get("reach")),
      likes: Number(form.get("likes")),
      comments: Number(form.get("comments")),
      shares: Number(form.get("shares")),
      clicks: Number(form.get("clicks")),
      leads: Number(form.get("leads")),
      notes: String(form.get("notes")),
      learning: String(form.get("learning")),
    };
    setMetrics((current) => {
      if (editing) return current.map((m) => m.id === value.id ? value : m);
      const samePost = value.postId ? current.find((m) => m.postId === value.postId) : undefined;
      if (samePost) return current.map((m) => m.id === samePost.id ? { ...value, id: samePost.id } : m);
      return [value, ...current];
    });
    close();
  }

  // Novo registro — layout simplificado de formulário
  if (!editing) {
    return (
      <EntityForm onSubmit={submit}>
        <Select name="postId" label="Post vinculado" defaultValue="" options={[["", "Métrica avulsa"], ...posts.map((p) => [p.id, p.title])]} />
        <TextInput name="postTitle" label="Nome do registro" required defaultValue="" />
        <TextInput name="date" label="Data" type="date" required defaultValue={todayIso()} />
        <Select name="channelId" label="Canal" defaultValue="" options={channels.map((c) => [c.id, c.name])} />
        <Select name="campaignId" label="Campanha" defaultValue="" options={campaigns.map((c) => [c.id, c.name])} />
        <Select name="productLineId" label="Linha" defaultValue="" options={[["", "Sem linha"], ...productLines.map((c) => [c.id, c.name])]} />
        {["reach", "likes", "comments", "shares", "clicks", "leads"].map((field) => (
          <TextInput key={field} name={field} label={field} type="number" required defaultValue="0" />
        ))}
        <TextArea name="notes" label="Observações" defaultValue="" />
        <TextArea name="learning" label="Aprendizado" defaultValue="" />
        <SubmitButton>Criar métrica</SubmitButton>
      </EntityForm>
    );
  }

  return (
    <>
      {/* ── Header com thumbnail ─────────────────────────────── */}
      {thumbUrl && (
        <div className="relative mb-5 overflow-hidden rounded-3xl bg-slate-900">
          <img src={thumbUrl} alt="" className="w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {editing.videoType === "short" && <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-black text-white">Shorts</span>}
              {editing.videoType === "video" && <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-black text-white">Vídeo</span>}
              {editing.privacyStatus === "private" && <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-black text-white">🔒 Privado</span>}
              {editing.privacyStatus === "unlisted" && <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-black text-white">🔗 Não listado</span>}
              {editing.date && <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-black text-white">{new Date(`${editing.date}T12:00:00`).toLocaleDateString("pt-BR")}</span>}
            </div>
            <h3 className="text-lg font-black leading-tight text-white">{editing.postTitle}</h3>
          </div>
        </div>
      )}

      {/* ── KPI Cards ───────────────────────────────────────── */}
      {isYt ? (
        <div className="mb-5 grid grid-cols-3 gap-3">
          <StatCard label="Visualizações" value={formatNumber(editing.reach)} color="blue" />
          <StatCard label="Impressões" value={editing.impressions ? formatNumber(editing.impressions) : "—"} color="slate" />
          <StatCard label="CTR" value={avgCtr ? formatPercent(avgCtr) : "—"} color="orange" />
          <StatCard label="Retenção média" value={avgRetention ? formatPercent(avgRetention) : "—"} color="emerald" />
          <StatCard label="Watch Time" value={watchTime ? `${formatNumber(Math.round(watchTime))} min` : "—"} color="violet" />
          <StatCard label="Inscritos líquidos" value={(netSubscribers >= 0 ? "+" : "") + formatNumber(netSubscribers)} color={netSubscribers >= 0 ? "green" : "red"} />
        </div>
      ) : (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Alcance" value={formatNumber(editing.reach)} color="blue" />
          <StatCard label="Engajamento" value={formatNumber(engagement)} color="violet" />
          <StatCard label="Cliques" value={formatNumber(editing.clicks)} color="cyan" />
          <StatCard label="Leads" value={formatNumber(editing.leads)} color="green" />
        </div>
      )}

      {/* ── Engajamento barras ──────────────────────────────── */}
      {engagement > 0 && (
        <div className="mb-5 rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-black text-slate-700">Engajamento</h4>
            <span className="text-sm font-bold text-slate-500">{formatNumber(engagement)} interações</span>
          </div>
          <div className="space-y-2.5">
            <EngagementBar label="Curtidas" value={editing.likes} pct={likePct} color="bg-rose-400" />
            <EngagementBar label="Comentários" value={editing.comments} pct={commentPct} color="bg-blue-400" />
            <EngagementBar label="Compartilhamentos" value={editing.shares} pct={sharePct} color="bg-violet-400" />
          </div>
        </div>
      )}

      {/* ── Funil de impressões ─────────────────────────────── */}
      {editing.impressions && editing.impressions > 0 && (
        <div className="mb-5 rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <h4 className="mb-3 font-black text-slate-700">Funil de Impressões</h4>
          <div className="grid grid-cols-3 gap-2">
            <FunnelBlock label="Impressões" value={formatNumber(editing.impressions)} pct={100} colorClass="border-blue-100 bg-blue-50 text-blue-800" />
            <FunnelBlock
              label={`Cliques · CTR`}
              value={formatNumber(Math.round(editing.impressions * avgCtr / 100))}
              pct={avgCtr}
              colorClass="border-indigo-100 bg-indigo-50 text-indigo-800"
            />
            <FunnelBlock
              label="Views"
              value={formatNumber(editing.reach)}
              pct={Math.min(100, (editing.reach / editing.impressions) * 100)}
              colorClass="border-violet-100 bg-violet-50 text-violet-800"
            />
          </div>
        </div>
      )}

      {/* ── Aprendizado / notas ─────────────────────────────── */}
      {(editing.learning || editing.notes) && (
        <div className="mb-5 space-y-2">
          {editing.learning && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-emerald-600">Aprendizado</p>
              <p className="mt-1 text-sm font-bold text-emerald-900">{editing.learning}</p>
            </div>
          )}
          {editing.notes && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Observações</p>
              <p className="mt-1 text-sm font-bold text-slate-700">{editing.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Editar informações (colapsável) ─────────────────── */}
      <div className="mb-5 overflow-hidden rounded-3xl border border-slate-100">
        <button
          type="button"
          onClick={() => setEditOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-50"
        >
          <span>Editar informações</span>
          <span className="text-slate-400">{editOpen ? "▴" : "▾"}</span>
        </button>
        {editOpen && (
          <div className="border-t border-slate-100 px-4 pb-4 pt-3">
            <EntityForm onSubmit={submit}>
              <Select name="postId" label="Post vinculado" defaultValue={editing.postId ?? ""} options={[["", "Métrica avulsa"], ...posts.map((p) => [p.id, p.title])]} />
              <TextInput name="postTitle" label="Nome do post/registro" required defaultValue={editing.postTitle} />
              <TextInput name="date" label="Data da métrica" type="date" required defaultValue={editing.date ?? todayIso()} />
              <Select name="channelId" label="Canal" defaultValue={editing.channelId} options={channels.map((c) => [c.id, c.name])} />
              <Select name="campaignId" label="Campanha" defaultValue={editing.campaignId} options={campaigns.map((c) => [c.id, c.name])} />
              <Select name="productLineId" label="Linha" defaultValue={editing.productLineId} options={[["", "Sem linha específica"], ...productLines.map((c) => [c.id, c.name])]} />
              <Select name="vehicleTypeId" label="Tipo de veículo" defaultValue={editing.vehicleTypeId} options={[["", "Sem tipo específico"], ...vehicleTypes.map((c) => [c.id, c.name])]} />
              <Select name="contentTypeId" label="Tipo de conteúdo" defaultValue={editing.contentTypeId} options={[["", "Sem tipo de conteúdo"], ...contentTypes.map((c) => [c.id, c.name])]} />
              <Select name="funnelStageId" label="Funil" defaultValue={editing.funnelStageId} options={[["", "Sem funil"], ...funnelStages.map((c) => [c.id, c.name])]} />
              {["reach", "likes", "comments", "shares", "clicks", "leads"].map((field) => (
                <TextInput key={field} name={field} label={field} type="number" required defaultValue={String((editing as unknown as Record<string, number | undefined>)?.[field] ?? "")} />
              ))}
              <TextArea name="notes" label="Observações do resultado" defaultValue={editing.notes} />
              <TextArea name="learning" label="Aprendizado" defaultValue={editing.learning} />
              <SubmitButton>Salvar alterações</SubmitButton>
            </EntityForm>
          </div>
        )}
      </div>

      {/* ── Rodapé de ações ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        {videoId && (
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-2xl bg-red-50 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-100"
          >
            <Youtube size={15} /> Abrir no YouTube
          </a>
        )}
        <button
          type="button"
          onClick={() => { createImprovementTask(editing); close(); }}
          className="rounded-2xl bg-amber-50 px-4 py-2 text-sm font-black text-amber-700 hover:bg-amber-100"
        >
          Criar tarefa
        </button>
        <button
          type="button"
          onClick={() => { createPostIdea(editing); close(); }}
          className="rounded-2xl bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 hover:bg-blue-100"
        >
          Criar ideia similar
        </button>
        <div className="ml-auto">
          <DeleteButton
            label="Excluir métrica"
            onDelete={() => { setMetrics((current) => current.filter((m) => m.id !== editing.id)); close(); }}
          />
        </div>
      </div>
    </>
  );
}

function PostModal({ modal, currentUser, profiles, channels, productLines, vehicleTypes, contentTypes, funnelStages, campaigns, posts, setPosts, close }: Parameters<typeof EntityModal>[0] & { close: () => void }) {
  const editing = modal?.kind === "post" && modal.id ? posts.find((post) => post.id === modal.id) : undefined;
  const neutralCampaign = campaigns.find((campaign) => normalizeText(campaign.name) === "campanha neutra");
  const [selectedChannelId, setSelectedChannelId] = useState(editing?.channelId ?? channels[0]?.id ?? "");
  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId);
  const postFormatOptions = postFormatOptionsForChannel(selectedChannel);
  const defaultFormat = editing?.format && postFormatOptions.includes(editing.format) ? editing.format : defaultPostFormatForChannel(selectedChannel);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = editing?.status ?? "Produção";
    const value: EditorialPost = {
      id: editing?.id ?? crypto.randomUUID(),
      title: String(form.get("title")),
      channelId: String(form.get("channelId")),
      campaignId: String(form.get("campaignId")),
      productLineId: String(form.get("productLineId")),
      vehicleTypeId: String(form.get("vehicleTypeId")),
      contentTypeId: String(form.get("contentTypeId")),
      funnelStageId: String(form.get("funnelStageId")),
      createdBy: editing?.createdBy ?? currentUser.id,
      assignedTo: form.getAll("assignedTo").map(String),
      status,
      format: String(form.get("format")) || defaultPostFormatForChannel(selectedChannel),
      order: editing?.order ?? posts.filter((post) => post.status === status).length + 1,
      publishAt: String(form.get("publishAt")),
      description: String(form.get("description")),
      productionChecklist: editing?.productionChecklist ?? []
    };
    setPosts((current) => editing ? current.map((post) => post.id === value.id ? value : post) : [value, ...current]);
    close();
  }
  return <EntityForm onSubmit={submit}><TextInput name="title" label="Título" required defaultValue={editing?.title} /><label className="block text-sm font-bold text-slate-600">Canal<select name="channelId" value={selectedChannelId} onChange={(event) => setSelectedChannelId(event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-950 outline-none focus:border-blue-500">{channels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><Select key={selectedChannelId} name="format" label="Formato" defaultValue={defaultFormat} options={postFormatOptions.map((item) => [item, item])} /><Select name="campaignId" label="Campanha" defaultValue={editing?.campaignId ?? neutralCampaign?.id} options={campaigns.map((item) => [item.id, item.name])} /><Select name="productLineId" label="Linha de produto" defaultValue={editing?.productLineId} options={[["", "Sem linha específica"], ...productLines.map((item) => [item.id, item.name])]} /><Select name="vehicleTypeId" label="Tipo de veículo" defaultValue={editing?.vehicleTypeId} options={[["", "Sem tipo específico"], ...vehicleTypes.map((item) => [item.id, item.name])]} /><Select name="contentTypeId" label="Tipo de conteúdo" defaultValue={editing?.contentTypeId} options={[["", "Sem tipo de conteúdo"], ...contentTypes.map((item) => [item.id, item.name])]} /><Select name="funnelStageId" label="Funil" defaultValue={editing?.funnelStageId ?? ""} options={[["", "Sem funil"], ...funnelStages.map((item) => [item.id, item.name])]} /><MultiSelectField name="assignedTo" label="Responsáveis" profiles={profiles} values={editing?.assignedTo ?? []} /><TextInput name="publishAt" label="Data e hora" type="datetime-local" required defaultValue={editing?.publishAt} /><TextArea name="description" label="Descrição" defaultValue={editing?.description} /><SubmitButton>{editing ? "Salvar" : "Criar"}</SubmitButton></EntityForm>;
}

function CampaignModal({ modal, currentUser, profiles, productLines, vehicleTypes, funnelStages, campaigns, setCampaigns, close }: Parameters<typeof EntityModal>[0] & { close: () => void }) {
  const editing = modal?.kind === "campaign" && modal.id ? campaigns.find((item) => item.id === modal.id) : undefined;
  const initialAudience = editing?.audience && campaignAudienceOptions.includes(editing.audience) ? editing.audience : editing?.audience ? "Outros" : "Geral";
  const [audienceChoice, setAudienceChoice] = useState(initialAudience);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const audience = audienceChoice === "Outros" ? String(form.get("customAudience")).trim() || "Outros" : audienceChoice;
    const value: Campaign = { id: editing?.id ?? crypto.randomUUID(), name: String(form.get("name")), objective: String(form.get("objective")), audience, message: String(form.get("message")), productLineId: String(form.get("productLineId")), vehicleTypeId: String(form.get("vehicleTypeId")), funnelStageId: String(form.get("funnelStageId")), createdBy: editing?.createdBy ?? currentUser.id, assignedTo: form.getAll("assignedTo").map(String), startDate: String(form.get("startDate")), endDate: String(form.get("endDate")), status: editing?.status ?? "Planejada" };
    setCampaigns((current) => editing ? current.map((item) => item.id === value.id ? value : item) : [value, ...current]);
    close();
  }
  return <EntityForm onSubmit={submit}><TextInput name="name" label="Nome" required defaultValue={editing?.name} /><label className="block text-sm font-bold text-slate-600">Público<select value={audienceChoice} onChange={(event) => setAudienceChoice(event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-950 outline-none focus:border-blue-500">{campaignAudienceOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>{audienceChoice === "Outros" && <TextInput name="customAudience" label="Qual público?" defaultValue={campaignAudienceOptions.includes(editing?.audience ?? "") ? "" : editing?.audience} />}<TextArea name="objective" label="Objetivo" defaultValue={editing?.objective} /><TextInput name="message" label="Mensagem" defaultValue={editing?.message} /><Select name="productLineId" label="Linha de produto" defaultValue={editing?.productLineId} options={[["", "Sem linha específica"], ...productLines.map((item) => [item.id, item.name])]} /><Select name="vehicleTypeId" label="Tipo de veículo" defaultValue={editing?.vehicleTypeId} options={[["", "Sem tipo específico"], ...vehicleTypes.map((item) => [item.id, item.name])]} /><Select name="funnelStageId" label="Funil" defaultValue={editing?.funnelStageId} options={[["", "Sem funil"], ...funnelStages.map((item) => [item.id, item.name])]} /><MultiSelectField name="assignedTo" label="Responsáveis" profiles={profiles} values={editing?.assignedTo ?? []} /><TextInput name="startDate" label="Início" type="date" defaultValue={editing?.startDate} /><TextInput name="endDate" label="Fim" type="date" defaultValue={editing?.endDate} /><SubmitButton>{editing ? "Salvar" : "Criar"}</SubmitButton></EntityForm>;
}

function MetricModal({ channels, productLines, vehicleTypes, contentTypes, funnelStages, campaigns, setMetrics, close }: Parameters<typeof EntityModal>[0] & { close: () => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMetrics((current) => [{ id: crypto.randomUUID(), postId: undefined, postTitle: String(form.get("postTitle")), channelId: String(form.get("channelId")), campaignId: String(form.get("campaignId")), productLineId: String(form.get("productLineId")), vehicleTypeId: String(form.get("vehicleTypeId")), contentTypeId: String(form.get("contentTypeId")), funnelStageId: String(form.get("funnelStageId")), date: String(form.get("date")), reach: Number(form.get("reach")), likes: Number(form.get("likes")), comments: Number(form.get("comments")), shares: Number(form.get("shares")), clicks: Number(form.get("clicks")), leads: Number(form.get("leads")), notes: String(form.get("notes")), learning: String(form.get("learning")) }, ...current]);
    close();
  }
  return <EntityForm onSubmit={submit}><TextInput name="postTitle" label="Post" required /><TextInput name="date" label="Data da métrica" type="date" required defaultValue={todayIso()} /><Select name="channelId" label="Canal" options={channels.map((item) => [item.id, item.name])} /><Select name="campaignId" label="Campanha" options={campaigns.map((item) => [item.id, item.name])} /><Select name="productLineId" label="Linha" options={[["", "Sem linha específica"], ...productLines.map((item) => [item.id, item.name])]} /><Select name="vehicleTypeId" label="Tipo de veículo" options={[["", "Sem tipo específico"], ...vehicleTypes.map((item) => [item.id, item.name])]} /><Select name="contentTypeId" label="Tipo de conteúdo" options={[["", "Sem tipo de conteúdo"], ...contentTypes.map((item) => [item.id, item.name])]} /><Select name="funnelStageId" label="Funil" options={[["", "Sem funil"], ...funnelStages.map((item) => [item.id, item.name])]} />{["reach", "likes", "comments", "shares", "clicks", "leads"].map((field) => <TextInput key={field} name={field} label={field} type="number" required />)}<TextArea name="notes" label="Observações do resultado" /><TextArea name="learning" label="Aprendizado" /><SubmitButton>Salvar</SubmitButton></EntityForm>;
}

function ProfileModal({ currentUser, setProfiles, uploadProfilePhoto, close }: Parameters<typeof EntityModal>[0] & { close: () => void }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const file = form.get("avatar");

    if (supabase && email !== currentUser.email) {
      await supabase.auth.updateUser({ email });
    }
    if (supabase && password) {
      await supabase.auth.updateUser({ password });
    }
    if (file instanceof globalThis.File && (file as globalThis.File).size > 0) {
      await uploadProfilePhoto(currentUser.id, file);
    }

    setProfiles((current) =>
      current.map((profile) =>
        profile.id === currentUser.id
          ? {
              ...profile,
              name: String(form.get("name")),
              email,
              phone: String(form.get("phone")),
              bio: String(form.get("bio"))
            }
          : profile
      )
    );
    close();
  }

  return (
    <EntityForm onSubmit={submit}>
      <TextInput name="name" label="Nome" required defaultValue={currentUser.name} />
      <TextInput name="email" label="Email" type="email" required defaultValue={currentUser.email} />
      <TextInput name="phone" label="Telefone" defaultValue={currentUser.phone} />
      <PasswordInput name="password" label="Nova senha" />
      <label className="block text-sm font-bold text-slate-600 md:col-span-2">
        Foto de perfil
        <input name="avatar" type="file" accept="image/*" className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-950 outline-none focus:border-blue-500" />
      </label>
      <TextArea name="bio" label="Bio curta" defaultValue={currentUser.bio} />
      <SubmitButton>Salvar perfil</SubmitButton>
    </EntityForm>
  );
}

function TeamMemberModal({ modal, currentUser, profiles, profileAreas, profileModulePermissions, setProfiles, setProfileAreas, setProfileModulePermissions, uploadProfilePhoto, close }: Parameters<typeof EntityModal>[0] & { close: () => void }) {
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const member = modal?.kind === "teamMember" ? profiles.find((profile) => profile.id === modal.id) : undefined;
  const canManageTeam =
    hasModulePermission(currentUser, "marketing", "configuracoes", "manage", profileAreas, profileModulePermissions) ||
    hasModulePermission(currentUser, "vendas", "configuracoes", "manage", profileAreas, profileModulePermissions);
  if (!member || !canManageTeam) return <p className="text-sm font-bold text-slate-500">Você não tem permissão para editar este membro.</p>;

  function setAreaPermissionsInForm(area: AppArea, checked: boolean) {
    const selector = `[data-area-permission="${area}"]`;
    document.querySelectorAll<HTMLInputElement>(selector).forEach((input) => {
      input.checked = checked;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member || !supabase) return;
    const form = new FormData(event.currentTarget);

    const updated: Profile = {
      ...member,
      name: String(form.get("name")),
      email: String(form.get("email")),
      phone: String(form.get("phone")),
      bio: String(form.get("bio")),
      role: String(form.get("role")) as Role,
      active: form.get("active") === "on",
    };

    setSaving(true);
    setSaveErr("");

    try {
      const file = form.get("avatar");
      if (file instanceof globalThis.File && (file as globalThis.File).size > 0) {
        await uploadProfilePhoto(member.id, file);
      }
      await saveProfile(supabase, updated);
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : "Erro ao salvar. Tente novamente.");
      setSaving(false);
      return;
    }

    const selectedAreas: AppArea[] = appAreas
      .filter((area) => form.get(`area-${area.id}`) === "on")
      .map((area) => area.id);
    const nextAreas: ProfileArea[] = selectedAreas.map((area) => ({
      id: profileAreaId(member.id, area),
      profileId: member.id,
      area,
      active: true
    }));
    setProfiles((current) => current.map((profile) => (profile.id === member.id ? updated : profile)));
    setProfileAreas((current) => [...current.filter((area) => area.profileId !== member.id), ...nextAreas]);

    if (currentUser?.role === "admin") {
      const nextPermissions: ProfileModulePermission[] = selectedAreas.flatMap((area) =>
        menusForArea(area).map((item) => ({
          id: profilePermissionId(member.id, area, item.moduleId),
          profileId: member.id,
          area,
          moduleId: item.moduleId,
          canView: form.get(`permission-${area}-${item.moduleId}-view`) === "on",
          canCreate: form.get(`permission-${area}-${item.moduleId}-create`) === "on",
          canEdit: form.get(`permission-${area}-${item.moduleId}-edit`) === "on",
          canDelete: form.get(`permission-${area}-${item.moduleId}-delete`) === "on",
          canApprove: form.get(`permission-${area}-${item.moduleId}-approve`) === "on",
          canManage: form.get(`permission-${area}-${item.moduleId}-manage`) === "on"
        }))
      );
      setProfileModulePermissions((current) => [...current.filter((permission) => permission.profileId !== member.id), ...nextPermissions]);
    }

    close();
  }

  const memberAreaSet = new Set(profileAreas.filter((area) => area.profileId === member.id && area.active).map((area) => area.area));
  const permissionByKey = new Map(profileModulePermissions.filter((permission) => permission.profileId === member.id).map((permission) => [`${permission.area}:${permission.moduleId}`, permission]));

  return (
    <EntityForm onSubmit={submit}>
      <TextInput name="name" label="Nome" required defaultValue={member.name} />
      <TextInput name="email" label="Email" type="email" required defaultValue={member.email} />
      <TextInput name="phone" label="Telefone" defaultValue={member.phone} />
      <Select name="role" label="Função" defaultValue={member.role} options={roles.map((role) => [role, roleLabel[role]])} />
      <label className="block text-sm font-bold text-slate-600 md:col-span-2">
        Foto de perfil
        <input name="avatar" type="file" accept="image/*" className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-950 outline-none focus:border-blue-500" />
      </label>
      <label className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">
        <input name="active" type="checkbox" defaultChecked={member.active} />
        Membro ativo
      </label>
      <TextArea name="bio" label="Bio curta" defaultValue={member.bio} />
      <div className="md:col-span-2 rounded-3xl border border-slate-100 bg-slate-50 p-4">
        <p className="font-black">Equipes</p>
        <p className="mt-1 text-sm font-bold text-slate-500">
          {currentUser?.role === "admin"
            ? "Marcar uma equipe libera todas as telas daquela área. Depois você pode ajustar permissões específicas abaixo."
            : "Selecione a qual equipe este membro pertence."}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {appAreas.map((area) => (
            <label key={area.id} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-black text-slate-700">
              <input
                name={`area-${area.id}`}
                type="checkbox"
                defaultChecked={memberAreaSet.has(area.id)}
                onChange={(event) => currentUser?.role === "admin" && setAreaPermissionsInForm(area.id, event.currentTarget.checked)}
              />
              {area.label}
            </label>
          ))}
        </div>
      </div>
      {currentUser?.role === "admin" && <div className="md:col-span-2 space-y-4">
        {appAreas.map((area) => (
          <div key={area.id} className="rounded-3xl border border-slate-100 bg-white p-4">
            <h3 className="font-black">{area.label}</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="text-xs font-black uppercase text-slate-400">
                    <th className="py-2">Tela</th>
                    {moduleActions.map((action) => <th key={action.key} className="px-2 py-2 text-center">{action.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {menusForArea(area.id).map((item) => {
                    const permission = permissionByKey.get(`${area.id}:${item.moduleId}`);
                    return (
                      <tr key={item.sectionId} className="border-t border-slate-100">
                        <td className="py-2 font-bold text-slate-700">{item.label}</td>
                        {moduleActions.map((action) => (
                          <td key={action.key} className="px-2 py-2 text-center">
                            <input
                              data-area-permission={area.id}
                              name={`permission-${area.id}-${item.moduleId}-${action.key}`}
                              type="checkbox"
                              defaultChecked={permission ? Boolean(permission[permissionFlag(action.key)]) : memberAreaSet.has(area.id)}
                              className="h-4 w-4"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>}
      {saveErr && (
        <p className="md:col-span-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
          ⚠️ {saveErr}
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-700 px-4 py-2 font-black text-white transition hover:bg-slate-950 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saving ? "Salvando..." : "Salvar membro"}
      </button>
    </EntityForm>
  );
}

function DeleteButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (window.confirm(`${label}?`)) onDelete();
      }}
      className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-rose-100 px-4 py-2 text-sm font-black text-rose-700"
    >
      <Trash2 size={16} />
      {label}
    </button>
  );
}

function EntityForm({ children, onSubmit, formRef }: { children: ReactNode; onSubmit: (event: FormEvent<HTMLFormElement>) => void; formRef?: RefObject<HTMLFormElement | null> }) {
  return <form ref={formRef} onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">{children}</form>;
}

function YearPicker({ visibleMonth, setVisibleMonth, setCalendarMode }: { visibleMonth: Date; setVisibleMonth: Dispatch<SetStateAction<Date>>; setCalendarMode: Dispatch<SetStateAction<"Semana" | "Mês" | "Ano">> }) {
  const year = visibleMonth.getFullYear();
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 12 }, (_, month) => <button key={month} onClick={() => { setVisibleMonth(new Date(year, month, 1)); setCalendarMode("Mês"); }} className="rounded-3xl border border-slate-100 bg-slate-50 p-5 text-left font-black hover:border-blue-300 hover:bg-blue-50">{new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(year, month, 1))}</button>)}</div>;
}

function makeWeek(start: Date) {
  const first = new Date(start);
  const mondayOffset = (first.getDay() + 6) % 7;
  first.setDate(first.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return date;
  });
}

function makeMonth(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  first.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(first);
    day.setDate(first.getDate() + index);
    return day;
  });
}

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: LucideIcon }) {
  return <div className="rounded-[28px] bg-gradient-to-br from-blue-700 to-blue-500 p-5 text-white shadow-lg shadow-blue-900/10 motion-smooth animate-soft-pop"><div className="flex items-center justify-between"><p className="text-sm font-bold opacity-80">{label}</p><Icon size={20} /></div><p className="mt-4 text-3xl font-black">{value}</p></div>;
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm motion-smooth animate-fade-in-up"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Search size={17} className="text-blue-700" /><h2 className="font-black">{title}</h2></div>{action}</div>{children}</section>;
}

function CenteredModal({
  children,
  close,
  zClass = "z-[100]",
  maxWidth,
  variant = "standard",
  className = "",
  panelClassName = "",
  closeOnOverlay = true,
  panelRef,
}: {
  children: ReactNode;
  close?: () => void;
  zClass?: string;
  maxWidth?: string;
  variant?: "standard" | "compact" | "media" | "fullscreen-ish";
  className?: string;
  panelClassName?: string;
  closeOnOverlay?: boolean;
  panelRef?: RefObject<HTMLElement | null>;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted]);

  const variantClasses = {
    standard: "w-[min(1120px,calc(100vw-32px))] max-w-6xl max-h-[90vh]",
    compact: "w-[min(560px,calc(100vw-32px))] max-w-xl max-h-[90vh]",
    media: "w-[min(1120px,calc(100vw-32px))] max-w-5xl max-h-[90vh]",
    "fullscreen-ish": "w-[min(1180px,calc(100vw-32px))] max-w-6xl max-h-[90vh]",
  } satisfies Record<"standard" | "compact" | "media" | "fullscreen-ish", string>;

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${zClass} grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm animate-fade-in-up ${className}`}
      onClick={(event) => {
        if (closeOnOverlay && close && event.target === event.currentTarget) close();
      }}
    >
      <section
        ref={panelRef}
        className={`${maxWidth ?? variantClasses[variant]} overflow-y-auto rounded-[34px] border border-white/70 bg-white p-6 shadow-2xl shadow-slate-950/20 animate-soft-pop ${panelClassName}`}
      >
        {children}
      </section>
    </div>,
    document.body
  );
}

function RoundAdd({ onClick, label }: { onClick: () => void; label: string }) {
  return <button onClick={onClick} aria-label={label} title={label} className="grid h-11 w-11 place-items-center rounded-full bg-blue-700 text-white shadow-lg shadow-blue-700/20 motion-smooth hover:bg-blue-800"><Plus size={22} /></button>;
}

function Badge({ children, tone, className }: { children: ReactNode; tone: BadgeTone; className?: string }) {
  const tones = { blue: "bg-blue-100 text-blue-700", cyan: "bg-cyan-100 text-cyan-700", slate: "bg-slate-100 text-slate-600", red: "bg-rose-100 text-rose-700", green: "bg-emerald-100 text-emerald-700", amber: "bg-amber-100 text-amber-700", purple: "bg-violet-100 text-violet-700" };
  return <span className={`inline-flex rounded-2xl px-2.5 py-1 text-xs font-black ${tones[tone]}${className ? ` ${className}` : ""}`}>{children}</span>;
}

function FunnelBadge({ stage }: { stage?: FunnelStage }) {
  if (!stage) return null;
  return <span className="inline-flex rounded-2xl px-2.5 py-1 text-xs font-black text-white" style={{ backgroundColor: stage.color }}>{stage.name.split(" - ")[0]}</span>;
}

function Avatar({ profile, size }: { profile?: Profile; size: "xs" | "sm" | "md" | "lg" }) {
  const sizes = { xs: "h-8 w-8 text-xs", sm: "h-10 w-10 text-xs", md: "h-12 w-12 text-sm", lg: "h-16 w-16 text-lg" };
  return profile?.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={profile.avatarUrl} alt={profile.name} className={`${sizes[size]} rounded-full object-cover ring-2 ring-blue-100`} />
  ) : <div className={`${sizes[size]} flex items-center justify-center rounded-full bg-blue-700 font-black text-white ring-2 ring-blue-100`}>{profile ? initials(profile.name) : <UserRound size={16} />}</div>;
}

function TextInput({ label, name, type = "text", required = false, defaultValue, autoComplete }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string; autoComplete?: string }) {
  return <label className="block text-sm font-bold text-slate-600">{label}<input name={name} type={type} required={required} defaultValue={defaultValue} autoComplete={autoComplete} lang={type === "text" ? "pt-BR" : undefined} spellCheck={type === "text"} autoCorrect={type === "text" ? "on" : "off"} autoCapitalize={type === "text" ? "sentences" : "off"} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-950 outline-none focus:border-blue-500" /></label>;
}

function TextArea({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return <label className="block text-sm font-bold text-slate-600 md:col-span-2">{label}<textarea name={name} rows={8} defaultValue={defaultValue} lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences" className="mt-1 w-full resize-none rounded-3xl border border-slate-200 px-3 py-2 text-slate-950 outline-none focus:border-blue-500" /></label>;
}

function Select({ label, name, options, defaultValue }: { label: string; name: string; options: string[][]; defaultValue?: string }) {
  return <label className="block text-sm font-bold text-slate-600">{label}<select name={name} defaultValue={defaultValue} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-950 outline-none focus:border-blue-500">{options.map(([value, labelText]) => <option key={value} value={value}>{labelText}</option>)}</select></label>;
}

function SelectControlled({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return <label className="block text-sm font-bold text-slate-600">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-950 outline-none focus:border-blue-500">{options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}</select></label>;
}

function TextInputControlled({ label, value, onChange, type = "text", min, max }: { label: string; value: string; onChange: (value: string) => void; type?: string; min?: number; max?: number }) {
  return <label className="block text-sm font-bold text-slate-600">{label}<input value={value} onChange={(event) => onChange(event.target.value)} type={type} min={min} max={max} lang={type === "text" ? "pt-BR" : undefined} spellCheck={type === "text"} autoCorrect={type === "text" ? "on" : "off"} autoCapitalize={type === "text" ? "sentences" : "off"} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-950 outline-none focus:border-blue-500" /></label>;
}

function FileDropZone({
  title,
  hint,
  icon,
  multiple = false,
  accept,
  className = "",
  onFiles
}: {
  title: string;
  hint: string;
  icon: "camera" | "file" | "image";
  multiple?: boolean;
  accept?: string;
  className?: string;
  onFiles: (files: File[]) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const Icon = icon === "camera" ? Camera : icon === "image" ? FileImage : FileUp;

  function filesFromList(fileList: FileList | null) {
    return fileList ? Array.from(fileList).filter((file) => file.size > 0) : [];
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    let files = filesFromList(event.dataTransfer.files);
    if (accept) {
      const acceptedTypes = accept.split(",").map((t) => t.trim());
      files = files.filter((f) =>
        acceptedTypes.some((t) => {
          if (t.endsWith("/*")) return f.type.startsWith(t.replace("/*", "/"));
          return f.type === t || f.name.toLowerCase().endsWith(t.replace(/^\*?\./, ""));
        })
      );
      if (!files.length) {
        window.alert("Tipo de arquivo não permitido. Envie apenas: " + accept);
        return;
      }
    }
    if (!files.length) return;
    onFiles(multiple ? files : files.slice(0, 1));
  }

  return (
    <label
      onDragEnter={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "copy";
        setDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDragging(false);
      }}
      onDrop={handleDrop}
      className={`${className} grid cursor-pointer place-items-center rounded-3xl border-2 border-dashed px-4 py-7 text-center transition ${
        dragging ? "border-blue-500 bg-blue-100 text-blue-800 shadow-lg shadow-blue-900/10" : "border-blue-200 bg-white text-blue-700 hover:border-blue-400 hover:bg-blue-50"
      }`}
    >
      <Icon size={icon === "camera" ? 34 : 28} />
      <span className="mt-2 text-sm font-black">{dragging ? "Solte o arquivo aqui" : title}</span>
      <span className="mt-1 text-xs font-bold text-blue-500">{hint}</span>
      <input
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const files = filesFromList(event.target.files);
          if (files.length) onFiles(multiple ? files : files.slice(0, 1));
          event.target.value = "";
        }}
      />
    </label>
  );
}

function MultiSelect({ label, values, profiles, onChange }: { label: string; values: string[]; profiles: Profile[]; onChange: (values: string[]) => void }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const slots = values.length ? values : [""];
  function updateSlot(index: number, value: string) {
    const next = slots.slice();
    next[index] = value;
    onChange(Array.from(new Set(next.filter(Boolean))));
    setOpenIndex(null);
  }
  return (
    <div className="block text-sm font-bold text-slate-600">
      {label}
      <div className="mt-1 space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
        {slots.map((value, index) => (
          <div key={`${value}-${index}`} className="relative flex gap-2">
            <button type="button" onClick={() => setOpenIndex(openIndex === index ? null : index)} className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left font-black text-slate-700">
              <span className="truncate">{profiles.find((profile) => profile.id === value)?.name ?? "Selecionar responsável"}</span>
              <ChevronDown size={16} className="shrink-0 text-slate-400" />
            </button>
            {index === slots.length - 1 && (
              <button type="button" onClick={() => onChange([...slots.filter(Boolean), ""])} className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700 motion-smooth hover:bg-blue-100" aria-label="Adicionar responsável" title="Adicionar responsável">
                <Plus size={17} />
              </button>
            )}
            {slots.length > 1 && (
              <button type="button" onClick={() => onChange(slots.filter((_, slotIndex) => slotIndex !== index).filter(Boolean))} className="rounded-2xl bg-rose-100 px-3 text-rose-700">
                <X size={15} />
              </button>
            )}
            {slots.length === 1 && value && (
              <button type="button" onClick={() => onChange([])} className="rounded-2xl bg-rose-100 px-3 text-rose-700" title="Remover responsável">
                <X size={15} />
              </button>
            )}
            {openIndex === index && (
              <div className="absolute left-0 top-12 z-40 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                <button type="button" onClick={() => updateSlot(index, "")} className="block w-full rounded-xl px-3 py-2 text-left text-sm font-black text-slate-500 hover:bg-slate-50">
                  Sem responsável
                </button>
                {profiles.map((profile) => (
                  <button key={profile.id} type="button" onClick={() => updateSlot(index, profile.id)} className="block w-full rounded-xl px-3 py-2 text-left text-sm font-black hover:bg-blue-50">
                    {profile.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MultiSelectField({ label, name, values, profiles }: { label: string; name: string; values: string[]; profiles: Profile[] }) {
  const [selected, setSelected] = useState(values.length ? values : [""]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const slots = selected.length ? selected : [""];
  function updateSlot(index: number, value: string) {
    const next = slots.slice();
    next[index] = value;
    setSelected(Array.from(new Set(next.filter(Boolean))));
    setOpenIndex(null);
  }
  return (
    <div className="block text-sm font-bold text-slate-600">
      {label}
      {selected.filter(Boolean).map((value) => <input key={value} type="hidden" name={name} value={value} />)}
      <div className="mt-1 space-y-2 rounded-2xl border border-slate-200 p-3">
        {slots.map((value, index) => (
          <div key={`${value}-${index}`} className="relative flex gap-2">
            <button type="button" onClick={() => setOpenIndex(openIndex === index ? null : index)} className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-left font-black text-slate-700">
              <span className="truncate">{profiles.find((profile) => profile.id === value)?.name ?? "Selecionar responsável"}</span>
              <ChevronDown size={16} className="shrink-0 text-slate-400" />
            </button>
            {index === selected.length - 1 && (
              <button type="button" onClick={() => setSelected([...selected.filter(Boolean), ""])} className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700 motion-smooth hover:bg-blue-100" aria-label="Adicionar responsável" title="Adicionar responsável">
                <Plus size={17} />
              </button>
            )}
            {slots.length > 1 && (
              <button type="button" onClick={() => setSelected(selected.filter((_, slotIndex) => slotIndex !== index).filter(Boolean))} className="rounded-2xl bg-rose-100 px-3 text-rose-700">
                <X size={15} />
              </button>
            )}
            {slots.length === 1 && value && (
              <button type="button" onClick={() => setSelected([])} className="rounded-2xl bg-rose-100 px-3 text-rose-700" title="Remover responsável">
                <X size={15} />
              </button>
            )}
            {openIndex === index && (
              <div className="absolute left-0 top-12 z-40 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                <button type="button" onClick={() => updateSlot(index, "")} className="block w-full rounded-xl px-3 py-2 text-left text-sm font-black text-slate-500 hover:bg-slate-50">
                  Sem responsável
                </button>
                {profiles.map((profile) => (
                  <button key={profile.id} type="button" onClick={() => updateSlot(index, profile.id)} className="block w-full rounded-xl px-3 py-2 text-left text-sm font-black hover:bg-blue-50">
                    {profile.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SubmitButton({ children, full = false, className }: { children: ReactNode; full?: boolean; className?: string }) {
  return <button type="submit" className={`${full ? "w-full" : ""} ${className ?? ""} inline-flex items-center justify-center rounded-2xl bg-blue-700 px-4 py-2 font-black text-white transition hover:bg-slate-950`}>{children}</button>;
}

// ─── Banco de Dúvidas ───────────────────────────────────────────────────────

const STATUS_LABELS: Record<CustomerQuestionStatus, string> = {
  pendente: "Pendente",
  respondido: "Respondido",
  aprovado: "Aprovado",
  descartado: "Descartado"
};

const STATUS_COLORS: Record<CustomerQuestionStatus, string> = {
  pendente: "bg-amber-100 text-amber-700",
  respondido: "bg-blue-100 text-blue-700",
  aprovado: "bg-emerald-100 text-emerald-700",
  descartado: "bg-slate-100 text-slate-500"
};

type YtVideo = {
  videoId: string;
  title: string;
  thumbnail: string;
  commentCount: number;
  publishedAt: string;
};


function YoutubeImportModal({
  existingQuestions,
  onImport,
  onClose,
  currentUser
}: {
  existingQuestions: CustomerQuestion[];
  onImport: (newOnes: CustomerQuestion[]) => Promise<void>;
  onClose: () => void;
  currentUser: Profile;
}) {
  const [phase, setPhase] = useState<"select" | "importing" | "done" | "error">("select");
  const [videos, setVideos] = useState<YtVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [selectedVideoId, setSelectedVideoId] = useState<string>("all");
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; videoTitle: string }>({ current: 0, total: 0, videoTitle: "" });

  useEffect(() => {
    listMyYouTubeChannelVideos()
      .then((channelVideos) => {
        const vids: YtVideo[] = channelVideos.map((v) => ({
          videoId: v.videoId,
          title: v.title,
          thumbnail: v.thumbnail,
          commentCount: v.commentCount,
          publishedAt: v.publishedAt
        }));
        setVideos(vids);
      })
      .catch(() => setVideos([]))
      .finally(() => setLoadingVideos(false));
  }, []);

  async function runImport() {
    setPhase("importing");
    const existingIds = new Set(existingQuestions.map((q) => q.externalId).filter(Boolean));
    const videoTitleMap: Record<string, string> = {};
    for (const v of videos) videoTitleMap[v.videoId] = v.title;

    const targetVideos = selectedVideoId === "all"
      ? videos.filter((v) => v.commentCount > 0).map((v) => v.videoId)
      : [selectedVideoId];

    setImportProgress({ current: 0, total: targetVideos.length, videoTitle: "" });

    const allComments: YouTubeCommentResult[] = [];

    for (let i = 0; i < targetVideos.length; i++) {
      const vid = targetVideos[i];
      const title = videoTitleMap[vid] ?? "";
      setImportProgress({ current: i + 1, total: targetVideos.length, videoTitle: title });
      try {
        const comments = await listYouTubeVideoComments(vid);
        for (const c of comments) allComments.push(c);
      } catch {
        // pula vídeos com erro (comentários desativados, privado, etc.)
      }
    }

    // Deduplica por externalId: filtra contra o estado existente E contra duplicatas no próprio batch
    const seenExtIds = new Set<string>();
    const toAdd: CustomerQuestion[] = [];
    for (const c of allComments) {
      const extId = `yt_comment:${c.id}`;
      if (!existingIds.has(extId) && !seenExtIds.has(extId)) {
        seenExtIds.add(extId);
        toAdd.push({
          id: crypto.randomUUID(),
          organizationId: currentUser.organizationId,
          source: "youtube" as const,
          externalId: extId,
          videoId: c.videoId,
          videoTitle: videoTitleMap[c.videoId] ?? "",
          questionText: c.text,
          answerText: c.channelReply ?? "",
          authorName: c.authorName,
          likes: c.likes,
          status: "pendente" as const,
          category: "",
          learning: "",
          needsReview: false,
          publishedAt: c.publishedAt,
          createdAt: c.publishedAt
        });
      }
    }

    try {
      if (toAdd.length > 0) await onImport(toAdd);
    } catch (insertErr) {
      setErrorMsg(insertErr instanceof Error ? insertErr.message : "Erro ao salvar no banco de dados.");
      setPhase("error");
      return;
    }
    setResult({ imported: toAdd.length, skipped: allComments.length - toAdd.length });
    setPhase("done");
  }

  const filteredVideos = videos.filter((v) =>
    !search || v.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <CenteredModal close={phase !== "importing" ? onClose : undefined} className="bg-black/40" variant="compact" panelClassName="flex flex-col gap-4 rounded-3xl border-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
              <Youtube size={18} className="text-red-600" />
            </div>
            <h2 className="font-black text-lg">Importar do YouTube</h2>
          </div>
          {phase !== "importing" && (
            <button onClick={onClose} className="rounded-xl bg-slate-100 p-1.5 hover:bg-slate-200">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Phase: select */}
        {phase === "select" && (
          <>
            <p className="text-sm text-slate-500">Selecione de qual vídeo importar os comentários. Comentários já importados serão ignorados automaticamente.</p>

            {/* Opção todos */}
            <button
              onClick={() => setSelectedVideoId("all")}
              className={`flex items-center gap-3 rounded-2xl border p-3 text-left text-sm transition hover:border-red-300 ${selectedVideoId === "all" ? "border-red-500 bg-red-50" : "border-slate-200"}`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100">
                <Youtube size={16} className="text-red-600" />
              </div>
              <div>
                <p className="font-black">Todos os vídeos</p>
                <p className="text-xs text-slate-500">Importa comentários de {videos.length} vídeo{videos.length !== 1 ? "s" : ""} — pode demorar</p>
              </div>
              {selectedVideoId === "all" && <div className="ml-auto h-4 w-4 rounded-full bg-red-500" />}
            </button>

            {/* Busca */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar vídeo..."
              lang="pt-BR" spellCheck autoCorrect="on"
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-red-400"
            />

            {/* Lista de vídeos */}
            <div className="max-h-60 overflow-auto flex flex-col gap-2">
              {loadingVideos ? (
                <p className="py-4 text-center text-sm text-slate-400">Carregando vídeos...</p>
              ) : filteredVideos.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">Nenhum vídeo encontrado</p>
              ) : (
                filteredVideos.map((v) => (
                  <button
                    key={v.videoId}
                    onClick={() => setSelectedVideoId(v.videoId)}
                    className={`flex items-center gap-3 rounded-2xl border p-2 text-left text-sm transition hover:border-red-300 ${selectedVideoId === v.videoId ? "border-red-500 bg-red-50" : "border-slate-100"}`}
                  >
                    {v.thumbnail ? (
                      <img src={v.thumbnail} alt="" className="h-10 w-16 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                        <Youtube size={16} className="text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 font-bold text-slate-800">{v.title}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{v.publishedAt}</span>
                        <span className="rounded-xl bg-red-100 px-1.5 py-0.5 font-bold text-red-700">{v.commentCount} comentários</span>
                      </div>
                    </div>
                    {selectedVideoId === v.videoId && <div className="ml-auto h-4 w-4 shrink-0 rounded-full bg-red-500" />}
                  </button>
                ))
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 rounded-2xl bg-slate-100 py-2 text-sm font-black text-slate-600 hover:bg-slate-200">Cancelar</button>
              <button
                onClick={runImport}
                disabled={loadingVideos}
                className="flex-1 rounded-2xl bg-red-600 py-2 text-sm font-black text-white hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400"
              >
                Importar comentários
              </button>
            </div>
          </>
        )}

        {/* Phase: importing */}
        {phase === "importing" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />
            <p className="font-bold text-slate-700">Importando comentários...</p>
            {importProgress.total > 1 ? (
              <div className="w-full text-center">
                <p className="text-sm text-slate-500">
                  Vídeo {importProgress.current} de {importProgress.total}
                </p>
                <p className="mt-1 line-clamp-1 text-xs text-slate-400">{importProgress.videoTitle}</p>
                <div className="mx-auto mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-red-500 transition-all"
                    style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Isso pode levar alguns segundos</p>
            )}
          </div>
        )}

        {/* Phase: done */}
        {phase === "done" && result && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 size={28} className="text-emerald-600" />
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-slate-900">{result.imported} novos comentários</p>
              <p className="text-sm text-slate-500 mt-1">{result.skipped} já existiam no banco</p>
            </div>
            <button onClick={onClose} className="w-full rounded-2xl bg-emerald-600 py-2 font-black text-white hover:bg-emerald-700">Fechar</button>
          </div>
        )}

        {/* Phase: error */}
        {phase === "error" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100">
              <X size={28} className="text-rose-600" />
            </div>
            <p className="text-center text-sm font-bold text-slate-700">{errorMsg || "Erro ao importar comentários"}</p>
            <div className="flex w-full gap-2">
              <button onClick={() => setPhase("select")} className="flex-1 rounded-2xl bg-slate-100 py-2 text-sm font-black text-slate-600 hover:bg-slate-200">Tentar novamente</button>
              <button onClick={onClose} className="flex-1 rounded-2xl bg-rose-600 py-2 text-sm font-black text-white hover:bg-rose-700">Fechar</button>
            </div>
          </div>
        )}
    </CenteredModal>
  );
}

function BancoDeDuvidas({
  questions,
  setQuestions,
  currentUser,
}: {
  questions: CustomerQuestion[];
  setQuestions: (next: CustomerQuestion[]) => void;
  currentUser: Profile;
}) {
  const [tab, setTab] = useState<"chat" | "base">("chat");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // ── Base state ──
  const [filterStatus, setFilterStatus] = useState<CustomerQuestionStatus | "todas">("todas");
  const [filterSource, setFilterSource] = useState<CustomerQuestionSource | "todas">("todas");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CustomerQuestion | null>(null);
  const [answerDraft, setAnswerDraft] = useState("");
  const [learningDraft, setLearningDraft] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newText, setNewText] = useState("");

  // ── Chat state ──
  const [chatSession, setChatSession] = useState<KnowledgeChatSession | null>(null);
  const [chatMessages, setChatMessages] = useState<KnowledgeChatMessage[]>([]);
  const [activeGap, setActiveGap] = useState<KnowledgeGap | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatBootLoading, setChatBootLoading] = useState(false);
  const [unknownInput, setUnknownInput] = useState("");
  const [savingUnknown, setSavingUnknown] = useState(false);

  const filteredBase = questions.filter((q) => {
    if (filterStatus !== "todas" && q.status !== filterStatus) return false;
    if (filterSource !== "todas" && q.source !== filterSource) return false;
    if (search && !q.questionText.toLowerCase().includes(search.toLowerCase()) && !q.authorName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    pendente: questions.filter((q) => q.status === "pendente").length,
    respondido: questions.filter((q) => q.status === "respondido").length,
    aprovado: questions.filter((q) => q.status === "aprovado").length,
    descartado: questions.filter((q) => q.status === "descartado").length,
  };

  const needsReviewCount = questions.filter((q) => q.needsReview && !q.reviewedAt).length;

  function localChatMessage(role: KnowledgeChatMessage["role"], content: string, unknown = false): KnowledgeChatMessage {
    return {
      id: crypto.randomUUID(),
      sessionId: chatSession?.id ?? "local",
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      role,
      content,
      unknown,
      createdAt: new Date().toISOString()
    };
  }

  async function chatAuthHeaders(contentType = false) {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sessão expirada. Entre novamente.");
    return {
      Authorization: `Bearer ${token}`,
      ...(contentType ? { "Content-Type": "application/json" } : {})
    };
  }

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    async function loadTodayChat() {
      setChatBootLoading(true);
      try {
        const res = await fetch("/api/knowledge-chat/today", { headers: await chatAuthHeaders() });
        const data = await res.json() as {
          session?: KnowledgeChatSession;
          messages?: KnowledgeChatMessage[];
          activeGap?: KnowledgeGap | null;
          error?: string;
        };
        if (data.error) throw new Error(data.error);
        if (!cancelled) {
          setChatSession(data.session ?? null);
          setChatMessages(data.messages ?? []);
          setActiveGap(data.activeGap ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          setChatMessages([localChatMessage("error", error instanceof Error ? error.message : "Erro ao carregar chat.")]);
        }
      } finally {
        if (!cancelled) setChatBootLoading(false);
      }
    }
    void loadTodayChat();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id]);

  function openQuestion(q: CustomerQuestion) {
    setSelected(q);
    setDeleteConfirm(false);
    setAnswerDraft(q.answerText);
    setLearningDraft(q.learning);
  }

  function saveAnswer(status: CustomerQuestionStatus) {
    if (!selected) return;
    const now = new Date().toISOString();
    const updated: CustomerQuestion = {
      ...selected,
      answerText: answerDraft,
      learning: learningDraft,
      status,
      reviewerId: currentUser.id,
      answeredAt: status === "pendente" ? undefined : (selected.answeredAt ?? now),
    };
    setQuestions(questions.map((q) => q.id === updated.id ? updated : q));
    setSelected(updated);
  }

  function markReviewed() {
    if (!selected) return;
    const now = new Date().toISOString();
    const updated: CustomerQuestion = {
      ...selected,
      needsReview: false,
      reviewedAt: now,
      reviewedBy: currentUser.id,
    };
    setQuestions(questions.map((q) => q.id === updated.id ? updated : q));
    setSelected(updated);
  }

  async function deleteQuestion() {
    if (!selected) return;
    setQuestions(questions.filter((q) => q.id !== selected.id));
    setSelected(null);
    setDeleteConfirm(false);
    if (supabase) await deleteCustomerQuestion(supabase, selected.id).catch(() => {});
  }

  async function handleChatSend() {
    const q = chatInput.trim();
    if (!q || chatLoading) return;
    setChatInput("");
    setChatMessages((prev) => [...prev, localChatMessage("user", q)]);
    setChatLoading(true);
    setUnknownInput("");
    setActiveGap(null);
    try {
      if (supabase) {
        const res = await fetch("/api/knowledge-chat/send", {
          method: "POST",
          headers: await chatAuthHeaders(true),
          body: JSON.stringify({ question: q })
        });
        const data = await res.json() as {
          session?: KnowledgeChatSession;
          messages?: KnowledgeChatMessage[];
          activeGap?: KnowledgeGap | null;
          error?: string;
        };
        if (data.error) throw new Error(data.error);
        setChatSession(data.session ?? chatSession);
        setChatMessages(data.messages ?? []);
        setActiveGap(data.activeGap ?? null);
        return;
      }

      const bank = questions
        .filter((item) => item.status === "aprovado" && item.answerText?.trim())
        .map((item) => ({ id: item.id, questionText: item.questionText, answerText: item.answerText }));
      const res = await fetch("/api/gemini-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, bank }),
      });
      const data = await res.json() as { answer: string | null; unknown: boolean; error?: string };
      if (data.error) throw new Error(data.error);
      if (!data.unknown && data.answer) {
        setChatMessages((prev) => [...prev, localChatMessage("ai", data.answer!)]);
      } else {
        setActiveGap({
          id: "local-gap",
          organizationId: currentUser.organizationId,
          sessionId: chatSession?.id ?? "local",
          userId: currentUser.id,
          questionText: q,
          status: "aguardando_resposta",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        setChatMessages((prev) => [
          ...prev,
          localChatMessage("ai", "Ainda não sei responder isso com segurança pelo Banco de Dúvidas.", true),
        ]);
      }
    } catch (error) {
      setChatMessages((prev) => [...prev, localChatMessage("error", error instanceof Error ? error.message : "Erro ao consultar a IA. Tente novamente.")]);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleSaveUnknown() {
    const lastUserMsg = activeGap?.questionText
      ? { content: activeGap.questionText }
      : [...chatMessages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg || !unknownInput.trim()) return;
    setSavingUnknown(true);
    if (supabase && activeGap && activeGap.id !== "local-gap") {
      try {
        const res = await fetch("/api/knowledge-chat/gap-answer", {
          method: "POST",
          headers: await chatAuthHeaders(true),
          body: JSON.stringify({ gapId: activeGap.id, answer: unknownInput.trim() })
        });
        const data = await res.json() as {
          question?: CustomerQuestion;
          messages?: KnowledgeChatMessage[];
          activeGap?: KnowledgeGap | null;
          error?: string;
        };
        if (data.error) throw new Error(data.error);
        if (data.question && !questions.some((item) => item.id === data.question!.id)) {
          setQuestions([data.question, ...questions]);
        }
        setChatMessages(data.messages ?? chatMessages);
        setActiveGap(data.activeGap ?? null);
        setUnknownInput("");
      } catch (error) {
        setChatMessages((prev) => [...prev, localChatMessage("error", error instanceof Error ? error.message : "Erro ao salvar resposta.")]);
      } finally {
        setSavingUnknown(false);
      }
      return;
    }

    const newQ: CustomerQuestion = {
      id: crypto.randomUUID(),
      organizationId: currentUser.organizationId,
      source: "manual",
      questionText: lastUserMsg.content,
      answerText: unknownInput.trim(),
      authorName: currentUser.name,
      likes: 0,
      status: "aprovado",
      category: "",
      learning: "",
      needsReview: true,
      createdAt: new Date().toISOString(),
    };
    setQuestions([newQ, ...questions]);
    if (supabase) {
      await saveCustomerQuestion(supabase, newQ).catch(() => {});
    }
    setChatMessages((prev) => [
      ...prev,
      localChatMessage("system", "Resposta salva no banco! Ela será usada nas próximas consultas."),
    ]);
    setActiveGap(null);
    setUnknownInput("");
    setSavingUnknown(false);
  }

  async function handleIgnoreGap() {
    if (supabase && activeGap && activeGap.id !== "local-gap") {
      const { error } = await supabase
        .from("knowledge_gaps")
        .update({ status: "ignorado", updated_at: new Date().toISOString() })
        .eq("id", activeGap.id);
      if (error) console.error("[knowledge-chat] ignore gap", error);
    }
    setActiveGap(null);
  }

  const lastMsgUnknown = Boolean(activeGap && activeGap.status === "aguardando_resposta");

  function addManual(e: FormEvent) {
    e.preventDefault();
    if (!newText.trim()) return;
    const newQ: CustomerQuestion = {
      id: crypto.randomUUID(),
      organizationId: currentUser.organizationId,
      source: "manual",
      questionText: newText.trim(),
      answerText: "",
      authorName: "",
      likes: 0,
      status: "pendente",
      category: "",
      learning: "",
      needsReview: false,
      createdAt: new Date().toISOString(),
    };
    setQuestions([newQ, ...questions]);
    setNewText("");
    setShowNewForm(false);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HelpCircle size={28} className="text-blue-700" />
          <div>
            <h1 className="text-2xl font-black">Banco de Duvidas</h1>
            <p className="text-sm text-slate-500">Base de conhecimento dos clientes</p>
          </div>
          <Badge tone="slate">{questions.length}</Badge>
          {needsReviewCount > 0 && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-black text-orange-700">
              {needsReviewCount} para revisar
            </span>
          )}
        </div>
        {tab === "base" && (
          <button
            onClick={() => setShowNewForm((v) => !v)}
            className="flex items-center gap-2 rounded-2xl bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-slate-950"
          >
            <Plus size={16} /> Nova pergunta
          </button>
        )}
      </div>

      {/* Abas */}
      <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1 self-start">
        <button
          onClick={() => setTab("chat")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition ${tab === "chat" ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}
        >
          <MessageSquare size={14} /> Chat
        </button>
        <button
          onClick={() => setTab("base")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition ${tab === "base" ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}
        >
          <HelpCircle size={14} /> Banco
          {needsReviewCount > 0 && (
            <span className="ml-1 rounded-full bg-orange-500 px-1.5 py-0.5 text-xs text-white">{needsReviewCount}</span>
          )}
        </button>
      </div>

      {/* ── ABA CHAT ── */}
      {tab === "chat" && (
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-1 flex-col gap-3 overflow-auto rounded-3xl border border-slate-200 bg-white p-4 min-h-[300px]">
            {chatMessages.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-400">
                <MessageSquare size={36} />
                <p className="text-sm font-bold">{chatBootLoading ? "Carregando chat do dia..." : "Pergunte algo sobre produtos da Embrepoli"}</p>
                <p className="text-xs">A IA vai buscar a resposta no banco de dúvidas aprovadas</p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === "user" ? "bg-blue-700 text-white" : msg.role === "error" ? "border border-rose-200 bg-rose-50 text-rose-700" : msg.unknown ? "border border-orange-200 bg-orange-50 text-orange-800" : msg.role === "system" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-800"}`}>
                  {msg.content}
                  {msg.role === "ai" && msg.confidence !== undefined && !msg.unknown && (
                    <p className="mt-1 text-[11px] font-bold opacity-60">Confiança: {Math.round(msg.confidence * 100)}%</p>
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-500">Consultando banco...</div>
              </div>
            )}
          </div>

          {lastMsgUnknown && !chatLoading && (
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3">
              <p className="mb-2 text-xs font-black text-orange-700">Voce sabe a resposta? Salve para o banco:</p>
              <textarea
                value={unknownInput}
                onChange={(e) => setUnknownInput(e.target.value)}
                placeholder="Digite a resposta correta..."
                lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences"
                rows={2}
                className="w-full resize-none rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleSaveUnknown}
                  disabled={!unknownInput.trim() || savingUnknown}
                  className="rounded-xl bg-orange-600 px-4 py-1.5 text-xs font-black text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {savingUnknown ? "Salvando..." : "Salvar no banco"}
                </button>
                <button
                  onClick={handleIgnoreGap}
                  className="rounded-xl bg-slate-100 px-4 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-200"
                >
                  Ignorar
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChatSend()}
              placeholder="Digite sua duvida..."
              lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences"
              disabled={chatLoading}
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50"
            />
            <button
              onClick={handleChatSend}
              disabled={!chatInput.trim() || chatLoading}
              className="flex items-center gap-2 rounded-2xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50"
            >
              <Send size={14} /> Enviar
            </button>
          </div>
        </div>
      )}

      {/* ── ABA BASE ── */}
      {tab === "base" && (
        <div className="flex flex-1 flex-col gap-4">
          {/* Cards de stats */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(["pendente", "respondido", "aprovado", "descartado"] as CustomerQuestionStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(filterStatus === s ? "todas" : s)}
                className={`rounded-2xl border p-4 text-left transition hover:border-blue-300 ${filterStatus === s ? "border-blue-500 bg-blue-50" : "border-slate-100 bg-white"}`}
              >
                <p className={`text-2xl font-black ${filterStatus === s ? "text-blue-700" : "text-slate-900"}`}>{counts[s]}</p>
                <p className="text-sm font-bold text-slate-500">{STATUS_LABELS[s]}</p>
              </button>
            ))}
          </div>

          {showNewForm && (
            <form onSubmit={addManual} className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="mb-2 text-sm font-black text-blue-700">Nova pergunta manual</p>
              <textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Digite a pergunta ou comentario do cliente..."
                lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences"
                rows={3}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-blue-500"
              />
              <div className="mt-2 flex gap-2">
                <button type="submit" disabled={!newText.trim()} className="rounded-2xl bg-blue-700 px-4 py-2 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-400">Adicionar</button>
                <button type="button" onClick={() => setShowNewForm(false)} className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">Cancelar</button>
              </div>
            </form>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pergunta ou autor..."
              lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences"
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as CustomerQuestionStatus | "todas")}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
            >
              <option value="todas">Todos os status</option>
              {(["pendente", "respondido", "aprovado", "descartado"] as CustomerQuestionStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value as CustomerQuestionSource | "todas")}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
            >
              <option value="todas">Todas as fontes</option>
              <option value="youtube">YouTube</option>
              <option value="manual">Manual</option>
            </select>
          </div>

          <div className="flex min-h-0 flex-1 gap-4">
            <div className={`flex flex-col gap-2 overflow-auto ${selected ? "w-1/2" : "w-full"}`}>
              {filteredBase.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-200 py-16 text-slate-400">
                  <HelpCircle size={40} />
                  <p className="font-bold">Nenhuma pergunta encontrada</p>
                  <p className="text-sm">Importe comentarios em Comentarios ou adicione manualmente</p>
                </div>
              ) : (
                filteredBase.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => openQuestion(q)}
                    className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition hover:border-blue-300 ${selected?.id === q.id ? "border-blue-500 bg-blue-50" : "border-slate-100 bg-white"}`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {q.source === "youtube" ? (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100"><Youtube size={14} className="text-red-600" /></div>
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100"><MessageSquare size={14} className="text-slate-500" /></div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-bold text-slate-800">{q.questionText}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {q.authorName && <span>{q.authorName}</span>}
                        {q.videoTitle && <span className="truncate max-w-[160px]">📹 {q.videoTitle}</span>}
                        <span>{q.createdAt.slice(0, 10)}</span>
                        {q.likes > 0 && <span>👍 {q.likes}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded-xl px-2 py-1 text-xs font-black ${STATUS_COLORS[q.status]}`}>{STATUS_LABELS[q.status]}</span>
                      {q.needsReview && !q.reviewedAt && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-black text-orange-700">Revisar IA</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>

            {selected && (
              <div className="flex w-1/2 shrink-0 flex-col gap-4 overflow-auto rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {selected.source === "youtube" ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100"><Youtube size={16} className="text-red-600" /></div>
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100"><MessageSquare size={16} className="text-slate-500" /></div>
                    )}
                    <span className={`rounded-xl px-2 py-1 text-xs font-black ${STATUS_COLORS[selected.status]}`}>{STATUS_LABELS[selected.status]}</span>
                    {selected.needsReview && !selected.reviewedAt && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-black text-orange-700">Revisar IA</span>
                    )}
                  </div>
                  <button onClick={() => setSelected(null)} className="rounded-xl bg-slate-100 p-1 hover:bg-slate-200"><X size={16} /></button>
                </div>

                <div className="space-y-1 rounded-2xl bg-slate-50 p-3 text-sm">
                  {selected.authorName && <p><span className="font-black text-slate-500">Autor:</span> {selected.authorName}</p>}
                  {selected.videoTitle && <p><span className="font-black text-slate-500">Video:</span> {selected.videoTitle}</p>}
                  <p><span className="font-black text-slate-500">Data:</span> {selected.createdAt.slice(0, 10)}</p>
                  {selected.likes > 0 && <p><span className="font-black text-slate-500">Curtidas:</span> {selected.likes}</p>}
                  {selected.aiConfidence !== undefined && (
                    <p><span className="font-black text-slate-500">Confianca IA:</span> {Math.round(selected.aiConfidence * 100)}%{selected.aiReason ? ` — ${selected.aiReason}` : ""}</p>
                  )}
                  {selected.reviewedAt && (
                    <p className="text-emerald-600"><span className="font-black">Revisado em:</span> {selected.reviewedAt.slice(0, 10)}</p>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-xs font-black uppercase tracking-wider text-slate-400">Pergunta</p>
                  <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-800">{selected.questionText}</p>
                </div>

                <div>
                  <p className="mb-1 text-xs font-black uppercase tracking-wider text-slate-400">Resposta</p>
                  <textarea
                    value={answerDraft}
                    onChange={(e) => setAnswerDraft(e.target.value)}
                    placeholder="Digite a resposta para esta pergunta..."
                    lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences"
                    rows={4}
                    className="w-full resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <p className="mb-1 text-xs font-black uppercase tracking-wider text-slate-400">Aprendizado interno</p>
                  <textarea
                    value={learningDraft}
                    onChange={(e) => setLearningDraft(e.target.value)}
                    placeholder="Algum insight ou aprendizado para a equipe?"
                    lang="pt-BR" spellCheck autoCorrect="on" autoCapitalize="sentences"
                    rows={2}
                    className="w-full resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button onClick={() => saveAnswer("respondido")} className="flex-1 rounded-2xl bg-blue-700 px-3 py-2 text-sm font-black text-white hover:bg-blue-800">Salvar resposta</button>
                  <button onClick={() => saveAnswer("aprovado")} className="flex-1 rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-black text-white hover:bg-emerald-700">Aprovar</button>
                  {selected.needsReview && !selected.reviewedAt && (
                    <button onClick={markReviewed} className="rounded-2xl bg-orange-100 px-3 py-2 text-sm font-black text-orange-700 hover:bg-orange-200">Marcar revisado</button>
                  )}
                  {deleteConfirm ? (
                    <div className="flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm w-full">
                      <span className="flex-1 font-semibold text-rose-700 text-xs">Excluir permanentemente?</span>
                      <button onClick={() => setDeleteConfirm(false)} className="rounded-xl bg-white border border-slate-200 px-2 py-1 text-xs font-black text-slate-600 hover:bg-slate-50">Cancelar</button>
                      <button onClick={deleteQuestion} className="rounded-xl bg-rose-600 px-2 py-1 text-xs font-black text-white hover:bg-rose-700">Confirmar</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(true)} className="rounded-2xl bg-rose-100 px-3 py-2 text-sm font-black text-rose-700 hover:bg-rose-200">Excluir</button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ComentariosSection ───────────────────────────────────────────────────────

function ComentariosSection({
  comments,
  setComments,
  autoFilters,
  setAutoFilters,
  questions,
  setQuestions,
  currentUser,
}: {
  comments: Comment[];
  setComments: (next: Comment[]) => void;
  autoFilters: AutoFilter[];
  setAutoFilters: (next: AutoFilter[]) => void;
  questions: CustomerQuestion[];
  setQuestions: (next: CustomerQuestion[]) => void;
  currentUser: Profile;
}) {
  const [statusFilter, setStatusFilter] = useState<CommentStatus | "todos">("novo");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newMatchType, setNewMatchType] = useState<"contains" | "startsWith" | "exact">("contains");
  const [importModal, setImportModal] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [pressedBtn, setPressedBtn] = useState<Record<string, boolean>>({});

  function pressButton(key: string) {
    setPressedBtn((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => setPressedBtn((prev) => { const n = { ...prev }; delete n[key]; return n; }), 600);
  }

  const filtered = comments.filter((c) => {
    if (statusFilter !== "todos" && c.status !== statusFilter) return false;
    if (search && !c.text.toLowerCase().includes(search.toLowerCase()) && !c.authorName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function matchesFilter(text: string, filter: AutoFilter): boolean {
    const t = text.toLowerCase();
    const k = filter.keyword.toLowerCase();
    if (filter.matchType === "startsWith") return t.startsWith(k);
    if (filter.matchType === "exact") return t === k;
    return t.includes(k);
  }

  async function handleImport(items: YouTubeCommentItem[], updatedItems: YouTubeCommentItem[] = []) {
    // ── ATUALIZAÇÕES: comentários existentes com nova resposta ──
    if (updatedItems.length > 0) {
      const updatedComments = comments.map((c) => {
        const upd = updatedItems.find(
          (u) => u.commentId === c.externalId || u.commentId === c.externalId?.replace("yt_comment:", "")
        );
        if (!upd?.channelReply) return c;
        return { ...c, response: upd.channelReply, status: "respondido" as CommentStatus };
      });
      setComments(updatedComments);
      if (supabase) {
        for (const c of updatedComments) {
          const wasUpdated = updatedItems.some(
            (u) => u.commentId === c.externalId || u.commentId === c.externalId?.replace("yt_comment:", "")
          );
          if (wasUpdated) await saveComment(supabase, c).catch(() => {});
        }
      }
    }

    // ── NOVOS: lógica completa (filtros, IA, CustomerQuestions) ──
    const activeFilters = autoFilters.filter((f) => f.active);

    // Ids já existentes no banco (para idempotência)
    const existingExternalIds = new Set(questions.map((q) => q.externalId).filter(Boolean));

    // Map de channelReply por commentId (para uso nos CustomerQuestions)
    const channelReplyByCommentId = new Map<string, string>(
      items.filter((i) => i.channelReply).map((i) => [i.commentId, i.channelReply!])
    );

    const existingCommentByKey = new Map(comments.map((comment) => [commentStableKey(comment), comment]));
    const importStartedAt = new Date().toISOString();

    const newComments: Comment[] = items.map((item) => {
      const autoAdded = activeFilters.some((f) => matchesFilter(item.text, f));
      const incoming: Comment = {
        id: crypto.randomUUID(),
        source: "youtube" as const,
        externalId: item.commentId,
        importSignature: commentImportSignature({
          source: "youtube",
          videoId: item.videoId,
          authorName: item.authorName,
          text: item.text,
          publishedAt: item.publishedAt
        }),
        videoId: item.videoId,
        videoTitle: item.videoTitle,
        authorName: item.authorName,
        text: item.text,
        likes: item.likes,
        status: (item.channelReply ? "respondido" : "novo") as CommentStatus,
        response: item.channelReply,
        addedToBank: autoAdded,
        publishedAt: item.publishedAt,
        retentionUntil: addDaysIso(importStartedAt, 90),
        processedAt: autoAdded ? importStartedAt : undefined,
        isRelevant: autoAdded,
        classificationStatus: autoAdded ? "relevante" : "pendente",
        classificationReason: autoAdded ? "filtro automático" : undefined,
        createdAt: importStartedAt,
      };
      return mergeImportedComment(existingCommentByKey.get(commentStableKey(incoming)), incoming);
    });

    // Classificação híbrida: regras locais primeiro, Gemini só para os casos incertos
    const classifyMap = new Map<string, { confidence: number; reason: string }>();

    // 1ª passagem — classificação local (sem custo, instantânea)
    const uncertainForAi: typeof newComments = [];
    for (const c of newComments) {
      if (c.classificationStatus && c.classificationStatus !== "pendente") continue; // já classificado antes → não reclassificar
      if (c.addedToBank) {
        c.isRelevant = true;
        c.classificationStatus = "relevante";
        c.classificationReason = c.classificationReason ?? "filtro automático";
        continue;
      }
      const local = classifyLocal(c.text);
      if (local === "duvida") {
        c.addedToBank = true;
        c.isRelevant = true;
        c.processedAt = importStartedAt;
        c.classificationStatus = "relevante";
        c.classificationReason = "regra local: pergunta identificada";
        classifyMap.set(c.id, { confidence: 1, reason: c.classificationReason });
      } else if (local === "normal") {
        c.isRelevant = false;
        c.processedAt = importStartedAt;
        c.classificationStatus = "normal";
        c.classificationReason = "regra local: comentário normal";
        classifyMap.set(c.id, { confidence: 1, reason: c.classificationReason });
      } else {
        uncertainForAi.push(c); // incerto → vai para Gemini
      }
    }

    // 2ª passagem — Gemini só para os casos incertos
    if (uncertainForAi.length > 0) {
      try {
        const res = await fetch("/api/gemini-classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comments: uncertainForAi.map((c) => ({ id: c.id, text: c.text })) }),
        });
        if (res.ok) {
          const { results } = await res.json() as {
            results: Array<{ id: string; tipo: "duvida_relevante" | "normal"; confidence: number; reason: string }>;
          };
          for (const r of results) {
            const c = uncertainForAi.find((nc) => nc.id === r.id);
            if (r.tipo === "duvida_relevante") {
              if (c) {
                c.addedToBank = true;
                c.isRelevant = true;
                c.classificationStatus = "relevante";
              }
            } else if (c) {
              c.isRelevant = false;
              c.classificationStatus = "normal";
            }
            if (c) {
              c.processedAt = importStartedAt;
              c.classificationReason = r.reason;
            }
            classifyMap.set(r.id, { confidence: r.confidence, reason: r.reason });
          }
        }
      } catch {
        for (const c of uncertainForAi) {
          c.classificationStatus = "erro";
          c.classificationReason = "Gemini falhou durante a classificação";
        }
      }
    }

    // Pré-gerar IDs das perguntas para linkar de volta nos comentários
    const bankItems = newComments.filter((c) => {
      if (!c.addedToBank || c.bankQuestionId) return false;
      if (c.externalId && existingExternalIds.has(c.externalId)) return false;
      return !questions.some((q) => q.sourceCommentId === c.id || q.fromCommentId === c.id);
    });
    const questionIdByCommentId = new Map<string, string>(
      bankItems.map((c) => [c.id, crypto.randomUUID()])
    );

    // Atribuir bankQuestionId nos comentários antes de salvar
    for (const c of newComments) {
      const qId = questionIdByCommentId.get(c.id);
      if (qId) c.bankQuestionId = qId;
    }

    const importedKeys = new Set(newComments.map(commentStableKey));
    const merged = [...newComments, ...comments.filter((comment) => !importedKeys.has(commentStableKey(comment)))];
    setComments(merged);
    if (supabase) {
      await insertComments(supabase, newComments).catch(() => {});
    }

    // Criar e persistir CustomerQuestions para os itens relevantes (sem duplicatas)
    if (bankItems.length > 0) {
      const newQuestions: CustomerQuestion[] = bankItems.map((c) => {
        const ai = classifyMap.get(c.id);
        return {
          id: questionIdByCommentId.get(c.id)!,
          organizationId: currentUser.organizationId ?? "",
          source: "youtube" as const,
          externalId: c.externalId,
          videoId: c.videoId,
          videoTitle: c.videoTitle,
          questionText: c.text,
          answerText: channelReplyByCommentId.get(c.externalId ?? "") ?? "",
          authorName: c.authorName,
          likes: c.likes,
          status: "aprovado" as CustomerQuestionStatus,
          category: "",
          learning: "",
          needsReview: true,
          sourceCommentId: c.id,
          fromCommentId: c.id,
          aiConfidence: ai?.confidence,
          aiReason: ai?.reason,
          publishedAt: c.publishedAt,
          createdAt: new Date().toISOString(),
        };
      });
      setQuestions([...newQuestions, ...questions]);
      if (supabase) {
        await insertCustomerQuestions(supabase, newQuestions).catch(() => {});
      }
    }

    setImportModal(false);
  }

  async function handleStatusChange(comment: Comment, status: CommentStatus) {
    const updated = comments.map((c) => c.id === comment.id ? { ...c, status } : c);
    setComments(updated);
    if (supabase) {
      await saveComment(supabase, { ...comment, status }).catch(() => {});
    }
  }

  async function handleAddToBank(comment: Comment) {
    // Idempotência: não criar duplicata se já existe no banco
    const alreadyInBank = questions.some(
      (q) => q.externalId === comment.externalId || q.sourceCommentId === comment.id || q.fromCommentId === comment.id
    );
    if (alreadyInBank) return;

    const questionId = crypto.randomUUID();
    const updatedComment = { ...comment, addedToBank: true, bankQuestionId: questionId };
    setComments(comments.map((c) => c.id === comment.id ? updatedComment : c));
    if (supabase) {
      await saveComment(supabase, updatedComment).catch(() => {});
    }

    const newQ: CustomerQuestion = {
      id: questionId,
      organizationId: currentUser.organizationId ?? "",
      source: "youtube" as const,
      externalId: comment.externalId,
      videoId: comment.videoId,
      videoTitle: comment.videoTitle,
      questionText: comment.text,
      answerText: responses[comment.id] ?? comment.response ?? "",
      authorName: comment.authorName,
      likes: comment.likes,
      status: "aprovado" as CustomerQuestionStatus,
      category: "",
      learning: "",
      needsReview: true,
      sourceCommentId: comment.id,
      fromCommentId: comment.id,
      publishedAt: comment.publishedAt,
      createdAt: new Date().toISOString(),
    };
    setQuestions([newQ, ...questions]);
    if (supabase) {
      await saveCustomerQuestion(supabase, newQ).catch(() => {});
    }
  }

  async function handleSaveResponse(comment: Comment) {
    const response = responses[comment.id] ?? "";
    const updated = comments.map((c) => c.id === comment.id ? { ...c, response, status: "respondido" as CommentStatus } : c);
    setComments(updated);
    setSaving(comment.id);
    if (supabase) {
      await saveComment(supabase, { ...comment, response, status: "respondido" }).catch(() => {});
    }
    setSaving(null);
  }

  async function handleAddFilter() {
    if (!newKeyword.trim()) return;
    const filter: AutoFilter = {
      id: crypto.randomUUID(),
      keyword: newKeyword.trim(),
      matchType: newMatchType,
      active: true,
      createdAt: new Date().toISOString(),
    };
    const next = [...autoFilters, filter];
    setAutoFilters(next);
    setNewKeyword("");
    if (supabase) {
      await saveAutoFilter(supabase, filter).catch(() => {});
    }
  }

  async function handleToggleFilter(filter: AutoFilter) {
    const next = autoFilters.map((f) => f.id === filter.id ? { ...f, active: !f.active } : f);
    setAutoFilters(next);
    if (supabase) {
      await saveAutoFilter(supabase, { ...filter, active: !filter.active }).catch(() => {});
    }
  }

  async function handleDeleteFilter(filter: AutoFilter) {
    const next = autoFilters.filter((f) => f.id !== filter.id);
    setAutoFilters(next);
    if (supabase) {
      await deleteAutoFilter(supabase, filter.id).catch(() => {});
    }
  }

  const statusLabels: Record<CommentStatus | "todos", string> = {
    todos: "Todos",
    novo: "Novos",
    respondido: "Respondidos",
    ignorado: "Ignorados",
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-black text-slate-900">Comentários</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <Settings size={14} /> Filtros automáticos
          </button>
          <button
            onClick={() => setImportModal(true)}
            className="flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
          >
            <Youtube size={14} /> Importar YouTube
          </button>
        </div>
      </div>

      {/* Auto-filter panel */}
      {showFilters && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-black text-slate-700">Filtros automáticos por palavra-chave</h3>
          <div className="mb-3 flex gap-2">
            <input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="Palavra-chave..."
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleAddFilter()}
            />
            <select
              value={newMatchType}
              onChange={(e) => setNewMatchType(e.target.value as "contains" | "startsWith" | "exact")}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="contains">Contém</option>
              <option value="startsWith">Começa com</option>
              <option value="exact">Exato</option>
            </select>
            <button
              onClick={handleAddFilter}
              className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
            >
              Adicionar
            </button>
          </div>
          {autoFilters.length === 0 && (
            <p className="text-sm text-slate-400">Nenhum filtro cadastrado.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {autoFilters.map((f) => (
              <div key={f.id} className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${f.active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
                <span>{f.keyword}</span>
                <span className="opacity-60">({f.matchType === "contains" ? "contém" : f.matchType === "startsWith" ? "começa" : "exato"})</span>
                <button onClick={() => handleToggleFilter(f)} className="hover:opacity-70">{f.active ? "●" : "○"}</button>
                <button onClick={() => handleDeleteFilter(f)} className="hover:opacity-70"><X size={10} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status filter + search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1">
          {(["todos", "novo", "respondido", "ignorado"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-xl px-3 py-1 text-xs font-bold ${statusFilter === s ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {statusLabels[s]}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar comentários..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <span className="text-xs text-slate-400">{filtered.length} comentário{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Comment list */}
      {filtered.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <MessageSquare size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-400">Nenhum comentário encontrado.</p>
          <p className="mt-1 text-xs text-slate-300">Importe comentários do YouTube para começar.</p>
        </div>
      )}
      <div className="flex flex-col gap-3">
        {filtered.map((comment) => (
          <div key={comment.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <span className="text-sm font-black text-slate-800">{comment.authorName}</span>
                {comment.videoTitle && <span className="ml-2 text-xs text-slate-400">· {comment.videoTitle}</span>}
                {comment.likes > 0 && <span className="ml-2 text-xs text-slate-400">· {comment.likes} ❤</span>}
              </div>
              <div className="flex items-center gap-2">
                {comment.addedToBank && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">No banco</span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  comment.status === "novo" ? "bg-blue-100 text-blue-700" :
                  comment.status === "respondido" ? "bg-emerald-100 text-emerald-700" :
                  "bg-slate-100 text-slate-500"
                }`}>
                  {comment.status === "novo" ? "Novo" : comment.status === "respondido" ? "Respondido" : "Ignorado"}
                </span>
              </div>
            </div>
            <p className="mb-3 text-sm text-slate-700">{comment.text}</p>
            {comment.response && (
              <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                <span className="font-bold">Resposta: </span>{comment.response}
              </div>
            )}
            <textarea
              value={responses[comment.id] ?? comment.response ?? ""}
              onChange={(e) => setResponses((prev) => ({ ...prev, [comment.id]: e.target.value }))}
              placeholder="Escrever resposta..."
              rows={2}
              className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm resize-none"
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { pressButton(`${comment.id}-save`); handleSaveResponse(comment); }}
                disabled={saving === comment.id}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold text-white transition-all duration-150 disabled:opacity-50 ${pressedBtn[`${comment.id}-save`] ? "scale-95 bg-blue-900" : "bg-blue-700 hover:bg-blue-800"}`}
              >
                {saving === comment.id ? "Salvando..." : "Salvar resposta"}
              </button>
              <button
                onClick={() => { pressButton(`${comment.id}-ignore`); handleStatusChange(comment, "ignorado"); }}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-150 ${pressedBtn[`${comment.id}-ignore`] ? "scale-95 bg-slate-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                Ignorar
              </button>
              {!comment.addedToBank && (
                <button
                  onClick={() => { pressButton(`${comment.id}-bank`); handleAddToBank(comment); }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-150 ${pressedBtn[`${comment.id}-bank`] ? "scale-95 bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}
                >
                  + Adicionar ao Banco
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {importModal && (
        <CommentImportModal
          existingComments={comments}
          autoFilters={autoFilters}
          onImport={handleImport}
          onClose={() => setImportModal(false)}
        />
      )}
    </div>
  );
}

// ─── CommentImportModal ───────────────────────────────────────────────────────

function CommentImportModal({
  existingComments,
  autoFilters,
  onImport,
  onClose,
}: {
  existingComments: Comment[];
  autoFilters: AutoFilter[];
  onImport: (newItems: YouTubeCommentItem[], updatedItems: YouTubeCommentItem[]) => Promise<void>;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"scope" | "loading" | "confirm" | "error">("scope");
  const [scope, setScope] = useState<"recent" | "all">("recent");
  const [progressMsg, setProgressMsg] = useState("Buscando canal...");
  const [progressPct, setProgressPct] = useState(0);
  const [newItems, setNewItems] = useState<YouTubeCommentItem[]>([]);
  const [updatedItems, setUpdatedItems] = useState<YouTubeCommentItem[]>([]);
  const [ignoredByDate, setIgnoredByDate] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const scopeLabel = scope === "recent" ? "últimos 30 dias" : "todos os comentários";

  async function runScan() {
    setStep("loading");
    setError(null);
    setProgressPct(0);
    setProgressMsg("Buscando canal...");
    setNewItems([]);
    setUpdatedItems([]);
    setIgnoredByDate(0);
    try {
      const minDate = new Date();
      minDate.setDate(minDate.getDate() - 30);

      // 1. Listar vídeos do canal
      const videos = await listMyYouTubeChannelVideos((p) => {
        if (p.phase === "fetching-channel") setProgressMsg("Buscando canal...");
        else if (p.phase === "listing") setProgressMsg(`Listando vídeos... (${p.collected})`);
        else setProgressMsg(`Carregando estatísticas... (${p.done}/${p.total})`);
      });

      const targets = videos.filter((v) => v.commentCount > 0);
      if (targets.length === 0) {
        setNewItems([]);
        setUpdatedItems([]);
        setStep("confirm");
        return;
      }

      // Mapas para deduplicação
      const existingByExtId = new Map<string, Comment>();
      for (const c of existingComments) {
        if (c.externalId) existingByExtId.set(c.externalId, c);
      }

      const allNew: YouTubeCommentItem[] = [];
      const allUpdated: YouTubeCommentItem[] = [];
      let skippedOld = 0;

      // 2. Buscar comentários de cada vídeo
      for (let i = 0; i < targets.length; i++) {
        const v = targets[i];
        setProgressMsg(`Vídeo ${i + 1} de ${targets.length}: ${v.title}`);
        setProgressPct(Math.round(((i + 1) / targets.length) * 100));
        try {
          const items = await listVideoComments(v.videoId, v.title, 200);
          for (const item of items) {
            if (scope === "recent") {
              const publishedAt = item.publishedAt ? new Date(item.publishedAt) : null;
              if (!publishedAt || Number.isNaN(publishedAt.getTime()) || publishedAt < minDate) {
                skippedOld += 1;
                continue;
              }
            }
            const extId = item.commentId;
            const existing = existingByExtId.get(extId) ?? existingByExtId.get(`yt_comment:${extId}`);
            if (!existing) {
              allNew.push(item);
            } else if (item.channelReply && item.channelReply !== existing.response) {
              allUpdated.push(item);
            }
            // caso contrário: sem mudança → ignora
          }
        } catch {
          // pula vídeo com erro
        }
      }

      setNewItems(allNew);
      setUpdatedItems(allUpdated);
      setIgnoredByDate(skippedOld);
      setStep("confirm");
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setStep("error");
    }
  }

  async function handleImport() {
    setImporting(true);
    await onImport(newItems, updatedItems);
    setImporting(false);
  }

  const hasChanges = newItems.length > 0 || updatedItems.length > 0;

  return (
    <CenteredModal close={step !== "loading" ? onClose : undefined} className="bg-black/40" variant="compact" panelClassName="rounded-3xl border-0">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
              <Youtube size={18} className="text-red-600" />
            </div>
            <h3 className="text-lg font-black text-slate-900">Importar do YouTube</h3>
          </div>
          {step !== "loading" && (
            <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100"><X size={18} /></button>
          )}
        </div>

        {/* Scope */}
        {step === "scope" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-600">Escolha o escopo da busca antes de importar.</p>
            </div>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => setScope("recent")}
                className={`rounded-2xl border px-4 py-3 text-left transition ${scope === "recent" ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
              >
                <span className="block font-black">Últimos 30 dias</span>
                <span className="text-xs font-bold opacity-75">Busca só comentários feitos nos últimos 30 dias.</span>
              </button>
              <button
                type="button"
                onClick={() => setScope("all")}
                className={`rounded-2xl border px-4 py-3 text-left transition ${scope === "all" ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
              >
                <span className="block font-black">Todos os comentários</span>
                <span className="text-xs font-bold opacity-75">Faz uma varredura completa do canal.</span>
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
              <button onClick={runScan} className="flex-1 rounded-2xl bg-red-600 py-2 text-sm font-bold text-white hover:bg-red-700">Buscar comentários</button>
            </div>
          </div>
        )}

        {/* Loading */}
        {step === "loading" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />
            <p className="text-sm font-bold text-slate-700">{progressMsg}</p>
            <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">Escopo: {scopeLabel}</p>
            {progressPct > 0 && (
              <div className="w-full">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${progressPct}%` }} />
                </div>
                <p className="mt-1 text-center text-xs text-slate-400">{progressPct}%</p>
              </div>
            )}
          </div>
        )}

        {/* Erro */}
        {step === "error" && (
          <div className="flex flex-col gap-4 py-4">
            <div className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
              <button onClick={runScan} className="flex-1 rounded-2xl bg-red-600 py-2 text-sm font-bold text-white hover:bg-red-700">Tentar novamente</button>
            </div>
          </div>
        )}

        {/* Confirm */}
        {step === "confirm" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-full bg-slate-100 px-3 py-1 text-center text-xs font-black text-slate-500">Escopo: {scopeLabel}</div>
            {hasChanges ? (
              <>
                <div className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-4">
                  {newItems.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700">{newItems.length}</span>
                      <span className="font-bold text-slate-700">novo{newItems.length !== 1 ? "s" : ""} comentário{newItems.length !== 1 ? "s" : ""}</span>
                    </div>
                  )}
                  {updatedItems.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">{updatedItems.length}</span>
                      <span className="font-bold text-slate-700">resposta{updatedItems.length !== 1 ? "s" : ""} atualizada{updatedItems.length !== 1 ? "s" : ""}</span>
                    </div>
                  )}
                  {scope === "recent" && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-black text-slate-600">{ignoredByDate}</span>
                      <span className="font-bold text-slate-700">comentário{ignoredByDate !== 1 ? "s" : ""} ignorado{ignoredByDate !== 1 ? "s" : ""} por estar fora dos últimos 30 dias</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="flex-1 rounded-2xl bg-red-600 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {importing ? "Importando..." : "Importar"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2 size={24} className="text-emerald-600" />
                  </div>
                  <p className="font-bold text-slate-800">{scope === "recent" ? "Nenhum comentário novo nos últimos 30 dias." : "Tudo atualizado!"}</p>
                  <p className="text-sm text-slate-500">
                    {scope === "recent"
                      ? `${ignoredByDate} comentário${ignoredByDate !== 1 ? "s" : ""} fora do período foram ignorados.`
                      : "Nenhum comentário novo ou atualizado encontrado."}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStep("scope")} className="flex-1 rounded-2xl border border-slate-200 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Trocar escopo</button>
                  <button onClick={onClose} className="flex-1 rounded-2xl bg-slate-800 py-2 text-sm font-bold text-white hover:bg-slate-900">Fechar</button>
                </div>
              </>
            )}
          </div>
        )}
    </CenteredModal>
  );
}





