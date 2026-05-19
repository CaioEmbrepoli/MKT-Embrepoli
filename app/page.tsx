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
  Settings,
  Trash2,
  UserRound,
  Users,
  X,
  Youtube,
  type LucideIcon
} from "lucide-react";
import type { Dispatch, FormEvent, ReactNode, RefObject, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { campaignAudiences as seedCampaignAudiences } from "@/lib/seed-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { disconnectGoogleConnection, fetchDriveThumbnailObjectUrl, getGoogleStatus, listDriveFolder, listMyYouTubeChannelVideos, searchYouTube, startGoogleConnection, type DriveFile, type DriveItem, type GoogleConnectionStatus, type GoogleService, type YouTubeChannelVideo, type YouTubeImportProgress, type YouTubeVideo } from "@/lib/google-api";
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
  saveNotification,
  savePost,
  savePostReviewAsset,
  savePostTemplate,
  saveProductLine,
  saveProfile,
  saveTask,
  saveTaskBoard,
  saveTaskColumn,
  saveVehicleType
} from "@/lib/supabase-data";
import type {
  Campaign,
  CampaignAudience,
  CalendarDate,
  Channel,
  ChecklistItem,
  ContentType,
  EditorialPost,
  FileAttachment,
  FunnelStage,
  Idea,
  Notification,
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
  Role,
  Task,
  TaskAttachment,
  TaskBoard,
  TaskColumn,
  TaskPriority,
  TaskProgress,
  TaskResetFrequency,
  VehicleType
} from "@/lib/types";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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
  | null;

type MediaPreviewItem = Pick<FileAttachment, "name" | "type" | "source" | "url" | "previewUrl" | "mimeType">;

type AuthMode = "login" | "signup" | "forgot" | "reset" | "checkEmail" | "pending";
type BadgeTone = "blue" | "cyan" | "slate" | "red" | "green" | "amber" | "purple";

const menu = [
  { id: "painel", label: "Painel", icon: BarChart3 },
  { id: "calendario", label: "Calendário", icon: CalendarDays },
  { id: "ideias", label: "Ideias", icon: Lightbulb },
  { id: "tarefas", label: "Tarefas", icon: KanbanSquare },
  { id: "revisoes", label: "Revisões", icon: CheckCircle2 },
  { id: "campanhas", label: "Campanhas", icon: Megaphone },
  { id: "metricas", label: "Métricas", icon: ClipboardList },
  { id: "configuracoes", label: "Configurações", icon: Settings }
];

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
  if (boardId === "metas") return true;
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

function isGoalColumn(columnId: string | undefined) {
  return columnId ? goalsColumnIds.has(columnId) : false;
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
const roles: Role[] = ["admin", "gestor", "colaborador"];
const ideaTypes: Idea["type"][] = ["Postagem", "Melhoria", "Sistema", "Outros"];
const configTabs = ["Equipe", "Funil", "Filtros", "Modelos", "Datas", "Conta e Permissões"] as const;
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

const metricEngagement = (metric: PostMetric) => metric.likes + metric.comments + metric.shares;

const metricEngagementRate = (metric: PostMetric) => metric.reach ? (metricEngagement(metric) / metric.reach) * 100 : 0;

const metricConversionRate = (metric: PostMetric) => metric.clicks ? (metric.leads / metric.clicks) * 100 : 0;

function thumbnailFor(metric: PostMetric): string | null {
  const ext = metric.externalId;
  if (ext?.startsWith("yt:")) return `https://i.ytimg.com/vi/${ext.slice(3)}/mqdefault.jpg`;
  return null;
}

function metricMatchesFilter(value: string | undefined, filter: string): boolean {
  return filter === "all" || !value || value === filter;
}

type MetricTotals = { reach: number; engagement: number; clicks: number; leads: number; likes: number; comments: number; shares: number };

function computeMetricTotals(items: PostMetric[]): MetricTotals {
  return items.reduce<MetricTotals>((acc, metric) => ({
    reach: acc.reach + metric.reach,
    engagement: acc.engagement + metricEngagement(metric),
    clicks: acc.clicks + metric.clicks,
    leads: acc.leads + metric.leads,
    likes: acc.likes + metric.likes,
    comments: acc.comments + metric.comments,
    shares: acc.shares + metric.shares,
  }), { reach: 0, engagement: 0, clicks: 0, leads: 0, likes: 0, comments: 0, shares: 0 });
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
    return [
      { label: "Visualizações",       value: formatNumber(totals.reach) },
      { label: "Vídeos publicados",   value: formatNumber(count) },
      { label: "Média views/vídeo",   value: formatNumber(avgViews) },
      { label: "Curtidas",            value: formatNumber(totals.likes) },
      { label: "Comentários",         value: formatNumber(totals.comments) },
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

const slug = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const todayIso = () => new Date().toISOString().slice(0, 10);

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
  const [activeSection, setActiveSection] = useState("painel");
  const [profiles, setProfiles] = useState<Profile[]>([]);
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
  const [configTab, setConfigTab] = useState<(typeof configTabs)[number]>("Equipe");
  const [ideasView, setIdeasView] = useState<"Quadro" | "Lista">("Quadro");
  const [ideasTab, setIdeasTab] = useState<"Todos" | "Estatísticas" | Idea["type"]>("Todos");
  const realtimeReloading = useRef(false);
  const pendingSaveCount = useRef(0);
  const realtimeReloadTimer = useRef<number | null>(null);
  const remoteReady = useRef(false);

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
      setActiveTaskBoardId(primaryTaskBoardId);
    }
  }, [taskBoards, primaryTaskBoardId, activeTaskBoardId]);
  const canReviewAssets = currentUser.role === "admin" || currentUser.role === "gestor";
  const canManageTeam = canReviewAssets;
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
    const unreadIds = currentNotifications.filter((item) => !item.read).map((item) => item.id);
    const fresh = unreadIds.some((id) => !seenNotificationIds.current.has(id));
    if (seenNotificationIds.current.size && fresh && currentUser.notificationSound) {
      playNotificationSound();
    }
    seenNotificationIds.current = new Set(unreadIds);
  }, [currentNotifications, currentUser.notificationSound]);

  function openSection(sectionId: string) {
    setActiveSection(sectionId);
    if (sectionId === "tarefas") setActiveTaskBoardId(primaryTaskBoardId);
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
    setNotifications(data.notifications);
    const { data: authData } = await supabase.auth.getUser();
    const authUserId = authData.user?.id ?? sessionUserId;
    if (authUserId) {
      setSessionUserId(authUserId);
      const current = data.profiles.find((profile) => profile.id === authUserId);
      setCurrentUserId(current?.id ?? authUserId);
    }
    remoteReady.current = true;
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
      "notifications"
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
        () => { scheduleRealtimeReload(); }
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
        if (supabase && isSupabaseConfigured && remoteReady.current && !realtimeReloading.current) {
          setSaveStatus("saving");
          setSaveError("");
          pendingSaveCount.current += 1;
          void persist(current, next)
            .then(() => setSaveStatus("saved"))
            .catch((error) => {
              console.error(`Erro ao salvar ${String(key)} no Supabase`, error);
              setSaveStatus("error");
              setSaveError(friendlySaveError(error));
            })
            .finally(() => {
              pendingSaveCount.current = Math.max(0, pendingSaveCount.current - 1);
              if (pendingSaveCount.current === 0) scheduleRealtimeReload();
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

  async function addPostReviewAssets(post: EditorialPost, files: FileList | File[]) {
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
          comments: []
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
    syncPosts((current) => current.map((item) => item.id === post.id ? { ...item, status: "Revisão" } : item));
    createNotifications(reviewRecipients(post), "Nova arte para revisar", post.title, "review", uploaded[0].id);
  }

  function addPostReviewExternalAsset(post: EditorialPost, url: string, previewUrlOverride?: string) {
    const isYoutube = Boolean(youtubePreviewUrl(url));
    const previewUrl = previewUrlOverride ?? drivePreviewUrl(url);
    if (!previewUrl) {
      window.alert("Link inválido. Use um link de compartilhamento do Google Drive ou YouTube.");
      return;
    }
    const asset: PostReviewAsset = {
      id: crypto.randomUUID(),
      postId: post.id,
      name: isYoutube ? "Vídeo do YouTube" : "Arquivo do Google Drive",
      type: isYoutube ? "video" : "arquivo",
      source: "external",
      url,
      previewUrl,
      originalSize: 0,
      compressedSize: 0,
      mimeType: "text/html",
      status: "Aguardando revisão",
      uploadedBy: currentUser.id,
      reviewedBy: "",
      uploadedAt: new Date().toISOString(),
      reviewedAt: "",
      comments: []
    };
    syncPostReviewAssets((current) => [asset, ...current]);
    syncPosts((current) => current.map((item) => item.id === post.id ? { ...item, status: "Revisão" } : item));
    createNotifications(reviewRecipients(post), "Nova arte para revisar", post.title, "review", asset.id);
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

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[276px_1fr]">
        <aside className="border-r border-slate-200 bg-white px-5 py-5">
          <div className="flex items-center gap-3">
            <Image src="/embrepoli-logo.png" alt="Logo Embrepoli" width={58} height={58} className="h-14 w-14 object-contain" priority />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Embrepoli</p>
              <h1 className="text-xl font-black">Marketing</h1>
            </div>
          </div>
          <nav className="mt-8 space-y-2">
            {menu.map((item) => {
              if (item.id === "revisoes" && !canReviewAssets) return null;
              const Icon = item.icon;
              const selected = activeSection === item.id;
              const showPendingBadge = item.id === "configuracoes" && pendingApprovalsCount > 0;
              return (
                <button
                  key={item.id}
                  onClick={() => openSection(item.id)}
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
            currentUser={currentUser}
            profileOpen={profileOpen}
            setProfileOpen={setProfileOpen}
            uploadProfilePhoto={uploadProfilePhoto}
            setModal={setModal}
            setActiveSection={setActiveSection}
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

          {activeSection === "painel" && (
            <Dashboard posts={visiblePosts} tasks={visibleTasks} campaigns={visibleCampaigns} metrics={metrics} funnelStages={funnelStages} channelById={channelById} />
          )}
          {activeSection === "calendario" && (
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
          {activeSection === "ideias" && (
            <Ideas ideas={visibleIdeas} posts={posts} setIdeas={syncIdeas} view={ideasView} setView={setIdeasView} activeTab={ideasTab} setActiveTab={setIdeasTab} channelById={channelById} lineById={lineById} vehicleTypeById={vehicleTypeById} contentTypeById={contentTypeById} funnelById={funnelById} profileById={profileById} setModal={setModal} />
          )}
          {activeSection === "tarefas" && (
            <Tasks
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
          {activeSection === "revisoes" && canReviewAssets && (
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
          {activeSection === "campanhas" && (
            <Campaigns campaigns={visibleCampaigns} lineById={lineById} vehicleTypeById={vehicleTypeById} funnelById={funnelById} profileById={profileById} setModal={setModal} />
          )}
          {activeSection === "metricas" && (
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
          {activeSection === "configuracoes" && (
            <SettingsPanel
              currentUser={currentUser}
              profiles={profiles}
              channels={channels}
              campaignAudiences={campaignAudiences}
              postTemplates={postTemplates}
              productLines={productLines}
              vehicleTypes={vehicleTypes}
              contentTypes={contentTypes}
              funnelStages={funnelStages}
              configTab={configTab}
              setConfigTab={setConfigTab}
              setProfiles={syncProfiles}
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
        <h1 className="mt-5 text-center text-3xl font-black">Embrepoli Marketing</h1>
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
                <input type="text" required autoComplete="name" value={nameValue} onChange={(e) => setNameValue(e.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-950 outline-none focus:border-blue-500" />
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
              <textarea value={adjustmentMessage} onChange={(e) => setAdjustmentMessage(e.target.value)} placeholder="Descreva os ajustes necessários" spellCheck autoCorrect="on" autoCapitalize="sentences" className="h-24 w-full resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
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
              <textarea value={adjustmentMessage} onChange={(e) => setAdjustmentMessage(e.target.value)} placeholder="Descreva os ajustes necessários" spellCheck autoCorrect="on" autoCapitalize="sentences" className="h-24 w-full resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              <button type="button" onClick={requestAdjustments} disabled={!adjustmentMessage.trim()} className="mt-2 w-full rounded-2xl bg-rose-600 px-4 py-2 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-400">Solicitar ajustes</button>
            </div>
          </div>
        )}
      </div>
      <form onSubmit={submitComment} className="mt-4 flex gap-2">
        <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Comentário interno sobre a revisão" spellCheck autoCorrect="on" autoCapitalize="sentences" className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
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
  currentUser,
  profileOpen,
  setProfileOpen,
  uploadProfilePhoto,
  setModal,
  setActiveSection,
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
  currentUser: Profile;
  profileOpen: boolean;
  setProfileOpen: Dispatch<SetStateAction<boolean>>;
  uploadProfilePhoto: (profileId: string, file: File) => void;
  setModal: Dispatch<SetStateAction<ModalState>>;
  setActiveSection: Dispatch<SetStateAction<string>>;
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
  const title = menu.find((item) => item.id === activeSection)?.label ?? "Painel";
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
        setActiveSection("revisoes");
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
    if (notification.targetKind === "system") return;
    setModal({ kind: "post", id: notification.targetId });
  }
  return (
    <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm font-bold text-blue-700">Embrepoli Kits Turbo e Intercooler</p>
        <h2 className="mt-1 text-3xl font-black">{title}</h2>
      </div>
      <div className="flex items-start gap-3">
        {canReviewAssets && pendingReviewCount > 0 && (
          <button
            type="button"
            onClick={() => setActiveSection("revisoes")}
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
  funnelStages,
  channelById
}: {
  posts: EditorialPost[];
  tasks: Task[];
  campaigns: Campaign[];
  metrics: PostMetric[];
  funnelStages: FunnelStage[];
  channelById: Map<string, Channel>;
}) {
  const reach = metrics.reduce((sum, metric) => sum + metric.reach, 0);
  const leads = metrics.reduce((sum, metric) => sum + metric.leads, 0);
  const week = makeWeek(new Date(2026, 4, 11));
  const chartData = metrics.map((metric) => ({ name: metric.postTitle.slice(0, 14), alcance: metric.reach, leads: metric.leads }));
  const bestMetric = metrics.slice().sort((a, b) => b.leads - a.leads || metricEngagement(b) - metricEngagement(a))[0];
  const postsWithoutMetric = posts.filter((post) => !metrics.some((metric) => metric.postId === post.id || metric.postTitle === post.title));
  const bestChannelId = Object.entries(metrics.reduce<Record<string, number>>((acc, metric) => {
    acc[metric.channelId] = (acc[metric.channelId] ?? 0) + metric.leads;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1])[0]?.[0];
  const funnelData = funnelStages.map((stage) => ({
    name: stage.name,
    value: posts.filter((post) => post.funnelStageId === stage.id).length + campaigns.filter((campaign) => campaign.funnelStageId === stage.id).length,
    color: stage.color
  }));

  return (
    <div className="space-y-6 animate-task-switch">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Alcance" value={formatNumber(reach)} icon={BarChart3} />
        <Stat label="Leads" value={formatNumber(leads)} icon={CheckCircle2} />
        <Stat label="Posts" value={posts.length} icon={CalendarDays} />
        <Stat label="Tarefas" value={tasks.length} icon={KanbanSquare} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[28px] border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-black text-blue-700">Melhor conteúdo</p>
          <h3 className="mt-2 line-clamp-2 font-black">{bestMetric?.postTitle ?? "Sem métricas ainda"}</h3>
          <p className="mt-2 text-sm font-bold text-slate-600">{bestMetric ? `${bestMetric.leads} leads · ${formatPercent(metricEngagementRate(bestMetric))} engajamento` : "Cadastre métricas para comparar resultados."}</p>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-black text-slate-500">Canal com melhor resultado</p>
          <h3 className="mt-2 font-black">{channelById.get(bestChannelId ?? "")?.name ?? "Sem dados"}</h3>
          <p className="mt-2 text-sm font-bold text-slate-500">Baseado em leads registrados.</p>
        </div>
        <div className="rounded-[28px] border border-amber-100 bg-amber-50 p-4">
          <p className="text-sm font-black text-amber-700">Posts sem métrica</p>
          <h3 className="mt-2 text-2xl font-black">{postsWithoutMetric.length}</h3>
          <p className="mt-2 text-sm font-bold text-slate-600">Itens que ainda precisam de acompanhamento.</p>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Desempenho">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 700, fill: "#334155" }} />
                <YAxis tick={{ fontSize: 12, fontWeight: 700, fill: "#334155" }} tickFormatter={(value) => formatNumber(Number(value))} />
                <Tooltip />
                <Area dataKey="alcance" stroke="#2563eb" fill="#bfdbfe">
                  <LabelList dataKey="alcance" position="top" formatter={(value: number) => formatNumber(value)} fill="#1d4ed8" fontSize={13} fontWeight={900} />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <ChartValueList data={chartData.slice(0, 5).map((item) => ({ label: item.name, value: `${formatNumber(item.alcance)} alcance · ${item.leads} leads` }))} />
        </Panel>
        <Panel title="Funil">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={funnelData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={94} label={({ value }) => String(value)}>
                  {funnelData.map((item) => <Cell key={item.name} fill={item.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ChartValueList data={funnelData.map((item) => ({ label: item.name, value: `${item.value} item(ns)` }))} />
        </Panel>
      </div>
      <Panel title="Mini calendário da semana">
        <div className="grid grid-cols-7 gap-2">
          {week.map((day) => (
            <div key={day.toISOString()} className="min-h-32 rounded-3xl bg-slate-50 p-3">
              <p className="text-xs font-black uppercase text-slate-500">{day.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" })}</p>
              {posts.filter((post) => sameDay(new Date(post.publishAt), day)).map((post) => (
                <div key={post.id} className="mt-2 rounded-2xl bg-blue-700 p-2 text-xs font-black text-white">
                  {new Date(post.publishAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} {channelById.get(post.channelId)?.name}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Panel>
    </div>
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
          {stage && <span className="mt-1 inline-flex rounded-xl px-2 py-0.5 text-[10px] font-black text-white" style={{ background: stage.color }}>{stage.name.split(" - ")[0]}</span>}
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
    const boardId = `${slug(name)}-${crypto.randomUUID().slice(0, 6)}`;
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
  const goalsActive = isMetasBoardId(props.activeTaskBoardId, props.taskBoards);
  const activeColumns: TaskColumn[] = goalsActive
    ? GOALS_VIRTUAL_COLUMNS.map((c) => ({ id: c.id, boardId: c.boardId, name: c.name, color: c.color, order: c.order }))
    : props.taskColumns.filter((column) => column.boardId === props.activeTaskBoardId).slice().sort((a, b) => a.order - b.order);
  const calendarActive = props.activeTaskBoardId === calendarTaskBoardId;
  const activeTaskMenu = taskMenu ? props.tasks.find((task) => task.id === taskMenu.taskId) : undefined;

  return (
    <Panel title="Tarefas" action={calendarActive ? <RoundAdd onClick={() => props.setModal({ kind: "post" })} label="Adicionar post" /> : goalsActive ? null : <button onClick={addColumn} className="rounded-2xl bg-blue-700 px-4 py-2 text-sm font-black text-white">Nova coluna</button>}>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {sortedBoards.map((board) => (
          <span key={board.id} className={`inline-flex items-center gap-1 rounded-2xl ${props.activeTaskBoardId === board.id ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}>
            <button
              type="button"
              onClick={() => props.setActiveTaskBoardId(board.id)}
              className="px-4 py-2 text-sm font-black"
            >
              {board.name}
            </button>
            {!board.isFixed && (
              <button type="button" onClick={() => deleteBoard(board)} className={`mr-2 rounded-xl p-1 ${props.activeTaskBoardId === board.id ? "hover:bg-blue-800" : "hover:bg-rose-100 hover:text-rose-700"}`} title="Excluir aba">
                <X size={14} />
              </button>
            )}
          </span>
        ))}
        <button
          type="button"
          onClick={() => props.setActiveTaskBoardId(calendarTaskBoardId)}
          className={`rounded-2xl px-4 py-2 text-sm font-black ${calendarActive ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Calendário
        </button>
        <button type="button" onClick={addBoard} className="grid h-10 w-10 place-items-center rounded-full bg-blue-100 text-blue-700" title="Novo quadro"><Plus size={18} /></button>
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
        <input value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} placeholder="+ tarefa rápida" spellCheck autoCorrect="on" autoCapitalize="sentences" className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
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
  const status = computeGoalStatus(task);
  const colors = goalStatusColors(status.kind);
  const target = task.targetValue ?? 0;
  const current = task.currentValue ?? 0;
  const unit = task.unit || "";

  function adjust(delta: number, event: React.MouseEvent) {
    event.stopPropagation();
    const step = event.shiftKey ? 10 * delta : delta;
    setTasks((all) => all.map((t) => t.id === task.id ? { ...t, currentValue: Math.max(0, (t.currentValue ?? 0) + step) } : t));
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
        <span className="text-2xl font-black text-slate-950">{current.toLocaleString("pt-BR")}</span>
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
        <h4 className="font-black">{task.title}</h4>
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
                    <Area dataKey="alcance" stroke="#2563eb" fill="#bfdbfe">
                      <LabelList dataKey="alcance" position="top" formatter={(value: number) => formatNumber(value)} fill="#1d4ed8" fontSize={12} fontWeight={900} />
                    </Area>
                    <Area dataKey="leads" stroke="#0891b2" fill="#cffafe">
                      <LabelList dataKey="leads" position="top" fill="#0e7490" fontSize={12} fontWeight={900} />
                    </Area>
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
            {period !== "all" && <ChartValueList data={dailyData.slice(-5).map((item) => ({ label: item.date, value: `${formatNumber(item.alcance)} alcance · ${item.leads} leads` }))} />}
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
          <div className={`grid gap-4 ${isYoutubeChannel ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
            <RankingCard title="Mais alcance" metrics={topReach} value={(metric) => formatNumber(metric.reach)} />
            {!isYoutubeChannel && <RankingCard title="Mais leads" metrics={topLeads} value={(metric) => `${metric.leads} leads`} />}
            <RankingCard title="Mais engajamento" metrics={topEngagement} value={(metric) => formatNumber(metricEngagement(metric))} />
          </div>
        </section>

        {!isYoutubeChannel && (
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
        )}
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-black">Top 10 mais visualizados · {activeChannelName}</h3>
          <button type="button" onClick={() => setAllVideosOpen(true)} className="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-700">
            Ver todos os {channelMetrics.length} vídeos →
          </button>
        </div>
        <div className="grid gap-2">
          {previewMetrics.map((metric) => {
            const thumb = thumbnailFor(metric);
            return (
              <button key={metric.id} onClick={() => setModal({ kind: "metric", id: metric.id })} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left transition hover:border-blue-200 hover:bg-slate-50">
                {thumb ? (
                  <img src={thumb} alt="" className="h-14 w-24 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    <FileVideo size={20} className="text-slate-400" />
                  </div>
                )}
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
                </div>
              </button>
            );
          })}
          {!previewMetrics.length && <p className="rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-500">Nenhuma métrica encontrada com os filtros atuais.</p>}
        </div>
      </section>
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
  currentUser: Profile;
  profiles: Profile[];
  channels: Channel[];
  campaignAudiences: CampaignAudience[];
  postTemplates: PostTemplate[];
  productLines: ProductLine[];
  vehicleTypes: VehicleType[];
  contentTypes: ContentType[];
  funnelStages: FunnelStage[];
  calendarDates: CalendarDate[];
  configTab: (typeof configTabs)[number];
  setConfigTab: Dispatch<SetStateAction<(typeof configTabs)[number]>>;
  setProfiles: Dispatch<SetStateAction<Profile[]>>;
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
  return (
    <div className="space-y-5">
      <Panel title="Configurações">
        <div className="flex flex-wrap gap-2">
          {configTabs.map((tab) => (
            <button key={tab} onClick={() => props.setConfigTab(tab)} className={`rounded-2xl px-4 py-2 text-sm font-black ${props.configTab === tab ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}>
              {tab}
            </button>
          ))}
        </div>
      </Panel>
      {props.configTab === "Equipe" && <TeamSettings {...props} />}
      {props.configTab === "Funil" && <FunnelSettings funnelStages={props.funnelStages} setFunnelStages={props.setFunnelStages} />}
      {props.configTab === "Filtros" && <ChannelsLinesSettings channels={props.channels} campaignAudiences={props.campaignAudiences} productLines={props.productLines} vehicleTypes={props.vehicleTypes} contentTypes={props.contentTypes} setChannels={props.setChannels} setCampaignAudiences={props.setCampaignAudiences} setProductLines={props.setProductLines} setVehicleTypes={props.setVehicleTypes} setContentTypes={props.setContentTypes} />}
      {props.configTab === "Modelos" && <PostTemplateSettings templates={props.postTemplates} setTemplates={props.setPostTemplates} channels={props.channels} contentTypes={props.contentTypes} funnelStages={props.funnelStages} />}
      {props.configTab === "Datas" && <CalendarDateSettings calendarDates={props.calendarDates} setCalendarDates={props.setCalendarDates} />}
      {props.configTab === "Conta e Permissões" && <PermissionsSettings currentUser={props.currentUser} setProfiles={props.setProfiles} />}
    </div>
  );
}

function TeamSettings({ profiles, setProfiles, uploadProfilePhoto, currentUser, setModal, sendPasswordResetForProfile }: Parameters<typeof SettingsPanel>[0]) {
  const canManageTeam = currentUser.role === "admin" || currentUser.role === "gestor";
  const [resettingProfileId, setResettingProfileId] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const pendingCount = profiles.filter((p) => !p.active).length;
  const sortedProfiles = [...profiles].sort((a, b) => {
    if (a.active === b.active) return a.name.localeCompare(b.name);
    return a.active ? 1 : -1;
  });
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
            </div>
            <Badge tone="blue">{roleLabel[profile.role]}</Badge>
            {canManageTeam && (
              <div className="flex flex-wrap gap-2">
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
      <input value={stage.name} onChange={(event) => setFunnelStages((current) => current.map((item) => item.id === stage.id ? { ...item, name: event.target.value } : item))} className="min-w-0 flex-1 bg-transparent font-black outline-none" />
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
            <input value={item.name} onChange={(event) => setItems((current) => current.map((currentItem) => currentItem.id === item.id ? { ...currentItem, name: event.target.value } : currentItem))} className="min-w-0 flex-1 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 font-black outline-none focus:border-blue-500" />
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
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm animate-fade-in-up">
      <section className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[34px] border border-white/70 bg-white p-6 shadow-2xl animate-soft-pop">
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
      </section>
    </div>
  );
}

function ListEditor({ title, items, setItems }: { title: string; items: string[]; setItems: Dispatch<SetStateAction<string[]>> }) {
  return (
    <div className="space-y-2 rounded-3xl border border-slate-100 bg-slate-50 p-3 md:col-span-2">
      <p className="text-sm font-black text-slate-600">{title}</p>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-blue-100 text-xs font-black text-blue-700">{index + 1}</span>
          <input value={item} onChange={(event) => setItems((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 font-bold outline-none focus:border-blue-500" />
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
          <input value={item.label} onChange={(event) => setItems((current) => current.map((value) => value.id === item.id ? { ...value, label: event.target.value } : value))} className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 font-bold outline-none focus:border-blue-500" />
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
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm animate-fade-in-up">
      <section className="w-full max-w-2xl rounded-[34px] border border-white/70 bg-white p-6 shadow-2xl animate-soft-pop">
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
      </section>
    </div>
  );
}

function PermissionsSettings({ currentUser, setProfiles }: { currentUser: Profile; setProfiles: Dispatch<SetStateAction<Profile[]>> }) {
  const [googleStatus, setGoogleStatus] = useState<GoogleConnectionStatus | null>(null);
  const [googleLoading, setGoogleLoading] = useState(true);
  const [googleBusy, setGoogleBusy] = useState<GoogleService | null>(null);
  const [googleError, setGoogleError] = useState("");
  const canManageGoogle = currentUser.role === "admin" || currentUser.role === "gestor";

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

  useEffect(() => {
    loadGoogleStatus();
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
            {!canManageGoogle && (
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
                  {canManageGoogle && (
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
  addPostReviewAssets: (post: EditorialPost, files: FileList | File[]) => void;
  addPostReviewExternalAsset: (post: EditorialPost, url: string, thumbnailUrl?: string) => void;
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm animate-fade-in-up">
      <section ref={modalContentRef} className={`max-h-[92vh] w-full overflow-y-auto rounded-[34px] border border-white/70 bg-white p-6 shadow-2xl shadow-slate-950/20 animate-soft-pop ${modal.kind === "task" || modal.kind === "post" ? "max-w-6xl" : "max-w-3xl"}`}>
        <div className="mb-5 flex items-start justify-between gap-4 rounded-[26px] bg-gradient-to-r from-blue-50 to-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-black text-blue-700">Embrepoli Marketing</p>
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
      </section>
    </div>
  );
}

function modalTitle(modal: NonNullable<ModalState>) {
  if (modal.kind === "task") return "Editar tarefa";
  if (modal.kind === "post") return modal.id ? "Editar post" : "Novo post";
  if (modal.kind === "idea") return modal.id ? "Editar ideia" : "Nova ideia";
  if (modal.kind === "campaign") return modal.id ? "Editar campanha" : "Nova campanha";
  if (modal.kind === "profile") return "Editar perfil";
  if (modal.kind === "teamMember") return "Editar membro";
  return modal.id ? "Editar métrica" : "Nova métrica";
}

function MediaPreviewModal({ item, close }: { item: MediaPreviewItem; close: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm animate-fade-in-up">
      <section className="w-full max-w-5xl rounded-[34px] bg-white p-4 shadow-2xl animate-soft-pop">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="line-clamp-1 font-black">{item.name}</h3>
          <button type="button" onClick={close} className="rounded-2xl bg-slate-100 p-2 text-slate-600"><X size={18} /></button>
        </div>
        <MediaPreviewContent item={item} large />
      </section>
    </div>
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
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
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
          {error && <div className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
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
      </div>
    </div>
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
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
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
                    {thumb ? (
                      <img src={thumb} alt="" className="h-14 w-24 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                        <FileVideo size={20} className="text-slate-400" />
                      </div>
                    )}
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
      </div>
    </div>
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
      const importedRows: PostMetric[] = videos.map((v) => {
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
        };
      });

      // Coleta snapshots dos vídeos existentes cujos valores mudaram (guarda os valores ANTIGOS)
      const snapshots: PostMetricSnapshot[] = videos
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
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && phase !== "fetching" && phase !== "importing" && onClose()}>
      <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
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
      </div>
    </div>
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
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-[34px] bg-white p-6 shadow-2xl">
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
      </div>
    </div>
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
      return {
        ...next,
        nextResetAt: calculateNextResetAt(next)
      };
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

      <input value={task.title} onChange={(event) => updateTask(task.id, (current) => ({ ...current, title: event.target.value }))} spellCheck autoCorrect="on" autoCapitalize="sentences" className="w-full rounded-2xl border-0 bg-transparent px-0 py-1 text-3xl font-black outline-none focus:ring-0" />
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
      </div>

      <section className="space-y-2">
        <h3 className="font-black">Descrição</h3>
        <textarea value={task.description} rows={7} placeholder="Do que se trata esta tarefa?" onChange={(event) => updateTask(task.id, (current) => ({ ...current, description: event.target.value }))} spellCheck autoCorrect="on" autoCapitalize="sentences" className="w-full resize-none rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-500" />
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
                spellCheck autoCorrect="on" autoCapitalize="sentences"
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
          <input value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} placeholder="Nova subtarefa" spellCheck autoCorrect="on" autoCapitalize="sentences" className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500" />
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
              <input value={item.label} onChange={(event) => updateTask(task.id, (current) => ({ ...current, checklist: current.checklist.map((check) => check.id === item.id ? { ...check, label: event.target.value } : check) }))} spellCheck autoCorrect="on" autoCapitalize="sentences" className="min-w-0 flex-1 bg-transparent font-bold outline-none" />
              <button type="button" onClick={() => updateTask(task.id, (current) => ({ ...current, checklist: current.checklist.filter((check) => check.id !== item.id) }))} className="rounded-xl bg-rose-100 p-2 text-rose-700" title="Excluir item"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <form onSubmit={addChecklist} className="flex gap-2"><input name="label" required placeholder="Novo item" spellCheck autoCorrect="on" autoCapitalize="sentences" className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500" /><button className="rounded-2xl bg-blue-700 px-3 text-white"><Plus size={17} /></button></form>
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
          <input name="message" required placeholder="Adicionar um comentário" spellCheck autoCorrect="on" autoCapitalize="sentences" className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" />
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

function PostModalV2({ modal, currentUser, profiles, profileById, channels, productLines, vehicleTypes, contentTypes, funnelStages, campaigns, postTemplates, posts, setPosts, postReviewAssets, addPostReviewAssets, addPostReviewExternalAsset, deletePostReviewAsset, openMediaPreview, setReviewAssetStatus, addReviewComment, createNotifications, ideas, close }: Parameters<typeof EntityModal>[0] & { close: () => void }) {
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
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? assets[0];
  const canReview = currentUser.role === "admin" || currentUser.role === "gestor";
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
          <div className="flex gap-2 rounded-2xl bg-slate-100 p-1 md:col-span-2">
            {(["zero", "idea", "template"] as const).map((mode) => (
              <button key={mode} type="button" onClick={() => changeCreationMode(mode)} className={`flex-1 rounded-xl px-3 py-2 text-sm font-black ${creationMode === mode ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"}`}>
                {mode === "zero" ? "Criar do zero" : mode === "idea" ? "Usar ideia" : "Usar modelo"}
              </button>
            ))}
          </div>
          {creationMode === "idea" ? <label className="block text-sm font-bold text-slate-600 md:col-span-2">Ideia de origem<select name="ideaId" value={selectedIdeaId} onChange={(event) => applyIdea(event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-950 outline-none focus:border-blue-500"><option value="">Sem ideia vinculada</option>{postIdeas.map((idea) => <option key={idea.id} value={idea.id}>{idea.title}</option>)}</select></label> : <input type="hidden" name="ideaId" value={selectedIdeaId} />}
          {creationMode === "template" ? <label className="block text-sm font-bold text-slate-600 md:col-span-2">Usar modelo<select name="templateId" value={selectedTemplateId} onChange={(event) => applyTemplate(event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-950 outline-none focus:border-blue-500"><option value="">Sem modelo</option>{postTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label> : <input type="hidden" name="templateId" value={selectedTemplateId} />}
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
                  <input value={item.label} onChange={(event) => setProductionChecklist((current) => current.map((check) => check.id === item.id ? { ...check, label: event.target.value } : check))} className="min-w-0 flex-1 bg-transparent font-bold outline-none" />
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
          <SubmitButton>{editing ? "Salvar" : "Criar"}</SubmitButton>
        </EntityForm>
        {editing && <DeleteButton label="Excluir post" onDelete={() => { setPosts((current) => current.filter((post) => post.id !== editing.id)); close(); }} />}
      </div>

      {reviewOpen && editing && (
        <PostReviewPanel
          post={editing}
          assets={assets}
          selectedAsset={selectedAsset}
          setSelectedAssetId={setSelectedAssetId}
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
  selectedAsset,
  setSelectedAssetId,
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
  selectedAsset?: PostReviewAsset;
  setSelectedAssetId: (id: string) => void;
  profileById: Map<string, Profile>;
  canReview: boolean;
  addPostReviewAssets: (post: EditorialPost, files: FileList | File[]) => void;
  addPostReviewExternalAsset: (post: EditorialPost, url: string, thumbnailUrl?: string) => void;
  deletePostReviewAsset: (assetId: string) => void;
  openMediaPreview: (item: MediaPreviewItem) => void;
  setReviewAssetStatus: (assetId: string, status: ReviewAssetStatus, message?: string) => void;
  addReviewComment: (assetId: string, message: string) => void;
  close: () => void;
}) {
  const [adjustmentMessage, setAdjustmentMessage] = useState("");
  const [showAdjustInput, setShowAdjustInput] = useState(false);
  const [comment, setComment] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [ytOpen, setYtOpen] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAsset) return;
    addReviewComment(selectedAsset.id, comment);
    setComment("");
  }

  function requestAdjustments() {
    if (!selectedAsset || !adjustmentMessage.trim()) return;
    setReviewAssetStatus(selectedAsset.id, "Ajustes solicitados", adjustmentMessage.trim());
    setAdjustmentMessage("");
    setShowAdjustInput(false);
  }

  function submitExternalAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addPostReviewExternalAsset(post, externalUrl);
    setExternalUrl("");
  }

  function addDriveFileToReview(file: DriveFile) {
    addPostReviewExternalAsset(post, file.url, file.previewUrl);
  }

  function addYouTubeToReview(video: YouTubeVideo) {
    addPostReviewExternalAsset(post, video.url);
  }

  function removeSelectedAsset() {
    if (!selectedAsset) return;
    if (!window.confirm("Excluir este arquivo de revisão?")) return;
    deletePostReviewAsset(selectedAsset.id);
    const nextAsset = assets.find((asset) => asset.id !== selectedAsset.id);
    setSelectedAssetId(nextAsset?.id ?? "");
  }

  return (
    <aside className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-blue-700">Revisão de arte</p>
          <h3 className="font-black">{post.title}</h3>
        </div>
        <button type="button" onClick={close} className="rounded-2xl bg-white p-2"><X size={18} /></button>
      </div>

      <FileDropZone
        className="mb-4"
        icon="file"
        multiple
        title={assets.length ? "Adicionar mais artes" : "Enviar arquivo"}
        hint="Imagens até 2 MB, vídeos até 100 MB"
        onFiles={(files) => addPostReviewAssets(post, files)}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setDriveOpen(true)} className="flex items-center gap-2 rounded-2xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700 hover:bg-blue-100">
          <HardDrive size={15} /> Selecionar do Drive
        </button>
        <button type="button" onClick={() => setYtOpen(true)} className="flex items-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-sm font-black text-red-700 hover:bg-red-100">
          <Youtube size={15} /> Buscar no YouTube
        </button>
      </div>
      <form onSubmit={submitExternalAsset} className="mb-4 flex gap-2">
        <input value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="Ou cole um link do Google Drive / YouTube" className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
        <button disabled={!externalUrl.trim()} className="rounded-2xl bg-slate-950 px-3 text-sm font-black text-white disabled:bg-slate-200">Adicionar</button>
      </form>
      {driveOpen && <DriveExplorerModal onSelect={addDriveFileToReview} onClose={() => setDriveOpen(false)} />}
      {ytOpen && <YouTubeSearchModal onSelect={addYouTubeToReview} onClose={() => setYtOpen(false)} />}

      {assets.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {assets.map((asset) => (
            <button key={asset.id} type="button" onClick={() => setSelectedAssetId(asset.id)} className={`shrink-0 rounded-2xl border px-3 py-2 text-xs font-black ${selectedAsset?.id === asset.id ? "border-blue-600 bg-blue-700 text-white" : "border-slate-200 bg-white text-slate-600"}`}>
              {asset.name}
            </button>
          ))}
        </div>
      )}

      {selectedAsset ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <button type="button" onClick={() => openMediaPreview(selectedAsset)} className="block w-full">
              <MediaPreviewContent item={selectedAsset} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={selectedAsset.status === "Aprovado" ? "green" : selectedAsset.status === "Ajustes solicitados" ? "red" : "blue"}>{selectedAsset.status}</Badge>
            <Badge tone="slate">{selectedAsset.source === "external" ? externalMediaLabel(selectedAsset) : formatBytes(selectedAsset.compressedSize || selectedAsset.originalSize)}</Badge>
            <span className="text-xs font-bold text-slate-500">Enviado por {profileById.get(selectedAsset.uploadedBy)?.name}</span>
            <div className="ml-auto flex items-center gap-1">
              <FileActionButtons item={selectedAsset} />
              <button type="button" onClick={removeSelectedAsset} className="rounded-2xl bg-rose-100 px-3 py-1.5 text-xs font-black text-rose-700 transition hover:bg-rose-200">
                Excluir arquivo
              </button>
            </div>
          </div>
          {canReview && (
            <div className="rounded-3xl bg-white p-3">
              {selectedAsset.status === "Aprovado" ? (
                showAdjustInput ? (
                  <>
                    <textarea value={adjustmentMessage} onChange={(e) => setAdjustmentMessage(e.target.value)} placeholder="O que precisa ajustar?" spellCheck autoCorrect="on" autoCapitalize="sentences" className="h-24 w-full resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => { setShowAdjustInput(false); setAdjustmentMessage(""); }} className="flex-1 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-200">Cancelar</button>
                      <button type="button" onClick={requestAdjustments} disabled={!adjustmentMessage.trim()} className="flex-1 rounded-2xl bg-rose-600 px-3 py-2 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-400">Enviar</button>
                    </div>
                  </>
                ) : (
                  <button type="button" onClick={() => setShowAdjustInput(true)} className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-black text-rose-700 hover:bg-rose-100">Solicitar ajuste</button>
                )
              ) : (
                <div className="space-y-2">
                  <button type="button" onClick={() => setReviewAssetStatus(selectedAsset.id, "Aprovado")} className="w-full rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-black text-white">Aprovar arte</button>
                  <textarea value={adjustmentMessage} onChange={(e) => setAdjustmentMessage(e.target.value)} placeholder="O que precisa ajustar?" spellCheck autoCorrect="on" autoCapitalize="sentences" className="h-24 w-full resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                  <button type="button" onClick={requestAdjustments} disabled={!adjustmentMessage.trim()} className="w-full rounded-2xl bg-rose-600 px-3 py-2 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-400">Solicitar ajustes</button>
                </div>
              )}
            </div>
          )}
          <form onSubmit={submitComment} className="flex gap-2">
            <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Comentário sobre esta arte" spellCheck autoCorrect="on" autoCapitalize="sentences" className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            <button disabled={!comment.trim()} className="rounded-2xl bg-blue-700 px-3 text-white disabled:bg-slate-200"><MessageSquare size={16} /></button>
          </form>
          <div className="space-y-2">
            {selectedAsset.comments.map((item) => (
              <div key={item.id} className="rounded-2xl bg-white p-3">
                <p className="text-sm font-black">{profileById.get(item.authorId)?.name}</p>
                <p className="mt-1 text-sm text-slate-600">{item.message}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-3xl bg-white p-5 text-sm font-bold text-slate-500">Adicione uma arte para iniciar a revisão.</p>
      )}
    </aside>
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

function MetricModalV2({ modal, posts, channels, productLines, vehicleTypes, contentTypes, funnelStages, campaigns, metrics, setMetrics, close }: Parameters<typeof EntityModal>[0] & { close: () => void }) {
  const editing = modal?.kind === "metric" && modal.id ? metrics.find((metric) => metric.id === modal.id) : undefined;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const postId = String(form.get("postId") ?? "");
    const linkedPost = posts.find((post) => post.id === postId);
    const value: PostMetric = {
      id: editing?.id ?? crypto.randomUUID(),
      externalId: editing?.externalId,
      videoType: editing?.videoType,
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
      learning: String(form.get("learning"))
    };
    setMetrics((current) => {
      if (editing) return current.map((metric) => metric.id === value.id ? value : metric);
      // Evita duplicar: se já existe métrica com o mesmo postId, atualiza em vez de criar
      const samePost = value.postId ? current.find((m) => m.postId === value.postId) : undefined;
      if (samePost) return current.map((m) => m.id === samePost.id ? { ...value, id: samePost.id } : m);
      return [value, ...current];
    });
    close();
  }
  return <><EntityForm onSubmit={submit}><Select name="postId" label="Post vinculado" defaultValue={editing?.postId ?? ""} options={[["", "Métrica avulsa"], ...posts.map((post) => [post.id, post.title])]} /><TextInput name="postTitle" label="Nome do post/registro" required defaultValue={editing?.postTitle} /><TextInput name="date" label="Data da métrica" type="date" required defaultValue={editing?.date ?? todayIso()} /><Select name="channelId" label="Canal" defaultValue={editing?.channelId} options={channels.map((item) => [item.id, item.name])} /><Select name="campaignId" label="Campanha" defaultValue={editing?.campaignId} options={campaigns.map((item) => [item.id, item.name])} /><Select name="productLineId" label="Linha" defaultValue={editing?.productLineId} options={[["", "Sem linha específica"], ...productLines.map((item) => [item.id, item.name])]} /><Select name="vehicleTypeId" label="Tipo de veículo" defaultValue={editing?.vehicleTypeId} options={[["", "Sem tipo específico"], ...vehicleTypes.map((item) => [item.id, item.name])]} /><Select name="contentTypeId" label="Tipo de conteúdo" defaultValue={editing?.contentTypeId} options={[["", "Sem tipo de conteúdo"], ...contentTypes.map((item) => [item.id, item.name])]} /><Select name="funnelStageId" label="Funil" defaultValue={editing?.funnelStageId} options={[["", "Sem funil"], ...funnelStages.map((item) => [item.id, item.name])]} />{["reach", "likes", "comments", "shares", "clicks", "leads"].map((field) => <TextInput key={field} name={field} label={field} type="number" required defaultValue={String((editing as unknown as Record<string, number | undefined>)?.[field] ?? "")} />)}<TextArea name="notes" label="Observações do resultado" defaultValue={editing?.notes} /><TextArea name="learning" label="Aprendizado" defaultValue={editing?.learning} /><SubmitButton>Salvar</SubmitButton></EntityForm>{editing && <DeleteButton label="Excluir métrica" onDelete={() => { setMetrics((current) => current.filter((metric) => metric.id !== editing.id)); close(); }} />}</>;
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

function TeamMemberModal({ modal, currentUser, profiles, setProfiles, uploadProfilePhoto, close }: Parameters<typeof EntityModal>[0] & { close: () => void }) {
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const member = modal?.kind === "teamMember" ? profiles.find((profile) => profile.id === modal.id) : undefined;
  const canManageTeam = currentUser.role === "admin" || currentUser.role === "gestor";
  if (!member || !canManageTeam) return <p className="text-sm font-bold text-slate-500">Você não tem permissão para editar este membro.</p>;

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

    setProfiles((current) => current.map((profile) => (profile.id === member.id ? updated : profile)));
    close();
  }

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

function RoundAdd({ onClick, label }: { onClick: () => void; label: string }) {
  return <button onClick={onClick} aria-label={label} title={label} className="grid h-11 w-11 place-items-center rounded-full bg-blue-700 text-white shadow-lg shadow-blue-700/20 motion-smooth hover:bg-blue-800"><Plus size={22} /></button>;
}

function Badge({ children, tone }: { children: ReactNode; tone: BadgeTone }) {
  const tones = { blue: "bg-blue-100 text-blue-700", cyan: "bg-cyan-100 text-cyan-700", slate: "bg-slate-100 text-slate-600", red: "bg-rose-100 text-rose-700", green: "bg-emerald-100 text-emerald-700", amber: "bg-amber-100 text-amber-700", purple: "bg-violet-100 text-violet-700" };
  return <span className={`inline-flex rounded-2xl px-2.5 py-1 text-xs font-black ${tones[tone]}`}>{children}</span>;
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
  return <label className="block text-sm font-bold text-slate-600">{label}<input name={name} type={type} required={required} defaultValue={defaultValue} autoComplete={autoComplete} spellCheck={type === "text"} autoCorrect={type === "text" ? "on" : "off"} autoCapitalize={type === "text" ? "sentences" : "off"} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-950 outline-none focus:border-blue-500" /></label>;
}

function TextArea({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return <label className="block text-sm font-bold text-slate-600 md:col-span-2">{label}<textarea name={name} rows={4} defaultValue={defaultValue} spellCheck autoCorrect="on" autoCapitalize="sentences" className="mt-1 w-full resize-none rounded-3xl border border-slate-200 px-3 py-2 text-slate-950 outline-none focus:border-blue-500" /></label>;
}

function Select({ label, name, options, defaultValue }: { label: string; name: string; options: string[][]; defaultValue?: string }) {
  return <label className="block text-sm font-bold text-slate-600">{label}<select name={name} defaultValue={defaultValue} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-950 outline-none focus:border-blue-500">{options.map(([value, labelText]) => <option key={value} value={value}>{labelText}</option>)}</select></label>;
}

function SelectControlled({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return <label className="block text-sm font-bold text-slate-600">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-950 outline-none focus:border-blue-500">{options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}</select></label>;
}

function TextInputControlled({ label, value, onChange, type = "text", min, max }: { label: string; value: string; onChange: (value: string) => void; type?: string; min?: number; max?: number }) {
  return <label className="block text-sm font-bold text-slate-600">{label}<input value={value} onChange={(event) => onChange(event.target.value)} type={type} min={min} max={max} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-950 outline-none focus:border-blue-500" /></label>;
}

function FileDropZone({
  title,
  hint,
  icon,
  multiple = false,
  className = "",
  onFiles
}: {
  title: string;
  hint: string;
  icon: "camera" | "file";
  multiple?: boolean;
  className?: string;
  onFiles: (files: File[]) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const Icon = icon === "camera" ? Camera : FileUp;

  function filesFromList(fileList: FileList | null) {
    return fileList ? Array.from(fileList).filter((file) => file.size > 0) : [];
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    const files = filesFromList(event.dataTransfer.files);
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

function SubmitButton({ children, full = false }: { children: ReactNode; full?: boolean }) {
  return <button type="submit" className={`${full ? "w-full" : ""} inline-flex items-center justify-center rounded-2xl bg-blue-700 px-4 py-2 font-black text-white transition hover:bg-slate-950`}>{children}</button>;
}





